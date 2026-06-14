import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, ensureTableExists } from '../utils/tableClient';
import { logExaminationEmailSent } from '../utils/auditService';
import { Examination, Patient } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';
const PATIENTS_TABLE = 'Patients';

export async function emailExaminationReport(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
        await ensureTableExists(PATIENTS_TABLE);

        // Get examination ID from route parameter
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        const body = await request.json() as any;
        const { pdfData } = body;

        if (!pdfData) {
            return errorResponse('PDF data is required', 400);
        }

        // Validate PDF data is base64 encoded
        if (typeof pdfData !== 'string' || pdfData.length === 0) {
            return errorResponse('Invalid PDF data format', 400);
        }

        // Get examination
        const examination = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            examinationId
        );

        if (!examination) {
            return errorResponse('Examination not found', 404);
        }

        if (examination.isDeleted) {
            return errorResponse('Cannot email deleted examination', 400);
        }

        // Get patient to retrieve email address
        const patient = await getEntity<Patient>(
            PATIENTS_TABLE,
            'PATIENT',
            examination.patientId
        );

        if (!patient) {
            return errorResponse('Patient not found', 404);
        }

        if (!patient.email) {
            return errorResponse('Patient does not have an email address on file', 400);
        }

        // Calculate PDF size for logging
        const pdfSizeKB = Math.round((pdfData.length * 3) / 4 / 1024); // Approximate base64 to bytes conversion

        // LOCAL TESTING MODE: Log email details instead of sending
        // In production, this would integrate with Azure Communication Services or SendGrid
        context.log('=== EMAIL SIMULATION (Local Mode) ===');
        context.log('To:', patient.email);
        context.log('Subject:', `Ultrasound Examination Report - ${patient.name}`);
        context.log('Patient:', patient.name);
        context.log('MRN:', patient.mrn);
        context.log('Exam Date:', examination.examDate);
        context.log('Exam ID:', examinationId);
        context.log('PDF Size:', `${pdfSizeKB} KB`);
        context.log('Sent By:', user.username);
        context.log('=====================================');

        // Log audit event
        await logExaminationEmailSent(user.userId, examinationId, patient.email);

        context.log('Email simulated successfully:', { 
            examinationId, 
            patientEmail: patient.email,
            pdfSizeKB,
            sentBy: user.userId 
        });

        return successResponse({
            message: 'Email simulated successfully (local mode)',
            details: {
                mode: 'simulation',
                recipient: patient.email,
                patientName: patient.name,
                examDate: examination.examDate,
                pdfSizeKB: pdfSizeKB,
                note: 'In production, this would send via Azure Communication Services or SendGrid'
            }
        });
    } catch (error) {
        context.error('Error in emailExaminationReport:', error);
        return handleError(error, context);
    }
}

app.http('EmailExaminationReport', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/examinations/{id}/email-report',
    handler: emailExaminationReport
});

// Made with Bob