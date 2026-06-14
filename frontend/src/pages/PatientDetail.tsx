import React from 'react';
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
import { ArrowLeft, Edit } from '@carbon/icons-react';
import { usePatients } from '../hooks/usePatients';
import { format } from 'date-fns';

const PatientDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentPatient, isLoading, error, fetchPatient } = usePatients();

    React.useEffect(() => {
        if (id) {
            fetchPatient(id);
        }
    }, [id, fetchPatient]);

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
                            <p>Examination history will be displayed here.</p>
                            <p style={{ marginTop: '1rem', color: '#6f6f6f' }}>
                                This feature will be implemented when the examination management UI is complete.
                            </p>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    );
};

export default PatientDetail;

// Made with Bob
