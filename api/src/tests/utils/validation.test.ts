declare const describe: any;
declare const test: any;
declare const expect: any;

import { validateUser, validatePatient, validateExamination, validateLogin, validateRegister } from '../../utils/validation';
// Made with Bob — ST-01 / ST-04 additions imported via the same entry-point

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

    describe('validateUser — TLD-less email (KI-007)', () => {
        test('should accept email with no public TLD (e.g. hospital.internal)', () => {
            const result = validateUser({
                username: 'admin_user',
                password: 'StrongPassword123!',
                email: 'admin@hospital.internal',
                role: 'admin'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should still accept standard email addresses', () => {
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                email: 'doctor@example.com',
                role: 'doctor'
            });

            expect(result.valid).toBe(true);
        });

        test('should still reject clearly invalid email', () => {
            const result = validateUser({
                username: 'doctor_user',
                password: 'StrongPassword123!',
                email: 'not-an-email',
                role: 'doctor'
            });

            expect(result.valid).toBe(false);
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
                data: {
                    fetuses: [
                        {
                            index: 0,
                            biometry: [
                                { type: 'bpd', value: 70, percentile: { value: 48 }, ga: { value: '28w 2d' } },
                                { type: 'hc', value: 250 },
                                { type: 'ac', value: 220 },
                                { type: 'fl', value: 50 },
                                { type: 'efw', value: 1200 }
                            ],
                            doppler: [
                                { type: 'pi', value: 1.2 },
                                { type: 'ri', value: 0.7 }
                            ]
                        }
                    ]
                },
                notes: 'Normal notes',
                findings: 'Normal findings'
            });

            expect(result.valid).toBe(true);
        });

        test('should accept Observable biometry with isManual flags', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                gestationalAge: '28w 3d',
                gestationalAgeIsManual: true,
                status: 'draft',
                data: {
                    fetuses: [
                        {
                            index: 0,
                            biometry: [
                                { type: 'bpd', value: 70, ga: { value: '28w 1d', isManual: true }, percentile: { value: 45, isManual: true } },
                                { type: 'efw', value: 1200, isManual: true }
                            ]
                        }
                    ]
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

        test('should accept float Observable values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                data: {
                    fetuses: [{ index: 0, biometry: [{ type: 'bpd', value: 70.5 }] }]
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should accept free-text string values (vp, la)', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                data: {
                    fetuses: [{ index: 0, biometry: [{ type: 'vp', value: 'normal' }, { type: 'la', value: '3.2mm' }] }]
                }
            });

            expect(result.valid).toBe(true);
        });

        test('should accept doppler Observables', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'completed',
                data: {
                    fetuses: [{ index: 0, doppler: [{ type: 'pi', value: 1.35 }, { type: 'ri', value: 0.68 }] }]
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

    describe('validateExamination — exam type keys (ST-04)', () => {
        test('should accept examinationType "prenatal"', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal'
            });

            expect(result.valid).toBe(true);
        });

        test('should accept examinationType "first_trimester"', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'first_trimester'
            });

            expect(result.valid).toBe(true);
        });

        test('should reject legacy examinationType "ultrasound_prenatal"', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'ultrasound_prenatal'
            });

            expect(result.valid).toBe(false);
        });

        test('should reject legacy examinationType "ultrasound_prenatal_twins"', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'ultrasound_prenatal_twins'
            });

            expect(result.valid).toBe(false);
        });
    });

    describe('validateExamination — V2 fetus-array data model (DF-03)', () => {
        test('should accept minimal V2 payload with data.fetuses', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{ index: 0, biometry: [], doppler: [] }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept data.pregnancyData alongside data.fetuses', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    pregnancyData: {
                        lastMenstrualPeriod: '2025-01-01',
                        obstetricHistory: 'G1P0',
                        familyHistory: 'None'
                    },
                    fetuses: [{ index: 0, biometry: [], doppler: [] }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept first_trimester exam with data.fetuses', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'first_trimester',
                data: {
                    fetuses: [{ index: 0, biometry: [], doppler: [] }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('validateExamination — Ultrasound Findings string-only contract (ST-03)', () => {
        test('should accept prenatal string-valued ultrasoundFindings', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            presentation: 'cephalic',
                            gender: 'female',
                            heart_rate: '145',
                            fetal_movement: 'active',
                            placenta: 'anterior',
                            umbilical_cord: '3 vessels'
                        }
                    }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept first_trimester string-valued ultrasoundFindings', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'first_trimester',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            placenta: 'posterior',
                            heart_rate: '162',
                            umbilical_cord: '3 vessels'
                        }
                    }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept empty string ultrasoundFindings values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            presentation: '',
                            heart_rate: ''
                        }
                    }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject numeric ultrasoundFindings values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            heart_rate: 145 as any
                        }
                    }]
                }
            });

            expect(result.valid).toBe(false);
        });

        test('should reject boolean ultrasoundFindings values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            presentation: true as any
                        }
                    }]
                }
            });

            expect(result.valid).toBe(false);
        });

        test('should reject object ultrasoundFindings values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            presentation: { nested: 'value' } as any
                        }
                    }]
                }
            });

            expect(result.valid).toBe(false);
        });

        test('should reject array ultrasoundFindings values', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'prenatal',
                data: {
                    fetuses: [{
                        index: 0,
                        ultrasoundFindings: {
                            presentation: ['cephalic'] as any
                        }
                    }]
                }
            });

            expect(result.valid).toBe(false);
        });

        test('should accept first_trimester puls observable with numeric value', () => {
            const result = validateExamination({
                patientId: 'patient-1',
                examDate: new Date().toISOString(),
                status: 'draft',
                examinationType: 'first_trimester',
                data: {
                    fetuses: [{
                        index: 0,
                        biometry: [{ type: 'puls', value: 162 }]
                    }]
                }
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
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
