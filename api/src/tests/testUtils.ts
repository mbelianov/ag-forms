declare const jest: any;
import { HttpRequest, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../utils/tokenService';
import { hashPassword } from '../utils/passwordService';
import { ensureTableExists, getTableClient } from '../utils/tableClient';
import { User, Patient, Examination, Counter } from '../types';

const USERS_TABLE = 'Users';
const PATIENTS_TABLE = 'Patients';
const EXAMINATIONS_TABLE = 'Examinations';
const COUNTERS_TABLE = 'Counters';
const AUDIT_TABLE = 'AuditLogs';

const trackedUsers: string[] = [];
const trackedPatients: string[] = [];
const trackedExaminations: Array<{ examinationId: string; patientId: string; rowKey: string }> = [];
const trackedCounters: string[] = [];

export function mockTableClient() {
    return {
        createEntity: jest.fn(),
        getEntity: jest.fn(),
        updateEntity: jest.fn(),
        deleteEntity: jest.fn(),
        upsertEntity: jest.fn(),
        listEntities: jest.fn()
    };
}

export async function createTestUser(role: string = 'admin'): Promise<{ user: User & any; token: string; password: string }> {
    await ensureTableExists(USERS_TABLE);

    const usersTable = getTableClient(USERS_TABLE);
    const userId = uuidv4();
    const username = `test_${role}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const normalizedUsername = username.toLowerCase();
    const password = 'TestPassword123!';
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    const userEntity: User & {
        normalizedUsername: string;
        isDeleted: boolean;
        failedLoginAttempts: number;
        lockedUntil?: string;
    } = {
        partitionKey: 'USER',
        rowKey: userId,
        userId,
        username,
        normalizedUsername,
        passwordHash,
        email: `${username}@example.com`,
        role: role as any,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        isDeleted: false,
        failedLoginAttempts: 0
    };

    const usernameLookup = {
        partitionKey: 'USERNAME',
        rowKey: normalizedUsername,
        userId,
        username,
        createdAt: now
    };

    await usersTable.createEntity(userEntity);
    await usersTable.createEntity(usernameLookup);

    trackedUsers.push(userId);

    return {
        user: userEntity,
        token: generateToken(userId, username, role),
        password
    };
}

export async function createTestPatient(createdByRole: string = 'doctor'): Promise<Patient & any> {
    await ensureTableExists(PATIENTS_TABLE);

    const creator = await createTestUser(createdByRole);
    const patientsTable = getTableClient(PATIENTS_TABLE);
    const patientId = uuidv4();
    const now = new Date().toISOString();
    const mrn = `MRN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`;
    const name = `Test Patient ${Date.now()}`;

    const patientEntity: Patient & { createdBy: string; updatedBy: string } = {
        partitionKey: 'PATIENT',
        rowKey: patientId,
        patientId,
        name,
        age: 30,
        phone: '+359888123456',
        email: 'patient@example.com',
        address: 'Sofia',
        mrn,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        createdBy: creator.user.userId,
        updatedBy: creator.user.userId
    };

    const mrnLookup = {
        partitionKey: 'MRN',
        rowKey: mrn,
        mrn,
        patientId,
        createdAt: now
    };

    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const searchEntity = {
        partitionKey: `PATIENT_SEARCH_${normalizedName.charAt(0)}`,
        rowKey: `${normalizedName}_${patientId}`,
        patientId,
        name,
        normalizedName,
        mrn,
        createdAt: now
    };

    await patientsTable.createEntity(patientEntity);
    await patientsTable.createEntity(mrnLookup);
    await patientsTable.createEntity(searchEntity);

    trackedPatients.push(patientId);

    return patientEntity;
}

export async function createTestExamination(patientId: string): Promise<Examination & any> {
    await ensureTableExists(EXAMINATIONS_TABLE);

    const creator = await createTestUser('doctor');
    const examinationsTable = getTableClient(EXAMINATIONS_TABLE);
    const patientsTable = getTableClient(PATIENTS_TABLE);
    const examinationId = uuidv4();
    const now = new Date().toISOString();
    const reverseTicks = 9999999999999 - Date.now();
    const rowKey = `${reverseTicks}_${examinationId}`;
    const patient = await patientsTable.getEntity<any>('PATIENT', patientId);

    const examinationEntity: Examination & { updatedBy: string } = {
        partitionKey: `PATIENT_${patientId}`,
        rowKey,
        examinationId,
        patientId,
        patientName: patient?.name || 'Test Patient',
        examDate: new Date().toISOString(),
        gestationalAge: '28w 3d',
        status: 'draft',
        biometry: JSON.stringify({
            bpd: 70,
            hc: 250,
            ac: 220,
            fl: 50
        }) as any,
        doppler: JSON.stringify({
            pi: 1.2,
            ri: 0.7,
            vessel: 'Umbilical Artery'
        }) as any,
        findings: 'Normal findings',
        notes: 'Test notes',
        createdAt: now,
        updatedAt: now,
        createdBy: creator.user.userId,
        updatedBy: creator.user.userId,
        isDeleted: false
    };

    const lookupEntity = {
        ...examinationEntity,
        partitionKey: 'EXAM',
        rowKey: examinationId
    };

    await examinationsTable.createEntity(examinationEntity);
    await examinationsTable.createEntity(lookupEntity);

    trackedExaminations.push({ examinationId, patientId, rowKey });

    return {
        ...lookupEntity,
        biometry: JSON.parse(lookupEntity.biometry as any),
        doppler: JSON.parse(lookupEntity.doppler as any)
    } as Examination & any;
}

export async function cleanupTestData(): Promise<void> {
    await ensureTableExists(USERS_TABLE);
    await ensureTableExists(PATIENTS_TABLE);
    await ensureTableExists(EXAMINATIONS_TABLE);
    await ensureTableExists(COUNTERS_TABLE);
    await ensureTableExists(AUDIT_TABLE);

    const usersTable = getTableClient(USERS_TABLE);
    const patientsTable = getTableClient(PATIENTS_TABLE);
    const examinationsTable = getTableClient(EXAMINATIONS_TABLE);
    const countersTable = getTableClient(COUNTERS_TABLE);

    for (const exam of trackedExaminations.splice(0)) {
        try {
            await examinationsTable.deleteEntity('EXAM', exam.examinationId, { etag: '*' });
        } catch {}
        try {
            await examinationsTable.deleteEntity(`PATIENT_${exam.patientId}`, exam.rowKey, { etag: '*' });
        } catch {}
    }

    for (const patientId of trackedPatients.splice(0)) {
        try {
            const patient = await patientsTable.getEntity<any>('PATIENT', patientId);
            if (patient) {
                const normalizedName = patient.name.trim().toLowerCase().replace(/\s+/g, ' ');
                await patientsTable.deleteEntity('PATIENT', patientId, { etag: '*' });
                await patientsTable.deleteEntity('MRN', patient.mrn, { etag: '*' });
                await patientsTable.deleteEntity(`PATIENT_SEARCH_${normalizedName.charAt(0)}`, `${normalizedName}_${patientId}`, { etag: '*' });
            }
        } catch {}
    }

    for (const userId of trackedUsers.splice(0)) {
        try {
            const user = await usersTable.getEntity<any>('USER', userId);
            if (user) {
                await usersTable.deleteEntity('USER', userId, { etag: '*' });
                await usersTable.deleteEntity('USERNAME', user.normalizedUsername, { etag: '*' });
            }
        } catch {}
    }

    for (const counterRowKey of trackedCounters.splice(0)) {
        try {
            await countersTable.deleteEntity('COUNTER', counterRowKey, { etag: '*' });
        } catch {}
    }

    try {
        await countersTable.deleteEntity('COUNTER', `MRN_${new Date().getFullYear()}`, { etag: '*' });
    } catch {}
}

export function mockHttpRequest(method: string, body?: any, headers?: any): HttpRequest {
    const normalizedHeaders = new Map<string, string>();
    const inputHeaders = headers || {};

    Object.keys(inputHeaders).forEach((key) => {
        normalizedHeaders.set(key.toLowerCase(), inputHeaders[key]);
    });

    return {
        method,
        url: 'http://localhost:7071/api/test',
        headers: {
            get: (name: string) => normalizedHeaders.get(name.toLowerCase()) || null
        },
        query: new URLSearchParams(),
        params: {},
        json: async () => body,
        text: async () => JSON.stringify(body || {})
    } as any;
}

export async function seedCounter(value: number, year: number = new Date().getFullYear()): Promise<Counter> {
    await ensureTableExists(COUNTERS_TABLE);

    const countersTable = getTableClient(COUNTERS_TABLE);
    const rowKey = `MRN_${year}`;
    const existing = await countersTable.getEntity<any>('COUNTER', rowKey).catch(() => null);

    if (existing) {
        existing.value = value;
        existing.lastUpdated = new Date().toISOString();
        await countersTable.updateEntity(existing, 'Merge');
        if (!trackedCounters.includes(rowKey)) {
            trackedCounters.push(rowKey);
        }
        return existing as Counter;
    }

    const counter: Counter = {
        partitionKey: 'COUNTER',
        rowKey,
        counterType: rowKey,
        value,
        lastUpdated: new Date().toISOString()
    };

    await countersTable.createEntity(counter);
    trackedCounters.push(rowKey);

    return counter;
}

export function mockInvocationContext(): InvocationContext {
    return {
        invocationId: uuidv4(),
        functionName: 'test-function',
        extraInputs: new Map(),
        extraOutputs: new Map(),
        traceContext: {
            traceParent: '',
            traceState: '',
            attributes: {}
        },
        retryContext: undefined,
        options: {},
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    } as any;
}

// Made with Bob
