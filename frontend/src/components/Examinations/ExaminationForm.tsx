import React, { useEffect, useCallback } from 'react';
import {
    Form,
    TextInput,
    TextArea,
    DatePicker,
    DatePickerInput,
    Select,
    SelectItem,
    Button,
    Stack,
    InlineNotification,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Loading,
} from '@carbon/react';
import type { Examination, Patient, CreateExaminationRequest, UpdateExaminationRequest, CalculateExaminationResponse } from '../../types';
import { BiometryFields } from './BiometryFields';
import { DopplerFields } from './DopplerFields';
import { calculateExamination } from '../../api/examinations';

interface ExaminationFormProps {
    examination?: Examination;
    patients: Patient[];
    onSubmit: (data: CreateExaminationRequest | UpdateExaminationRequest) => Promise<void>;
    onCancel: () => void;
}

export const ExaminationForm: React.FC<ExaminationFormProps> = ({
    examination,
    patients,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] = React.useState({
        patientId: examination?.patientId || '',
        examDate: examination?.examDate || new Date().toISOString().split('T')[0],
        gestationalAge: examination?.gestationalAge || '',
        biometry: examination?.biometry || {},
        doppler: examination?.doppler || {},
        findings: examination?.findings || '',
        status: examination?.status || 'draft',
    });
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [calculations, setCalculations] = React.useState<CalculateExaminationResponse['calculations'] | null>(null);
    const [isCalculating, setIsCalculating] = React.useState(false);

    // Debounced calculation function
    const performCalculation = useCallback(async (biometry: any, gestationalAge?: string) => {
        // Only calculate if we have at least one biometry value
        const hasValues = biometry.bpd || biometry.hc || biometry.ac || biometry.fl;
        if (!hasValues) {
            setCalculations(null);
            return;
        }

        setIsCalculating(true);
        try {
            const result = await calculateExamination({
                biometry,
                gestationalAge,
            });
            setCalculations(result.calculations);
        } catch (err) {
            console.error('Calculation error:', err);
            // Don't show error to user, just clear calculations
            setCalculations(null);
        } finally {
            setIsCalculating(false);
        }
    }, []);

    // Trigger calculations when biometry or gestational age changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performCalculation(formData.biometry, formData.gestationalAge);
        }, 500); // Debounce for 500ms

        return () => clearTimeout(timeoutId);
    }, [formData.biometry, formData.gestationalAge, performCalculation]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // Include calculated EFW in biometry if available
            const submissionData = {
                ...formData,
                biometry: {
                    ...formData.biometry,
                    ...(calculations?.estimatedFetalWeight && {
                        efw: calculations.estimatedFetalWeight,
                    }),
                },
            };
            await onSubmit(submissionData);
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.message || 'Failed to save examination');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Stack gap={6}>
                {error && (
                    <InlineNotification
                        kind="error"
                        title="Error"
                        subtitle={error}
                        onClose={() => setError(null)}
                    />
                )}

                <Select
                    id="patientId"
                    labelText="Patient"
                    value={formData.patientId}
                    onChange={(e) =>
                        setFormData({ ...formData, patientId: e.target.value })
                    }
                    required
                    disabled={!!examination}
                >
                    <SelectItem value="" text="Select a patient" />
                    {patients.map((patient) => (
                        <SelectItem
                            key={patient.patientId}
                            value={patient.patientId}
                            text={`${patient.name} (${patient.mrn})`}
                        />
                    ))}
                </Select>

                <DatePicker
                    datePickerType="single"
                    value={formData.examDate}
                    onChange={(dates: Date[]) => {
                        if (dates[0]) {
                            setFormData({
                                ...formData,
                                examDate: dates[0].toISOString().split('T')[0],
                            });
                        }
                    }}
                >
                    <DatePickerInput
                        id="examDate"
                        labelText="Examination Date"
                        placeholder="dd/mm/yyyy"
                    />
                </DatePicker>

                <TextInput
                    id="gestationalAge"
                    labelText="Gestational Age (Optional)"
                    placeholder="e.g., 28w 3d"
                    value={formData.gestationalAge}
                    onChange={(e) =>
                        setFormData({ ...formData, gestationalAge: e.target.value })
                    }
                    helperText="Format: weeks and days (e.g., 28w 3d)"
                />

                <Tabs>
                    <TabList aria-label="Examination data tabs">
                        <Tab>Biometry</Tab>
                        <Tab>Doppler</Tab>
                        <Tab>Findings</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <BiometryFields
                                biometry={formData.biometry}
                                onChange={(biometry) =>
                                    setFormData({ ...formData, biometry })
                                }
                                calculations={calculations}
                                isCalculating={isCalculating}
                            />
                        </TabPanel>
                        <TabPanel>
                            <DopplerFields
                                doppler={formData.doppler}
                                onChange={(doppler) =>
                                    setFormData({ ...formData, doppler })
                                }
                            />
                        </TabPanel>
                        <TabPanel>
                            <TextArea
                                id="findings"
                                labelText="Clinical Findings"
                                placeholder="Enter examination findings..."
                                value={formData.findings}
                                onChange={(e) =>
                                    setFormData({ ...formData, findings: e.target.value })
                                }
                                rows={8}
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>

                <Select
                    id="status"
                    labelText="Status"
                    value={formData.status}
                    onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as any })
                    }
                >
                    <SelectItem value="draft" text="Draft" />
                    <SelectItem value="completed" text="Completed" />
                    <SelectItem value="reviewed" text="Reviewed" />
                </Select>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="submit" disabled={isSubmitting}>
                        {examination ? 'Update Examination' : 'Create Examination'}
                    </Button>
                    <Button kind="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </Stack>
        </Form>
    );
};

// Made with Bob
