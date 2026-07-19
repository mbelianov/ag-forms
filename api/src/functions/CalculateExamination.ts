import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, updateEntity, ensureTableExists } from '../utils/tableClient';
import { logExaminationUpdated } from '../utils/auditService';
import { Examination, BiometryData } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';

/**
 * Calculate Estimated Fetal Weight (EFW) using Hadlock formula
 * Formula: log10(EFW) = 1.335 - 0.0034(AC)(FL) + 0.0316(BPD) + 0.0457(AC) + 0.1623(FL)
 * 
 * @param bpd - Biparietal Diameter (mm)
 * @param hc - Head Circumference (mm)
 * @param ac - Abdominal Circumference (mm)
 * @param fl - Femur Length (mm)
 * @returns Estimated Fetal Weight in grams
 */
const calculateEFW = (bpd?: number, hc?: number, ac?: number, fl?: number): number | undefined => {
    // Need at least AC and FL for calculation
    if (!ac || !fl) {
        return undefined;
    }

    // Hadlock formula (simplified version using AC and FL)
    // log10(EFW) = 1.335 - 0.0034(AC)(FL) + 0.0316(BPD) + 0.0457(AC) + 0.1623(FL)
    let logEFW = 1.335;
    logEFW -= 0.0034 * ac * fl;
    logEFW += 0.0457 * ac;
    logEFW += 0.1623 * fl;
    
    if (bpd) {
        logEFW += 0.0316 * bpd;
    }

    // Convert from log10 to actual weight
    const efw = Math.pow(10, logEFW);
    
    // Round to nearest gram
    return Math.round(efw);
};

/**
 * Estimate gestational age from BPD measurement
 * Using simplified regression formula
 * 
 * @param bpd - Biparietal Diameter (mm)
 * @returns Gestational age in weeks
 */
const estimateGAFromBPD = (bpd: number): number => {
    // Simplified formula: GA (weeks) = 9.54 + 1.482 * BPD - 0.00168 * BPD^2
    const ga = 9.54 + (1.482 * bpd) - (0.00168 * bpd * bpd);
    return Math.max(0, ga);
};

/**
 * Estimate gestational age from HC measurement
 * 
 * @param hc - Head Circumference (mm)
 * @returns Gestational age in weeks
 */
const estimateGAFromHC = (hc: number): number => {
    // Simplified formula: GA (weeks) = 8.96 + 0.540 * HC - 0.000867 * HC^2
    const ga = 8.96 + (0.540 * hc) - (0.000867 * hc * hc);
    return Math.max(0, ga);
};

/**
 * Estimate gestational age from AC measurement
 * 
 * @param ac - Abdominal Circumference (mm)
 * @returns Gestational age in weeks
 */
const estimateGAFromAC = (ac: number): number => {
    // Simplified formula: GA (weeks) = 8.14 + 0.753 * AC - 0.0012 * AC^2
    const ga = 8.14 + (0.753 * ac) - (0.0012 * ac * ac);
    return Math.max(0, ga);
};

/**
 * Estimate gestational age from FL measurement
 * 
 * @param fl - Femur Length (mm)
 * @returns Gestational age in weeks
 */
const estimateGAFromFL = (fl: number): number => {
    // Simplified formula: GA (weeks) = 10.35 + 2.460 * FL - 0.0170 * FL^2
    const ga = 10.35 + (2.460 * fl) - (0.0170 * fl * fl);
    return Math.max(0, ga);
};

/**
 * Calculate average gestational age from available measurements
 * 
 * @param biometry - Biometry data
 * @returns Average gestational age in format "Xw Yd"
 */
const calculateGestationalAge = (biometry: BiometryData): string | undefined => {
    const estimates: number[] = [];

    if (biometry.bpd) {
        estimates.push(estimateGAFromBPD(biometry.bpd));
    }
    if (biometry.hc) {
        estimates.push(estimateGAFromHC(biometry.hc));
    }
    if (biometry.ac) {
        estimates.push(estimateGAFromAC(biometry.ac));
    }
    if (biometry.fl) {
        estimates.push(estimateGAFromFL(biometry.fl));
    }

    if (estimates.length === 0) {
        return undefined;
    }

    // Calculate average
    const avgWeeks = estimates.reduce((sum, val) => sum + val, 0) / estimates.length;
    
    // Convert to weeks and days
    const weeks = Math.floor(avgWeeks);
    const days = Math.round((avgWeeks - weeks) * 7);

    return `${weeks}w ${days}d`;
};

export async function calculateExamination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const hasRole = requireRole(user, ['doctor', 'admin']);
        if (!hasRole) {
            return forbiddenResponse('Doctor or admin role required');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get examination ID from route parameter
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        // Get examination from EXAM partition
        const examination = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            examinationId
        );

        if (!examination) {
            return errorResponse('Examination not found', 404);
        }

        if (examination.isDeleted) {
            return errorResponse('Cannot calculate deleted examination', 400);
        }

        if (!examination.biometry) {
            return errorResponse('Examination has no biometry data to calculate', 400);
        }

        const now = new Date().toISOString();
        const changedFields: string[] = [];

        // Calculate EFW if not already set
        const calculatedEFW = calculateEFW(
            examination.biometry.bpd,
            examination.biometry.hc,
            examination.biometry.ac,
            examination.biometry.fl
        );

        if (calculatedEFW !== undefined) {
            examination.biometry.efw = calculatedEFW;
            changedFields.push('biometry.efw');
        }

        // Calculate gestational age if not already set
        if (!examination.gestationalAge) {
            const calculatedGA = calculateGestationalAge(examination.biometry);
            if (calculatedGA) {
                examination.gestationalAge = calculatedGA;
                changedFields.push('gestationalAge');
            }
        }

        if (changedFields.length === 0) {
            return successResponse({
                message: 'No calculations needed - all values already present',
                examination
            });
        }

        // Update examination with calculated values
        const updatedExamination: Examination & { updatedBy: string } = {
            ...examination,
            updatedAt: now,
            updatedBy: user.userId
        };

        await updateEntity(EXAMINATIONS_TABLE, updatedExamination);

        // Also update primary entity (PATIENT_{patientId} partition)
        const primaryEntity = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            `PATIENT_${examination.patientId}`,
            examination.rowKey
        );

        if (primaryEntity) {
            const updatedPrimaryEntity: Examination & { updatedBy: string } = {
                ...primaryEntity,
                biometry: updatedExamination.biometry,
                gestationalAge: updatedExamination.gestationalAge,
                updatedAt: now,
                updatedBy: user.userId
            };

            await updateEntity(EXAMINATIONS_TABLE, updatedPrimaryEntity);
        }

        await logExaminationUpdated(user.userId, examinationId, changedFields);

        context.log('Examination calculations completed:', { 
            examinationId, 
            calculatedFields: changedFields,
            calculatedBy: user.userId 
        });

        // Return updated entity without etag
        const responseEntity = { ...updatedExamination };
        delete responseEntity.etag;

        return successResponse({
            message: 'Calculations completed successfully',
            examination: responseEntity,
            calculatedFields: changedFields
        });
    } catch (error) {
        context.error('Error in calculateExamination:', error);
        return handleError(error, context);
    }
}

app.http('CalculateExamination', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/examinations/{id}/calculate',
    handler: calculateExamination
});

// Made with Bob