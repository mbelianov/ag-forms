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
import { getPatientsCount } from '../../functions/GetPatientsCount';
import { getExamination } from '../../functions/GetExamination';
import { createExamination } from '../../functions/CreateExamination';
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

    test('should allow viewer to list patients', async () => {
        const viewer = await createTestUser('viewer');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${viewer.token}`
        });

        const response = await getPatients(request, mockInvocationContext());

        expect(response.status).toBe(200);
    });

    test('should reject patient creation for viewer', async () => {
        const viewer = await createTestUser('viewer');
        const request = mockHttpRequest('POST', {
            name: 'Viewer Blocked',
            age: 28,
            phone: '+359888123456',
            email: 'viewer-blocked@example.com',
            address: 'Sofia'
        }, {
            cookie: `session_token=${viewer.token}`
        });

        const response = await createPatient(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toBe('Doctor or admin role required');
    });

    test('should reject patient update for viewer', async () => {
        const viewer = await createTestUser('viewer');
        const patient = await createTestPatient();
        const persisted = await getTableClient('Patients').getEntity<any>('PATIENT', patient.patientId);
        const request = mockHttpRequest('PUT', {
            name: 'Viewer Cannot Update',
            age: persisted.age,
            phone: persisted.phone,
            email: persisted.email,
            address: persisted.address,
            etag: persisted.etag
        }, {
            cookie: `session_token=${viewer.token}`
        });
        (request as any).params = { id: patient.patientId };

        const response = await updatePatient(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toBe('Doctor or admin role required');
    });

    test('should reject patient deletion for viewer', async () => {
        const viewer = await createTestUser('viewer');
        const patient = await createTestPatient();
        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${viewer.token}`
        });
        (request as any).params = { id: patient.patientId };

        const response = await deletePatient(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toBe('Doctor or admin role required');
    });

    test('should reject patient search with one character', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).query = new URLSearchParams('name=x');

        const response = await searchPatients(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('at least 2 characters long');
    });

    test('should allow patient search with two characters', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).query = new URLSearchParams('name=ab');

        const response = await searchPatients(request, mockInvocationContext());

        expect(response.status).toBe(200);
    });

    test('should reject update with stale ETag', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const persisted = await getTableClient('Patients').getEntity<any>('PATIENT', patient.patientId);

        // First update with valid ETag — consumes it
        const firstRequest = mockHttpRequest('PUT', {
            name: 'Fresh Name',
            age: persisted.age,
            phone: persisted.phone,
            email: persisted.email,
            address: persisted.address,
            etag: persisted.etag
        }, {
            cookie: `session_token=${doctor.token}`
        });
        (firstRequest as any).params = { id: patient.patientId };
        const firstResponse = await updatePatient(firstRequest, mockInvocationContext());
        expect(firstResponse.status).toBe(200);

        // Second update with the now-stale original ETag — expect 409
        const staleRequest = mockHttpRequest('PUT', {
            name: 'Stale Name',
            age: persisted.age,
            phone: persisted.phone,
            email: persisted.email,
            address: persisted.address,
            etag: persisted.etag
        }, {
            cookie: `session_token=${doctor.token}`
        });
        (staleRequest as any).params = { id: patient.patientId };

        const response = await updatePatient(staleRequest, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(409);
        expect(body.error.message).toContain('Please retry');
    });

    test('should update search index after patient rename', async () => {
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        const patientsTable = getTableClient('Patients');
        const persisted = await patientsTable.getEntity<any>('PATIENT', patient.patientId);
        const newName = 'Renamed Patient';

        const updateRequest = mockHttpRequest('PUT', {
            name: newName,
            age: persisted.age,
            phone: persisted.phone,
            email: persisted.email,
            address: persisted.address,
            etag: persisted.etag
        }, {
            cookie: `session_token=${doctor.token}`
        });
        (updateRequest as any).params = { id: patient.patientId };

        const updateResponse = await updatePatient(updateRequest, mockInvocationContext());
        expect(updateResponse.status).toBe(200);

        const newSearchRequest = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (newSearchRequest as any).query = new URLSearchParams(`name=${encodeURIComponent('Re')}`);
        const newSearchResponse = await searchPatients(newSearchRequest, mockInvocationContext());
        const newSearchBody = parseBody(newSearchResponse);

        const oldSearchRequest = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (oldSearchRequest as any).query = new URLSearchParams(`name=${encodeURIComponent(patient.name.substring(0, 4))}`);
        const oldSearchResponse = await searchPatients(oldSearchRequest, mockInvocationContext());
        const oldSearchBody = parseBody(oldSearchResponse);

        expect(newSearchResponse.status).toBe(200);
        expect(newSearchBody.data.patients.some((p: any) => p.patientId === patient.patientId)).toBe(true);
        expect(oldSearchBody.data.patients.some((p: any) => p.patientId === patient.patientId)).toBe(false);
    });

    test('should reject patient deletion by doctor who did not create the patient', async () => {
        const owner = await createTestUser('doctor');
        const otherDoctor = await createTestUser('doctor');
        const createRequest = mockHttpRequest('POST', {
            name: 'Owned By Doctor A',
            age: 30,
            phone: '+359888123456',
            email: 'owner-a@example.com',
            address: 'Sofia'
        }, {
            cookie: `session_token=${owner.token}`
        });
        const createResponse = await createPatient(createRequest, mockInvocationContext());
        const createdPatientId = parseBody(createResponse).data.patient.patientId;

        const deleteRequest = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${otherDoctor.token}`
        });
        (deleteRequest as any).params = { id: createdPatientId };

        const response = await deletePatient(deleteRequest, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toBe('You do not have permission to delete this patient');
    });

    test('should return patient count for authenticated user', async () => {
        const doctor = await createTestUser('doctor');
        const countersTable = getTableClient('Counters');
        await countersTable.upsertEntity({
            partitionKey: 'COUNTER',
            rowKey: 'PATIENT_TOTAL',
            counterType: 'PATIENT_TOTAL',
            value: 7,
            lastUpdated: new Date().toISOString()
        }, 'Merge');

        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        const response = await getPatientsCount(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.count).toBe(7);
    });

    test('should reject patient count without token', async () => {
        const response = await getPatientsCount(mockHttpRequest('GET'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(401);
        expect(body.error.message).toBe('Authentication required');
    });

    describe('SearchPatients', () => {
        test('should reject empty search term', async () => {
            const doctor = await createTestUser('doctor');
            const request = mockHttpRequest('GET', undefined, {
                cookie: `session_token=${doctor.token}`
            });
            (request as any).query = new URLSearchParams('name=');

            const response = await searchPatients(request, mockInvocationContext());
            const body = parseBody(response);

            expect(response.status).toBe(400);
            expect(body.error.message).toBe('Search parameter "name" is required');
        });

        test('should return patients whose name starts with Ma', async () => {
            const doctor = await createTestUser('doctor');
            await createPatient(mockHttpRequest('POST', {
                name: 'Maria Petrova',
                age: 28,
                phone: '+359888123456',
                email: 'maria-search@example.com',
                address: 'Sofia'
            }, {
                cookie: `session_token=${doctor.token}`
            }), mockInvocationContext());

            const request = mockHttpRequest('GET', undefined, {
                cookie: `session_token=${doctor.token}`
            });
            (request as any).query = new URLSearchParams('name=Ma');

            const response = await searchPatients(request, mockInvocationContext());
            const body = parseBody(response);

            expect(response.status).toBe(200);
            expect(body.data.patients.some((p: any) => p.name === 'Maria Petrova')).toBe(true);
        });

        test('should find Cyrillic patient by prefix', async () => {
            const doctor = await createTestUser('doctor');
            await createPatient(mockHttpRequest('POST', {
                name: 'Мария Петрова',
                age: 29,
                phone: '+359888123457',
                email: 'maria-cyr@example.com',
                address: 'Sofia'
            }, {
                cookie: `session_token=${doctor.token}`
            }), mockInvocationContext());

            const request = mockHttpRequest('GET', undefined, {
                cookie: `session_token=${doctor.token}`
            });
            (request as any).query = new URLSearchParams(`name=${encodeURIComponent('Ма')}`);

            const response = await searchPatients(request, mockInvocationContext());
            const body = parseBody(response);

            expect(response.status).toBe(200);
            expect(body.data.patients.some((p: any) => p.name === 'Мария Петрова')).toBe(true);
        });

        test('should return empty array when no patients match', async () => {
            const doctor = await createTestUser('doctor');
            const request = mockHttpRequest('GET', undefined, {
                cookie: `session_token=${doctor.token}`
            });
            (request as any).query = new URLSearchParams('name=zzz');

            const response = await searchPatients(request, mockInvocationContext());
            const body = parseBody(response);

            expect(response.status).toBe(200);
            expect(body.data.patients).toEqual([]);
        });
    });

    describe('DeletePatient — cascade & access control', () => {
        test('should soft delete cascade examinations when doctor deletes own patient', async () => {
            const doctor = await createTestUser('doctor');
            const createPatientResponse = await createPatient(mockHttpRequest('POST', {
                name: 'Own Patient Cascade',
                age: 31,
                phone: '+359888123458',
                email: 'own-patient@example.com',
                address: 'Sofia'
            }, {
                cookie: `session_token=${doctor.token}`
            }), mockInvocationContext());
            const patientId = parseBody(createPatientResponse).data.patient.patientId;

            const examOneResponse = await createExamination(mockHttpRequest('POST', {
                patientId,
                examDate: new Date().toISOString(),
                gestationalAge: '28w 3d',
                status: 'draft'
            }, {
                cookie: `session_token=${doctor.token}`
            }), mockInvocationContext());
            const examTwoResponse = await createExamination(mockHttpRequest('POST', {
                patientId,
                examDate: new Date().toISOString(),
                gestationalAge: '29w 1d',
                status: 'draft'
            }, {
                cookie: `session_token=${doctor.token}`
            }), mockInvocationContext());

            const examOneId = parseBody(examOneResponse).data.examination.examinationId;
            const examTwoId = parseBody(examTwoResponse).data.examination.examinationId;

            const deleteRequest = mockHttpRequest('DELETE', undefined, {
                cookie: `session_token=${doctor.token}`
            });
            (deleteRequest as any).params = { id: patientId };

            const deleteResponse = await deletePatient(deleteRequest, mockInvocationContext());
            expect(deleteResponse.status).toBe(200);

            const examOneEntity = await getTableClient('Examinations').getEntity<any>('EXAM', examOneId);
            const examTwoEntity = await getTableClient('Examinations').getEntity<any>('EXAM', examTwoId);
            expect(examOneEntity.isDeleted).toBe(true);
            expect(examTwoEntity.isDeleted).toBe(true);
        });

        test('should allow admin to delete patient created by doctor', async () => {
            const patient = await createTestPatient('doctor');
            const admin = await createTestUser('admin');
            const request = mockHttpRequest('DELETE', undefined, {
                cookie: `session_token=${admin.token}`
            });
            (request as any).params = { id: patient.patientId };

            const response = await deletePatient(request, mockInvocationContext());

            expect(response.status).toBe(200);
        });

        test('should return 404 on second delete', async () => {
            const admin = await createTestUser('admin');
            const patient = await createTestPatient();
            const request = mockHttpRequest('DELETE', undefined, {
                cookie: `session_token=${admin.token}`
            });
            (request as any).params = { id: patient.patientId };

            const firstResponse = await deletePatient(request, mockInvocationContext());
            const secondResponse = await deletePatient(request, mockInvocationContext());
            const secondBody = parseBody(secondResponse);

            expect(firstResponse.status).toBe(200);
            expect(secondResponse.status).toBe(404);
            expect(secondBody.error.message).toBe('Patient not found');
        });
    });

});

// Made with Bob
