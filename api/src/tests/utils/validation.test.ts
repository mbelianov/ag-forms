declare const describe: any;
declare const test: any;
declare const expect: any;

import { validateUser, validatePatient, validateExamination, validateLogin, validateRegister } from '../../utils/validation';

describe('Validation Utilities', () => {
    describe('validateUser', () => {
        test('should accept valid user data', () => {
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                fullName: 'Doctor User',
                email: 'doctor@example.com',
                role: 'doctor'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject invalid username characters', () => {
            const result = validateUser({
                username: 'doctor user',
                password: 'StrongPassword123!',
                fullName: 'Doctor User',
                email: 'doctor@example.com',
                role: 'doctor'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
        });

        test('should reject invalid role', () => {
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                fullName: 'Doctor User',
                email: 'doctor@example.com',
                role: 'superadmin'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Role must be one of: admin, doctor, viewer');
        });

        test('should reject invalid email', () => {
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                fullName: 'Doctor User',
                email: 'not-an-email',
                role: 'doctor'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Email must be a valid email address');
        });
    });

    describe('validateUser — fullName optional', () => {
        test('should accept missing fullName (fullName is optional in schema)', () => {
            // The userSchema defines fullName as optional() — it is not required at the schema level.
            // Callers that want to enforce fullName (e.g. UI) do so outside validation.
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                email: 'doctor@example.com',
                role: 'doctor'
            });

            expect(result.valid).toBe(true);
        });
    });

    describe('validateRegister', () => {
        test('should accept valid registration payload', () => {
            const result = validateRegister({
                username: 'register_user',
                password: 'StrongPassword123!',
                email: 'register@example.com',
                role: 'viewer'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject missing username', () => {
            const result = validateRegister({
                password: 'StrongPassword123!',
                email: 'register@example.com',
                role: 'viewer'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Username is required');
        });

        test('should reject missing password', () => {
            const result = validateRegister({
                username: 'register_user',
                email: 'register@example.com',
                role: 'viewer'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password is required');
        });

        test('should reject missing email', () => {
            const result = validateRegister({
                username: 'register_user',
                password: 'StrongPassword123!',
                role: 'viewer'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Email is required');
        });

        test('should reject short password', () => {
            const result = validateRegister({
                username: 'register_user',
                password: 'Short123!',
                email: 'register@example.com',
                role: 'viewer'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 12 characters long');
        });

        test('should reject invalid role', () => {
            const result = validateRegister({
                username: 'register_user',
                password: 'StrongPassword123!',
                email: 'register@example.com',
                role: 'superadmin'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Role must be one of: admin, doctor, viewer');
        });
    });

    describe('validatePatient', () => {
        test('should accept valid patient data', () => {
            const result = validatePatient({
                name: 'Maria Petrova',
                age: 28,
                phone: '+359888123456',
                email: 'maria@example.com',
                address: 'Sofia'
            });

            expect(result.valid).toBe(true);
        });

        test('should reject age below minimum boundary', () => {
            const result = validatePatient({
                name: 'Maria Petrova',
                age: 1,
                phone: '+359888123456'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Age must be between 2 and 99 years');
        });

        test('should reject age above maximum boundary', () => {
            const result = validatePatient({
                name: 'Maria Petrova',
                age: 100,
                phone: '+359888123456'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Age must be between 2 and 99 years');
        });

        test('should accept boundary ages 2 and 99', () => {
            const minResult = validatePatient({
                name: 'Min Age',
                age: 2,
                phone: '+359888123456'
            });

            const maxResult = validatePatient({
                name: 'Max Age',
                age: 99,
                phone: '+359888123456'
            });

            expect(minResult.valid).toBe(true);
            expect(maxResult.valid).toBe(true);
        });

        test('should reject invalid phone number', () => {
            const result = validatePatient({
                name: 'Maria Petrova',
                age: 28,
                phone: 'invalid-phone'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Phone must be a valid phone number');
        });
    });

    describe('validateExamination', () => {
        test('should accept valid examination data', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                gestationalAge: '28w 3d',
                status: 'draft',
                biometry: {
                    bpd: 70,
                    hc: 250,
                    ac: 220,
                    fl: 50,
                    efw: 1200
                },
                doppler: {
                    pi: 1.2,
                    ri: 0.7,
                },
                notes: 'Normal notes',
                findings: 'Normal findings'
            });

            expect(result.valid).toBe(true);
        });

        test('should accept persisted prenatal derived biometry fields', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                gestationalAge: '28w 3d',
                gestationalAgeIsManual: true,
                status: 'draft',
                biometry: {
                    bpdGa: '28w 1d',
                    ofdGa: '28w 2d',
                    hcGa: '28w 3d',
                    acGa: '28w 4d',
                    flGa: '28w 5d',
                    efwGa: '28w 6d',
                    bpdPercentile: 45,
                    hcPercentile: 55,
                    acPercentile: 65,
                    flPercentile: 35,
                    ofdPercentile: 50,
                    efwPercentile: 60,
                    bpdGaIsManual: true,
                    bpdPercentileIsManual: true,
                },
                data: {
                    ft_biometry: {
                        gaFromCrl: '12w 3d',
                        gaFromCrlIsManual: true,
                        gaFromBio: '12w 3d',
                    }
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should reject future exam date', () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: futureDate,
                status: 'draft'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Exam date cannot be in the future');
        });

        test('should reject invalid gestational age format', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                gestationalAge: '28 weeks',
                status: 'draft'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Gestational age must be in format "28w 3d" or "28с 3д"');
        });

        test('should accept float biometry values', () => {
            // Float biometry values are now valid (migration from integer-only constraint)
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                biometry: {
                    bpd: 70.5
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should reject out-of-range float biometry values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                biometry: {
                    bpd: 999.9
                }
            });

            expect(result.valid).toBe(false);
        });

        test('should accept float doppler values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'completed',
                doppler: {
                    pi: 1.35,
                    ri: 0.68
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should reject invalid status', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'archived'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Status must be one of: draft, completed, reviewed');
        });

        test('should reject RI above 1', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                doppler: {
                    ri: 1.2
                }
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('RI must be between 0 and 1');
        });

        test('should accept RI lower boundary 0', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                doppler: {
                    ri: 0
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should accept RI upper boundary 1', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                doppler: {
                    ri: 1
                }
            });

            expect(result.valid).toBe(true);
        });
    });

    describe('validateExamination — gestationalAgeIsManual', () => {
        test('should accept gestationalAgeIsManual when gestationalAge is provided', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                gestationalAge: '28w 3d',
                gestationalAgeIsManual: true,
                status: 'draft'
            });

            expect(result.valid).toBe(true);
        });
    });

    describe('validateLogin', () => {
        test('should accept valid login payload', () => {
            const result = validateLogin({
                username: 'doctor_user',
                password: 'StrongPassword123!'
            });

            expect(result.valid).toBe(true);
        });

        test('should reject missing username', () => {
            const result = validateLogin({
                password: 'StrongPassword123!'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Username is required');
        });

        test('should reject missing password', () => {
            const result = validateLogin({
                username: 'doctor_user'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password is required');
        });
    });
});

// Made with Bob
