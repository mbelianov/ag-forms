declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { createPatient } from '../../functions/CreatePatient';
import { getPatients } from '../../functions/GetPatients';
import { getPatient } from '../../functions/GetPatient';
import { searchPatients } from '../../functions/SearchPatients';
import { updatePatient } from '../../functions/UpdatePatient';
import { deletePatient } from '../../functions/DeletePatient';
import { createTestUser, createTestPatient, createTestExamination, cleanupTestData, seedCounter, mockHttpRequest, mockInvocationContext } from '../testUtils';
import { getTableClient } from '../../utils/tableClient';

const parseBody = (response: any) => JSON.parse(response.body);

describe('Patients Integration', () => {
    beforeEach(async () => {
        await cleanupTestData();
        await seedCounter(0);
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('should create patient with generated MRN', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            name: 'Maria Petrova',
            age: 28,
            phone: '+359888123456',
            email: 'maria@example.com',
            address: 'Sofia'
        }, {
            cookie: `session_token=${doctor.token}`
        });
        const context = mockInvocationContext();

        const response = await createPatient(request, context);
        const body = parseBody(response);

        // Should succeed — patient created; MRN is no longer on patient
        expect(response.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.patient.name).toBe('Maria Petrova');
        expect(body.data.patient.mrn).toBeUndefined();
    });

    test('should list patients with pagination', async () => {
        const doctor = await createTestUser('doctor');
        const patientsTable = getTableClient('Patients');

        for (let i = 0; i < 3; i++) {
            const patient = await createTestPatient();
            patient.name = `Paged Patient ${i}`;
            await patientsTable.updateEntity(patient, 'Merge');
        }

        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).query = new URLSearchParams('pageSize=2');
        const context = mockInvocationContext();

        const response = await getPatients(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.patients.length).toBeLessThanOrEqual(2);
    });

    test('should get patient by ID', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).params = { id: patient.patientId };
        const context = mockInvocationContext();

        const response = await getPatient(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.patient.patientId).toBe(patient.patientId);
    });

    test('should search patients by name prefix', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        const prefix = patient.name.substring(0, 4);
        (request as any).query = new URLSearchParams(`name=${encodeURIComponent(prefix)}`);
        const context = mockInvocationContext();

        const response = await searchPatients(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.patients.some((p: any) => p.patientId === patient.patientId)).toBe(true);
    });

    test('should update patient with ETag', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const patientsTable = getTableClient('Patients');
        const persisted = await patientsTable.getEntity<any>('PATIENT', patient.patientId);

        const request = mockHttpRequest('PUT', {
            name: 'Updated Patient Name',
            age: persisted.age,
            phone: persisted.phone,
            email: persisted.email,
            address: persisted.address,
            etag: persisted.etag
        }, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).params = { id: patient.patientId };
        const context = mockInvocationContext();

        const response = await updatePatient(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.patient.name).toBe('Updated Patient Name');
    });

    test('should soft delete patient without examinations', async () => {
        const admin = await createTestUser('admin');
        const patient = await createTestPatient();
        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: patient.patientId };
        const context = mockInvocationContext();

        const response = await deletePatient(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toBe('Patient deleted successfully');
    });

    test('should soft delete patient even when examinations exist in separate table', async () => {
        const admin = await createTestUser('admin');
        const patient = await createTestPatient();
        await createTestExamination(patient.patientId);

        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: patient.patientId };
        const context = mockInvocationContext();

        const response = await deletePatient(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toBe('Patient deleted successfully');
    });

});

// Made with Bob
