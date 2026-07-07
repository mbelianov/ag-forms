import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Stack,
  InlineNotification,
  InlineLoading,
  Tile,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Modal,
} from '@carbon/react';
import { Edit, Add, ArrowLeft, TrashCan } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import { examinationService } from '../services/examinationService';
import { useAuth } from '../contexts/AuthContext';
import PageLoader from '../components/PageLoader';
import ErrorMessage from '../components/ErrorMessage';
import { useAutoNotification } from '../utils/useAutoNotification';
import { getStatusTag } from '../utils/statusHelpers';
import { calculateAgeAtDate } from '../utils/calculations';
import { formatDateTime, formatDateShort, formatPlainDate } from '../utils/formatters';
import type { Patient, Examination } from '../types';

const examinationHeaders = [
  { key: 'examDate', header: 'Exam Date' },
  { key: 'status', header: 'Status' },
  { key: 'gestationalAge', header: 'Gestational Age' },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExaminations, setIsLoadingExaminations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examinationsError, setExaminationsError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const clearDeleteSuccess = useCallback(() => setDeleteSuccess(false), []);
  useAutoNotification(deleteSuccess ? 'done' : null, clearDeleteSuccess);

  const loadPatient = useCallback(async () => {
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
      console.error('[PatientDetail] Failed to load patient:', err);
      setError(err.message || 'Failed to load patient');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  useEffect(() => {
    const loadExaminations = async () => {
      if (!id) return;

      setIsLoadingExaminations(true);
      setExaminationsError(null);
      try {
        const result = await examinationService.getExaminations(id);
        const examinationsData = result.examinations;
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

  const handleDeleteClick = () => {
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await patientService.deletePatient(id);
      setIsDeleteModalOpen(false);
      setDeleteSuccess(true);
      setTimeout(() => navigate('/patients'), 1200);
    } catch (err: any) {
      setIsDeleteModalOpen(false);
      setDeleteError(err.message || 'Failed to delete patient');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateExamination = () => {
    navigate(`/examinations/new?patientId=${id}`);
  };

  // TASK-038: Derive display age from birthDate or fall back to stored age
  const patientAge = patient
    ? (patient.birthDate
        ? calculateAgeAtDate(patient.birthDate, new Date().toISOString().split('T')[0])
        : patient.age)
    : undefined;

  const handleBack = () => {
    navigate('/patients');
  };


  const handleExaminationClick = (examinationId: string) => {
    navigate(`/examinations/${examinationId}`);
  };

  if (isLoading) {
    return <PageLoader description="Loading patient details..." />;
  }

  if (error || !patient) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage
          message={error || 'Patient not found'}
          onRetry={error ? loadPatient : undefined}
        />
        <Button
          kind="tertiary"
          renderIcon={ArrowLeft}
          onClick={handleBack}
          style={{ marginTop: '1rem' }}
        >
          Back to Patients List
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/patients">Patients</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>{patient.name}</BreadcrumbItem>
      </Breadcrumb>

      <Stack gap={6}>
        {deleteSuccess && (
          <InlineNotification
            kind="success"
            title="Patient deleted"
            subtitle="Redirecting to patients list…"
            lowContrast
            hideCloseButton
          />
        )}
        {deleteError && (
          <InlineNotification
            kind="error"
            title="Delete failed"
            subtitle={deleteError}
            lowContrast
            onCloseButtonClick={() => setDeleteError(null)}
          />
        )}

        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1>Patient Details</h1>
          <Stack orientation="horizontal" gap={4} style={{ flexWrap: 'wrap' }}>
            <Button
              kind="tertiary"
              renderIcon={ArrowLeft}
              onClick={handleBack}
            >
              Back to Patients List
            </Button>
            {/* TASK-010: Edit/Create visible only to admin/doctor */}
            {(user?.role === 'admin' || user?.role === 'doctor') && (
              <Button
                kind="secondary"
                renderIcon={Edit}
                onClick={handleEdit}
              >
                Edit Patient
              </Button>
            )}
            {(user?.role === 'admin' || user?.role === 'doctor') && (
              <Button
                kind="primary"
                renderIcon={Add}
                onClick={handleCreateExamination}
              >
                Create Test {/* TASK-032 */}
              </Button>
            )}
            {(user?.role === 'admin' || user?.role === 'doctor') && (
              <Button
                kind="danger"
                renderIcon={TrashCan}
                onClick={handleDeleteClick}
              >
                Delete Patient
              </Button>
            )}
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
                  {patient.birthDate ? 'Date of Birth' : 'Age'}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {patient.birthDate
                    ? `${formatPlainDate(patient.birthDate)} (${patientAge !== undefined ? `${patientAge} yrs` : '—'})`
                    : (patientAge !== undefined ? `${patientAge} years` : '—')}
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
                {formatDateTime(patient.createdAt)}
              </div>
            </div>
            {/* TASK-016: show updatedAt */}
            {patient.updatedAt && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Last Updated
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {formatDateTime(patient.updatedAt)}
                </div>
              </div>
            )}
          </Stack>
        </Tile>

        {/* TASK-032: Ultrasound Prenatal Tests Section */}
        <Tile>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Ultrasound Prenatal Tests</h3>
            {(user?.role === 'admin' || user?.role === 'doctor') && (
              <Button
                kind="tertiary"
                size="sm"
                renderIcon={Add}
                onClick={handleCreateExamination}
              >
                Add Test
              </Button>
            )}
          </div>
          
          {isLoadingExaminations ? (
            <InlineLoading description="Loading tests..." />
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
                examDate: formatDateShort(exam.examDate.includes('T') ? exam.examDate : exam.examDate + 'T00:00:00'),
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
                      {rows.map((row) => {
                        const exam = examinations.find((e) => e.examinationId === row.id);
                        return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => handleExaminationClick(row.id)}
                          style={{ cursor: 'pointer' }}
                          aria-label={exam ? `View examination from ${formatDateShort(exam.examDate.includes('T') ? exam.examDate : exam.examDate + 'T00:00:00')}` : 'View examination'}
                        >
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              {cell.info.header === 'status'
                                ? getStatusTag(cell.value as string)
                                : cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          )}
        </Tile>
      </Stack>

      <Modal
        open={isDeleteModalOpen}
        danger
        modalHeading="Delete Patient"
        primaryButtonText={isDeleting ? 'Deleting…' : 'Delete'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={isDeleting}
        onRequestSubmit={handleDeleteConfirm}
        onRequestClose={handleDeleteCancel}
        onSecondarySubmit={handleDeleteCancel}
      >
        <p>
          Are you sure you want to delete <strong>{patient?.name}</strong>?
        </p>
        <p style={{ marginTop: '0.75rem' }}>
          This will permanently delete the patient record and{' '}
          <strong>all {examinations.length > 0 ? examinations.length : ''} associated examination{examinations.length !== 1 ? 's' : ''}</strong>.
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// Made with Bob