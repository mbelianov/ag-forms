import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Button,
  Select,
  SelectItem,
  Pagination,
  InlineLoading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import type { Examination, Patient } from '../types';

const headers = [
  { key: 'patientName', header: 'Patient Name' },
  { key: 'examDate', header: 'Exam Date' },
  { key: 'status', header: 'Status' },
  { key: 'createdBy', header: 'Created By' },
];

export default function ExaminationsPage() {
  const navigate = useNavigate();
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadPatients = useCallback(async () => {
    try {
      const response = await patientService.getPatients();
      setPatients(response.patients);
    } catch (err: any) {
      console.error('Failed to load patients:', err);
    }
  }, []);

  const loadExaminations = useCallback(async (patientId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await examinationService.getExaminations(patientId || undefined);
      setExaminations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load examinations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
    loadExaminations();
  }, [loadPatients, loadExaminations]);

  const handlePatientFilter = (patientId: string) => {
    setSelectedPatientId(patientId);
    setPage(1); // Reset to first page
    loadExaminations(patientId || undefined);
  };

  const handleRowClick = (examinationId: string) => {
    navigate(`/examinations/${examinationId}`);
  };

  const handleCreateExamination = () => {
    navigate('/examinations/new');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      draft: { type: 'gray' as const, label: 'Draft' },
      completed: { type: 'blue' as const, label: 'Completed' },
      reviewed: { type: 'green' as const, label: 'Reviewed' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  // Prepare rows for DataTable
  const rows = examinations.map((exam) => ({
    id: exam.examinationId,
    patientName: exam.patientName,
    examDate: formatDate(exam.examDate),
    status: exam.status,
    createdBy: exam.createdBy,
  }));

  // Pagination
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  if (isLoading && examinations.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading examinations..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Examinations</h1>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
          style={{ marginBottom: '1rem' }}
        />
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, maxWidth: '300px' }}>
          <Select
            id="patientFilter"
            labelText="Filter by Patient"
            value={selectedPatientId}
            onChange={(e) => handlePatientFilter(e.target.value)}
          >
            <SelectItem value="" text="All Patients" />
            {patients.map((patient) => (
              <SelectItem
                key={patient.patientId}
                value={patient.patientId}
                text={`${patient.name} (${patient.mrn})`}
              />
            ))}
          </Select>
        </div>
      </div>

      <DataTable rows={paginatedRows} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps,
        }) => (
          <TableContainer
            title=""
            description=""
            {...getTableContainerProps()}
          >
            <TableToolbar>
              <TableToolbarContent>
                <Button
                  renderIcon={Add}
                  onClick={handleCreateExamination}
                >
                  Create Examination
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
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
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        {selectedPatientId
                          ? 'No examinations found for this patient'
                          : 'No examinations yet. Create your first examination to get started.'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      {...getRowProps({ row })}
                      key={row.id}
                      onClick={() => handleRowClick(row.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {rows.length > pageSize && (
        <Pagination
          backwardText="Previous page"
          forwardText="Next page"
          itemsPerPageText="Items per page:"
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          totalItems={rows.length}
          onChange={({ page, pageSize }) => {
            setPage(page);
            setPageSize(pageSize);
          }}
          style={{ marginTop: '1rem' }}
        />
      )}
    </div>
  );
}

// Made with Bob
