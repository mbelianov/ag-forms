import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Stack,
  InlineLoading,
  InlineNotification,
  Tile,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Tag,
} from '@carbon/react';
import { Edit, Add, ArrowLeft } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import { examinationService } from '../services/examinationService';
import type { Patient, Examination } from '../types';

const examinationHeaders = [
  { key: 'examDate', header: 'Exam Date' },
  { key: 'status', header: 'Status' },
  { key: 'gestationalAge', header: 'Gestational Age' },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExaminations, setIsLoadingExaminations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examinationsError, setExaminationsError] = useState<string | null>(null);

  useEffect(() => {
    const loadPatient = async () => {
      if (!id) {
        setError('Patient ID is required');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const patientData = await patientService.getPatient(id);
        setPatient(patientData);
      } catch (err: any) {
        setError(err.message || 'Failed to load patient');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatient();
  }, [id]);

  useEffect(() => {
    const loadExaminations = async () => {
      if (!id) return;

      setIsLoadingExaminations(true);
      setExaminationsError(null);
      try {
        const examinationsData = await examinationService.getExaminations(id);
        // Sort newest first by examDate
        const sorted = [...examinationsData].sort(
          (a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime()
        );
        setExaminations(sorted);
      } catch (err: any) {
        setExaminationsError(err.message || 'Failed to load examinations');
      } finally {
        setIsLoadingExaminations(false);
      }
    };

    loadExaminations();
  }, [id]);

  const handleEdit = () => {
    navigate(`/patients/${id}/edit`);
  };

  const handleCreateExamination = () => {
    navigate(`/examinations/new?patientId=${id}`);
  };

  const handleBack = () => {
    navigate('/patients');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatExamDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusTag = (status: string) => {
    // Plan: draft=gray, completed=green, reviewed=blue
    const statusConfig = {
      draft: { type: 'gray' as const, label: 'Draft' },
      completed: { type: 'green' as const, label: 'Completed' },
      reviewed: { type: 'blue' as const, label: 'Reviewed' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  const handleExaminationClick = (examinationId: string) => {
    navigate(`/examinations/${examinationId}`);
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading patient details..." />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error || 'Patient not found'}
          lowContrast
        />
        <Button
          kind="tertiary"
          renderIcon={ArrowLeft}
          onClick={handleBack}
          style={{ marginTop: '1rem' }}
        >
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Stack gap={6}>
        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Patient Details</h1>
          <Stack orientation="horizontal" gap={4}>
            <Button
              kind="tertiary"
              renderIcon={ArrowLeft}
              onClick={handleBack}
            >
              Back to Patients
            </Button>
            <Button
              kind="secondary"
              renderIcon={Edit}
              onClick={handleEdit}
            >
              Edit Patient
            </Button>
            <Button
              kind="primary"
              renderIcon={Add}
              onClick={handleCreateExamination}
            >
              Create Examination
            </Button>
          </Stack>
        </div>

        {/* Patient Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Patient Information</h3>
          <Stack gap={5}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Name
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                {patient.name}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Age
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {patient.age} years
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Phone
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {patient.phone}
                </div>
              </div>
            </div>

            {patient.email && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Email
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {patient.email}
                </div>
              </div>
            )}

            {patient.address && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Address
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {patient.address}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Created
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                {formatDate(patient.createdAt)}
              </div>
            </div>
          </Stack>
        </Tile>

        {/* Examinations Section */}
        <Tile>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Examinations</h3>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={Add}
              onClick={handleCreateExamination}
            >
              Add Examination
            </Button>
          </div>
          
          {isLoadingExaminations ? (
            <InlineLoading description="Loading examinations..." />
          ) : examinationsError ? (
            <InlineNotification
              kind="error"
              title="Unable to load examinations"
              subtitle={examinationsError}
              lowContrast
              hideCloseButton
            />
          ) : examinations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
              <p>No examinations yet.</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Create an examination to get started.
              </p>
            </div>
          ) : (
            <DataTable
              rows={examinations.map((exam) => ({
                id: exam.examinationId,
                examDate: formatExamDate(exam.examDate),
                status: exam.status,
                gestationalAge: exam.gestationalAge || '-',
              }))}
              headers={examinationHeaders}
            >
              {({
                rows,
                headers,
                getHeaderProps,
                getRowProps,
                getTableProps,
                getTableContainerProps,
              }) => (
                <TableContainer {...getTableContainerProps()}>
                  <Table {...getTableProps()} size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })} key={header.key}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => handleExaminationClick(row.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'status'
                                ? getStatusTag(cell.value as string)
                                : cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
        </Tile>
      </Stack>
    </div>
  );
}

// Made with Bob