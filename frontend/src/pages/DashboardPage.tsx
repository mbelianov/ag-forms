import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  Grid,
  Column,
  Button,
  InlineLoading,
  InlineNotification,
  StructuredListWrapper,
  StructuredListBody,
  StructuredListRow,
  StructuredListCell,
} from '@carbon/react';
import { Add, ArrowRight } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import { examinationService } from '../services/examinationService';
import type { Patient, Examination } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [patientRes, examRes] = await Promise.all([
          patientService.getPatients(),
          examinationService.getExaminations(),
        ]);
        setPatients(patientRes.patients);
        setExaminations(examRes.examinations);
      } catch (err: any) {
        console.error('[Dashboard] Failed to load data:', err);
        setError('Dashboard data could not be loaded. Statistics may be unavailable.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Derived statistics
  const totalPatients = patients.length;
  const totalExaminations = examinations.length;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const examsThisWeek = examinations.filter(
    (e) => new Date(e.examDate) >= oneWeekAgo
  ).length;

  const pendingReviews = examinations.filter(
    (e) => e.status === 'draft' || e.status === 'completed'
  ).length;

  // Recent lists (last 5)
  const recentPatients = [...patients]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentExaminations = [...examinations]
    .sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime())
    .slice(0, 5);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      {error && (
        <InlineNotification
          kind="warning"
          title="Warning"
          subtitle={error}
          lowContrast
          onCloseButtonClick={() => setError(null)}
          style={{ marginBottom: '1.5rem' }}
        />
      )}

      {/* Statistics Tiles */}
      {isLoading ? (
        <div style={{ marginBottom: '2rem' }}>
          <InlineLoading description="Loading dashboard data..." />
        </div>
      ) : (
        <Grid narrow style={{ marginBottom: '2rem' }}>
          <Column lg={4} md={4} sm={4}>
            <Tile style={{ minHeight: '140px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>Total Patients</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: '#161616' }}>
                {totalPatients}
              </div>
            </Tile>
          </Column>
          <Column lg={4} md={4} sm={4}>
            <Tile style={{ minHeight: '140px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>Total Examinations</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: '#161616' }}>
                {totalExaminations}
              </div>
            </Tile>
          </Column>
          <Column lg={4} md={4} sm={4}>
            <Tile style={{ minHeight: '140px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>Exams This Week</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: '#161616' }}>
                {examsThisWeek}
              </div>
            </Tile>
          </Column>
          <Column lg={4} md={4} sm={4}>
            <Tile style={{ minHeight: '140px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>Pending Reviews</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, color: '#161616' }}>
                {pendingReviews}
              </div>
            </Tile>
          </Column>
        </Grid>
      )}

      {/* Quick Actions */}
      <Tile style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button renderIcon={Add} onClick={() => navigate('/patients/new')} aria-label="Create new patient">
            Create New Patient
          </Button>
          <Button kind="secondary" renderIcon={ArrowRight} onClick={() => navigate('/patients')} aria-label="View all patients">
            All Patients
          </Button>
          <Button kind="secondary" renderIcon={ArrowRight} onClick={() => navigate('/examinations')} aria-label="View all examinations">
            All Examinations
          </Button>
        </div>
      </Tile>

      {/* Recent Activity */}
      {!isLoading && (
        <Grid narrow>
          <Column lg={8} md={8} sm={4}>
            <Tile style={{ marginBottom: '1rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Recent Patients</h3>
              {recentPatients.length === 0 ? (
                <p style={{ color: '#525252', fontSize: '0.875rem' }}>No patients yet.</p>
              ) : (
                <StructuredListWrapper>
                  <StructuredListBody>
                    {recentPatients.map((p) => (
                      <StructuredListRow
                        key={p.patientId}
                        onClick={() => navigate(`/patients/${p.patientId}`)}
                        style={{ cursor: 'pointer' }}
                        aria-label={`View patient ${p.name}`}
                      >
                        <StructuredListCell>{p.name}</StructuredListCell>
                        <StructuredListCell noWrap style={{ color: '#525252', fontSize: '0.875rem' }}>
                          {formatDate(p.createdAt)}
                        </StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              )}
            </Tile>
          </Column>
          <Column lg={8} md={8} sm={4}>
            <Tile style={{ marginBottom: '1rem', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Recent Examinations</h3>
              {recentExaminations.length === 0 ? (
                <p style={{ color: '#525252', fontSize: '0.875rem' }}>No examinations yet.</p>
              ) : (
                <StructuredListWrapper>
                  <StructuredListBody>
                    {recentExaminations.map((e) => (
                      <StructuredListRow
                        key={e.examinationId}
                        onClick={() => navigate(`/examinations/${e.examinationId}`)}
                        style={{ cursor: 'pointer' }}
                        aria-label={`View examination for ${e.patientName}`}
                      >
                        <StructuredListCell>{e.patientName}</StructuredListCell>
                        <StructuredListCell noWrap style={{ color: '#525252', fontSize: '0.875rem' }}>
                          {formatDate(e.examDate)}
                        </StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              )}
            </Tile>
          </Column>
        </Grid>
      )}
    </div>
  );
}

// Made with Bob
