import { useState, useEffect, useCallback, useRef } from 'react';
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
  TableToolbarSearch,
  Button,
  Select,
  SelectItem,
  Pagination,
  InlineLoading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Add, View } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import type { Examination, Patient } from '../types';

const headers = [
  { key: 'patientName', header: 'Patient Name' },
  { key: 'mrn', header: 'MRN' },
  { key: 'examDate', header: 'Exam Date' },
  { key: 'gestationalAge', header: 'Gestational Age' },
  { key: 'status', header: 'Status' },
  { key: 'createdBy', header: 'Created By' },
  { key: 'actions', header: 'Actions' },
];

export default function ExaminationsPage() {
  const navigate = useNavigate();
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [filteredExaminations, setFilteredExaminations] = useState<Examination[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setFilteredExaminations(data);
      setSearchQuery('');
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handlePatientFilter = (patientId: string) => {
    setSelectedPatientId(patientId);
    setPage(1);
    loadExaminations(patientId || undefined);
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const applyFilters = useCallback(
    (baseList: Examination[], query: string, status: string) => {
      let result = baseList;
      if (status) {
        result = result.filter((exam) => exam.status === status);
      }
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        result = result.filter((exam) =>
          exam.patientName.toLowerCase().includes(lowerQuery)
        );
      }
      return result;
    },
    []
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setFilteredExaminations(applyFilters(examinations, query, selectedStatus));
    }, 200);
  }, [examinations, selectedStatus, applyFilters]);

  // Re-apply status filter whenever it changes
  useEffect(() => {
    setFilteredExaminations(applyFilters(examinations, searchQuery, selectedStatus));
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const handleRowClick = (examinationId: string) => {
    navigate(`/examinations/${examinationId}`);
  };

  const handlePatientNameClick = (e: React.MouseEvent, patientId: string) => {
    e.stopPropagation();
    navigate(`/patients/${patientId}`);
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
    // Plan: draft=gray, completed=green, reviewed=blue
    const statusConfig = {
      draft: { type: 'gray' as const, label: 'Draft' },
      completed: { type: 'green' as const, label: 'Completed' },
      reviewed: { type: 'blue' as const, label: 'Reviewed' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  // Prepare rows for DataTable — keep patientId for click handler
  const allRows = filteredExaminations.map((exam) => ({
    id: exam.examinationId,
    patientName: exam.patientName,
    patientId: exam.patientId,
    mrn: exam.mrn,
    examDate: formatDate(exam.examDate),
    gestationalAge: exam.gestationalAge || '—',
    status: exam.status,
    createdBy: exam.createdBy,
    actions: exam.examinationId, // used to render button
  }));

  // Pagination
  const totalItems = allRows.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

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

      {/* Filter bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 280px' }}>
          <Select
            id="patientFilter"
            labelText="Filter by Patient"
            value={selectedPatientId}
            onChange={(e) => handlePatientFilter(e.target.value)}
            aria-label="Filter examinations by patient"
          >
            <SelectItem value="" text="All Patients" />
            {patients.map((patient) => (
              <SelectItem
                key={patient.patientId}
                value={patient.patientId}
                text={patient.name}
              />
            ))}
          </Select>
        </div>
        <div style={{ flex: '0 0 200px' }}>
          <Select
            id="statusFilter"
            labelText="Filter by Status"
            value={selectedStatus}
            onChange={(e) => handleStatusFilter(e.target.value)}
            aria-label="Filter examinations by status"
          >
            <SelectItem value="" text="All Statuses" />
            <SelectItem value="draft" text="Draft" />
            <SelectItem value="completed" text="Completed" />
            <SelectItem value="reviewed" text="Reviewed" />
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
            title="Examinations"
            description={`${totalItems} examination${totalItems !== 1 ? 's' : ''} found`}
            {...getTableContainerProps()}
          >
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search by patient name..."
                  onChange={(e: any) => handleSearch(e.target?.value ?? e)}
                  value={searchQuery}
                  aria-label="Search examinations by patient name"
                />
                <Button
                  renderIcon={Add}
                  onClick={handleCreateExamination}
                  aria-label="Create new examination"
                >
                  Create Examination
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} aria-label="Examinations table">
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
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                        {searchQuery
                          ? `No examinations found matching "${searchQuery}"`
                          : selectedPatientId
                          ? 'No examinations found for this patient.'
                          : 'No examinations yet. Click "Create Examination" to get started.'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    // Find the original examination to get patientId
                    const originalRow = allRows.find((r) => r.id === row.id);
                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        onClick={() => handleRowClick(row.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {row.cells.map((cell) => {
                          if (cell.info.header === 'status') {
                            return (
                              <TableCell key={cell.id}>
                                {getStatusTag(cell.value as string)}
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'patientName' && originalRow) {
                            return (
                              <TableCell key={cell.id}>
                                <span
                                  role="link"
                                  tabIndex={0}
                                  onClick={(e) => handlePatientNameClick(e, originalRow.patientId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      navigate(`/patients/${originalRow.patientId}`);
                                    }
                                  }}
                                  style={{ color: '#0f62fe', cursor: 'pointer', textDecoration: 'underline' }}
                                  aria-label={`View patient ${cell.value}`}
                                >
                                  {cell.value}
                                </span>
                              </TableCell>
                            );
                          }
                          if (cell.info.header === 'actions') {
                            return (
                              <TableCell key={cell.id}>
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  renderIcon={View}
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleRowClick(row.id);
                                  }}
                                  aria-label={`View details for examination`}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            );
                          }
                          return <TableCell key={cell.id}>{cell.value}</TableCell>;
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {totalItems > pageSize && (
        <Pagination
          backwardText="Previous page"
          forwardText="Next page"
          itemsPerPageText="Items per page:"
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 20, 30, 40, 50]}
          totalItems={totalItems}
          onChange={({ page: newPage, pageSize: newPageSize }) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
          style={{ marginTop: '1rem' }}
        />
      )}
    </div>
  );
}

// Made with Bob
