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
    Tag,
} from '@carbon/react';
import { ArrowLeft, Edit, Download } from '@carbon/icons-react';
import { useExaminations } from '../hooks/useExaminations';
import { format } from 'date-fns';

const ExaminationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentExamination, isLoading, error, fetchExamination } = useExaminations();

    React.useEffect(() => {
        if (id) {
            fetchExamination(id);
        }
    }, [id, fetchExamination]);

    const getStatusTag = (status: string) => {
        const statusMap = {
            draft: { type: 'gray', label: 'Draft' },
            completed: { type: 'green', label: 'Completed' },
            reviewed: { type: 'blue', label: 'Reviewed' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
        return <Tag type={config.type as any}>{config.label}</Tag>;
    };

    if (isLoading) {
        return <Loading description="Loading examination..." />;
    }

    if (error || !currentExamination) {
        return (
            <div style={{ padding: '2rem' }}>
                <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error || 'Examination not found'}
                />
                <Button onClick={() => navigate('/examinations')} style={{ marginTop: '1rem' }}>
                    Back to Examinations
                </Button>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            <Breadcrumb>
                <BreadcrumbItem href="/examinations">Examinations</BreadcrumbItem>
                <BreadcrumbItem isCurrentPage>
                    {format(new Date(currentExamination.examDate), 'dd/MM/yyyy')}
                </BreadcrumbItem>
            </Breadcrumb>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <div>
                    <h1>Examination Details</h1>
                    <p style={{ marginTop: '0.5rem' }}>
                        Patient: <strong>{currentExamination.patientName}</strong>
                        {' | '}
                        Date: <strong>{format(new Date(currentExamination.examDate), 'dd/MM/yyyy')}</strong>
                        {' | '}
                        Status: {getStatusTag(currentExamination.status)}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button
                        kind="secondary"
                        renderIcon={ArrowLeft}
                        onClick={() => navigate('/examinations')}
                    >
                        Back
                    </Button>
                    <Button
                        kind="tertiary"
                        renderIcon={Download}
                        onClick={() => alert('PDF generation coming soon')}
                    >
                        Export PDF
                    </Button>
                    <Button
                        kind="primary"
                        renderIcon={Edit}
                        onClick={() => navigate(`/examinations/${id}/edit`)}
                    >
                        Edit
                    </Button>
                </div>
            </div>

            <Tabs>
                <TabList aria-label="Examination details tabs">
                    <Tab>Overview</Tab>
                    <Tab>Biometry</Tab>
                    <Tab>Doppler</Tab>
                    <Tab>Findings</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem' }}>
                                <dt><strong>Patient:</strong></dt>
                                <dd>{currentExamination.patientName}</dd>

                                <dt><strong>Exam Date:</strong></dt>
                                <dd>{format(new Date(currentExamination.examDate), 'dd/MM/yyyy HH:mm')}</dd>

                                <dt><strong>Gestational Age:</strong></dt>
                                <dd>{currentExamination.gestationalAge || '-'}</dd>

                                <dt><strong>Status:</strong></dt>
                                <dd>{getStatusTag(currentExamination.status)}</dd>

                                <dt><strong>Created:</strong></dt>
                                <dd>{format(new Date(currentExamination.createdAt), 'dd/MM/yyyy HH:mm')}</dd>
                            </dl>
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            {currentExamination.biometry ? (
                                <dl style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem' }}>
                                    <dt><strong>BPD (Biparietal Diameter):</strong></dt>
                                    <dd>{currentExamination.biometry.bpd || '-'} mm</dd>

                                    <dt><strong>HC (Head Circumference):</strong></dt>
                                    <dd>{currentExamination.biometry.hc || '-'} mm</dd>

                                    <dt><strong>AC (Abdominal Circumference):</strong></dt>
                                    <dd>{currentExamination.biometry.ac || '-'} mm</dd>

                                    <dt><strong>FL (Femur Length):</strong></dt>
                                    <dd>{currentExamination.biometry.fl || '-'} mm</dd>

                                    <dt><strong>EFW (Estimated Fetal Weight):</strong></dt>
                                    <dd>
                                        {currentExamination.biometry.efw ? (
                                            <>
                                                <strong>{currentExamination.biometry.efw} grams</strong>
                                                <br />
                                                <small>Calculated using Hadlock formula</small>
                                            </>
                                        ) : '-'}
                                    </dd>
                                </dl>
                            ) : (
                                <p>No biometry data recorded</p>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            {currentExamination.doppler ? (
                                <dl style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem' }}>
                                    <dt><strong>Umbilical Artery PI:</strong></dt>
                                    <dd>{currentExamination.doppler.umbilicalArteryPI || '-'}</dd>

                                    <dt><strong>Umbilical Artery RI:</strong></dt>
                                    <dd>{currentExamination.doppler.umbilicalArteryRI || '-'}</dd>

                                    <dt><strong>Middle Cerebral Artery PI:</strong></dt>
                                    <dd>{currentExamination.doppler.middleCerebralArteryPI || '-'}</dd>
                                </dl>
                            ) : (
                                <p>No Doppler data recorded</p>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div style={{ marginTop: '2rem' }}>
                            {currentExamination.findings ? (
                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {currentExamination.findings}
                                </div>
                            ) : (
                                <p>No findings recorded</p>
                            )}
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </div>
    );
};

export default ExaminationDetail;

// Made with Bob
