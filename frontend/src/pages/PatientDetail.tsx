import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    Button,
    Loading,
    InlineNotification,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
} from '@carbon/react';
import { ArrowLeft, Edit, Add } from '@carbon/icons-react';
import { usePatients } from '../hooks/usePatients';
import { useExaminations } from '../hooks/useExaminations';
import { ExaminationList } from '../components/Examinations/ExaminationList';
import { format } from 'date-fns';

const PatientDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentPatient, isLoading: isLoadingPatient, error: patientError, fetchPatient } = usePatients();
    const {
        examinations,
        isLoading: isLoadingExams,
        error: examsError,
        fetchExaminations,
        deleteExamination
    } = useExaminations();

    useEffect(() => {
        if (id) {
            fetchPatient(id);
            // Fetch examinations for this patient
            fetchExaminations({ patientId: id });
        }
    }, [id, fetchPatient, fetchExaminations]);

    const handleDeleteExamination = async (exam: any) => {
        try {
            await deleteExamination(exam.examinationId, exam.etag);
            // Refresh examinations list
            fetchExaminations({ patientId: id });
        } catch (error) {
            console.error('Failed to delete examination:', error);
            throw error;
        }
    };

    const isLoading = isLoadingPatient || isLoadingExams;
    const error = patientError || examsError;

    if (isLoading) {
        return <Loading description="Loading patient details..." />;
    }

    if (error || !currentPatient) {
        return (
            <div style={{ padding: '2rem' }}>
                <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error || 'Patient not found'}
                />
                <Button onClick={() => navigate('/patients')} style={{ marginTop: '1rem' }}>
                    Back to Patients
                </Button>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            <Breadcrumb>
                <BreadcrumbItem href="/patients">Patients</BreadcrumbItem>
                <BreadcrumbItem isCurrentPage>{currentPatient.name}</BreadcrumbItem>
            </Breadcrumb>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <h1>{currentPatient.name}</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button
                        kind="secondary"
                        renderIcon={ArrowLeft}
                        onClick={() => navigate('/patients')}
                    >
                        Back
                    </Button>
                    <Button
                        kind="primary"
                        renderIcon={Edit}
                        onClick={() => navigate(`/patients/${id}/edit`)}
                    >
                        Edit
                    </Button>
                </div>
            </div>

            <Tabs>
                <TabList aria-label="Patient details tabs">
                    <Tab>Details</Tab>
                    <Tab>Examinations</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
                                <dt><strong>MRN:</strong></dt>
                                <dd>{currentPatient.mrn}</dd>

                                <dt><strong>Age:</strong></dt>
                                <dd>{currentPatient.age} years</dd>

                                <dt><strong>Phone:</strong></dt>
                                <dd>{currentPatient.phone}</dd>

                                <dt><strong>Email:</strong></dt>
                                <dd>{currentPatient.email || '-'}</dd>

                                <dt><strong>Address:</strong></dt>
                                <dd>{currentPatient.address || '-'}</dd>

                                <dt><strong>Created:</strong></dt>
                                <dd>{format(new Date(currentPatient.createdAt), 'dd/MM/yyyy HH:mm')}</dd>

                                {currentPatient.updatedAt && (
                                    <>
                                        <dt><strong>Last Updated:</strong></dt>
                                        <dd>{format(new Date(currentPatient.updatedAt), 'dd/MM/yyyy HH:mm')}</dd>
                                    </>
                                )}
                            </dl>
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            {isLoadingExams ? (
                                <Loading description="Loading examinations..." />
                            ) : examsError ? (
                                <InlineNotification
                                    kind="error"
                                    title="Error"
                                    subtitle={examsError}
                                    lowContrast
                                />
                            ) : examinations.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <p style={{ marginBottom: '1rem', color: '#6f6f6f' }}>
                                        No examinations found for this patient.
                                    </p>
                                    <Button
                                        kind="primary"
                                        renderIcon={Add}
                                        onClick={() => navigate(`/examinations/new?patientId=${id}`)}
                                    >
                                        Create First Examination
                                    </Button>
                                </div>
                            ) : (
                                <ExaminationList
                                    examinations={examinations}
                                    onView={(exam) => navigate(`/examinations/${exam.examinationId}`)}
                                    onEdit={(exam) => navigate(`/examinations/${exam.examinationId}/edit`)}
                                    onAdd={() => navigate(`/examinations/new?patientId=${id}`)}
                                    onDelete={handleDeleteExamination}
                                />
                            )}
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    );
};

export default PatientDetail;

// Made with Bob
