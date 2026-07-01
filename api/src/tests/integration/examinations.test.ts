declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { createExamination } from '../../functions/CreateExamination';
import { getExaminations } from '../../functions/GetExaminations';
import { getExamination } from '../../functions/GetExamination';
import { getExaminationByMRN } from '../../functions/GetExaminationByMRN';
import { updateExamination } from '../../functions/UpdateExamination';
import { deleteExamination } from '../../functions/DeleteExamination';
import { calculateExamination } from '../../functions/CalculateExamination';
import { emailExaminationReport } from '../../functions/EmailExaminationReport';
import { createTestUser, createTestPatient, createTestExamination, cleanupTestData, mockHttpRequest, mockInvocationContext } from '../testUtils';
import { getTableClient } from '../../utils/tableClient';

const parseBody = (response: any) => JSON.parse(response.body);

describe('Examinations Integration', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('should create examination with reverse ticks row key', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const request = mockHttpRequest('POST', {
            patientId: patient.patientId,
            examDate: new Date().toISOString(),
            gestationalAge: '28w 3d',
            status: 'draft',
            biometry: {
                bpd: 70,
                hc: 250,
                ac: 220,
                fl: 50
            },
            doppler: {
                pi: 1.2,
                ri: 0.7,
                vessel: 'Umbilical Artery'
            },
            findings: 'Normal findings',
            notes: 'Test notes'
        }, {
            authorization: `Bearer ${doctor.token}`
        });
        const context = mockInvocationContext();

        const response = await createExamination(request, context);
        const body = parseBody(response);

        // Should succeed — examination created with MRN
        expect(response.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.examination.patientId).toBe(patient.patientId);
        expect(body.data.examination.mrn).toMatch(/^MRN-[a-z0-9-]{1,20}-\d{4}-\d{6}$/);
    });

    test('should list examinations for all and by patient', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const allRequest = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        const patientRequest = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (patientRequest as any).query = new URLSearchParams(`patientId=${patient.patientId}`);
        const context = mockInvocationContext();

        const allResponse = await getExaminations(allRequest, context);
        const patientResponse = await getExaminations(patientRequest, context);
        const allBody = parseBody(allResponse);
        const patientBody = parseBody(patientResponse);

        expect(allResponse.status).toBe(200);
        expect(patientResponse.status).toBe(200);
        expect(allBody.data.examinations.some((e: any) => e.examinationId === examination.examinationId)).toBe(true);
        expect(patientBody.data.examinations.every((e: any) => e.patientId === patient.patientId)).toBe(true);
    });

    test('should get examination by ID', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await getExamination(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.examination.examinationId).toBe(examination.examinationId);
    });

    test('should update examination with ETag', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);
        const table = getTableClient('Examinations');
        const persisted = await table.getEntity<any>('EXAM', examination.examinationId);

        const request = mockHttpRequest('PUT', {
            examDate: persisted.examDate,
            gestationalAge: persisted.gestationalAge,
            biometry: examination.biometry,
            doppler: examination.doppler,
            findings: persisted.findings,
            status: 'completed',
            notes: 'Updated notes',
            etag: persisted.etag
        }, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await updateExamination(request, context);
        const body = parseBody(response);

        // Should succeed — examination updated
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.examination.status).toBe('completed');
    });

    test('should soft delete examination as admin', async () => {
        const admin = await createTestUser('admin');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const request = mockHttpRequest('DELETE', undefined, {
            authorization: `Bearer ${admin.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await deleteExamination(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toBe('Examination deleted successfully');
    });

    test('should calculate examination EFW and GA', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);
        const table = getTableClient('Examinations');
        const persisted = await table.getEntity<any>('EXAM', examination.examinationId);

        persisted.gestationalAge = undefined;
        persisted.biometry = JSON.stringify({ bpd: 70, hc: 250, ac: 220, fl: 50 });
        await table.updateEntity(persisted, 'Merge');

        const request = mockHttpRequest('POST', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await calculateExamination(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.examination.gestationalAge).toBeDefined();
    });

    test('should simulate email report sending', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const request = mockHttpRequest('POST', {
            pdfData: Buffer.from('fake-pdf-content').toString('base64')
        }, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await emailExaminationReport(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toContain('Email simulated successfully');
        expect(body.data.details.mode).toBe('simulation');
    });

    test('should reject non-admin deletion', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const request = mockHttpRequest('DELETE', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { id: examination.examinationId };
        const context = mockInvocationContext();

        const response = await deleteExamination(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toBe('Admin role required to delete examinations');
    });

    test('should get examination by MRN', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const examination = await createTestExamination(patient.patientId);

        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { mrn: examination.mrn };
        const context = mockInvocationContext();

        const response = await getExaminationByMRN(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.examination.examinationId).toBe(examination.examinationId);
        expect(body.data.examination.mrn).toBe(examination.mrn);
    });

    test('should reject invalid MRN format on GetExaminationByMRN', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).params = { mrn: 'bad-mrn' };
        const context = mockInvocationContext();

        const response = await getExaminationByMRN(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toBe('Invalid MRN format');
    });

    test('should reject invalid page size', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${doctor.token}`
        });
        (request as any).query = new URLSearchParams('pageSize=0');
        const context = mockInvocationContext();

        const response = await getExaminations(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toBe('Page size must be a positive number');
    });
});

// Made with Bob
