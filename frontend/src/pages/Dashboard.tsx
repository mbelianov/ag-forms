import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tile, Button, Stack } from '@carbon/react';
import { User, Hospital, DocumentView } from '@carbon/icons-react';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div style={{ padding: '2rem' }}>
            <Stack gap={7}>
                <div>
                    <h1>Welcome, {user?.username}!</h1>
                    <p style={{ color: '#525252', marginTop: '0.5rem' }}>
                        Role: {user?.role}
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem',
                }}>
                    <Tile style={{ padding: '2rem', cursor: 'pointer' }} onClick={() => navigate('/patients')}>
                        <Stack gap={4}>
                            <User size={32} />
                            <h3>Patients</h3>
                            <p style={{ color: '#525252' }}>
                                Manage patient records and medical information
                            </p>
                            <Button kind="tertiary" size="sm">
                                View Patients
                            </Button>
                        </Stack>
                    </Tile>

                    <Tile style={{ padding: '2rem', cursor: 'pointer' }} onClick={() => navigate('/examinations')}>
                        <Stack gap={4}>
                            <Hospital size={32} />
                            <h3>Examinations</h3>
                            <p style={{ color: '#525252' }}>
                                View and create ultrasound examinations
                            </p>
                            <Button kind="tertiary" size="sm">
                                View Examinations
                            </Button>
                        </Stack>
                    </Tile>

                    <Tile style={{ padding: '2rem' }}>
                        <Stack gap={4}>
                            <DocumentView size={32} />
                            <h3>Reports</h3>
                            <p style={{ color: '#525252' }}>
                                Generate and view examination reports
                            </p>
                            <Button kind="tertiary" size="sm" disabled>
                                Coming Soon
                            </Button>
                        </Stack>
                    </Tile>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <h2>Quick Stats</h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        marginTop: '1rem',
                    }}>
                        <Tile style={{ padding: '1.5rem' }}>
                            <h4 style={{ color: '#525252', marginBottom: '0.5rem' }}>Total Patients</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>-</p>
                        </Tile>
                        <Tile style={{ padding: '1.5rem' }}>
                            <h4 style={{ color: '#525252', marginBottom: '0.5rem' }}>Total Examinations</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>-</p>
                        </Tile>
                        <Tile style={{ padding: '1.5rem' }}>
                            <h4 style={{ color: '#525252', marginBottom: '0.5rem' }}>This Month</h4>
                            <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>-</p>
                        </Tile>
                    </div>
                </div>
            </Stack>
        </div>
    );
};

export default Dashboard;

// Made with Bob
