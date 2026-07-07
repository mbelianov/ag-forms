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
  InlineNotification,
  DatePicker,
  DatePickerInput,
} from '@carbon/react';
import { getStatusTag } from '../utils/statusHelpers';
import { Add, View } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort } from '../utils/formatters';
import type { Examination, Patient } from '../types';

// TASK-033: default type label
const EXAM_TYPE_LABEL = 'Ultrasound Prenatal Test';

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDisplayDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

const headers = [
  { key: 'patientName', header: 'Patient Name' },
  { key: 'mrn', header: 'MRN' },
  { key: 'examDate', header: 'Exam Date' },
  { key: 'examinationType', header: 'Type' },
  { key: 'gestationalAge', header: 'Gestational Age' },
  { key: 'status', header: 'Status' },
  { key: 'createdBy', header: 'Created By' },
  { key: 'actions', header: 'Actions' },
];

export default function ExaminationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role !== 'viewer';

  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [filteredExaminations, setFilteredExaminations] = useState<Examination[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPatients = useCallback(async () => {
    try {
      const response = await patientService.getPatients();
      setPatients(response.patients);
    } catch (err: any) {
      console.error('Failed to load patients:', err);
    }
  }, []);

  const loadExaminations = useCallback(async (opts?: {
    patientId?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    token?: string;
    append?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await examinationService.getExaminations({
        patientId: opts?.patientId,
        status: opts?.status || undefined,
        from_date: opts?.from_date || undefined,
        to_date: opts?.to_date || undefined,
        continuationToken: opts?.token,
      });
      const newExams = result.examinations;
      if (opts?.append) {
        setExaminations((prev) => {
          const all = [...prev, ...newExams];
          setFilteredExaminations(all);
          return all;
        });
      } else {
        setExaminations(newExams);
        setFilteredExaminations(newExams);
        setSearchQuery('');
      }
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
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

  const applyFilters = useCallback(
    (baseList: Examination[], query: string) => {
      if (!query.trim()) return baseList;
      const lowerQuery = query.toLowerCase();
      return baseList.filter((exam) =>
        exam.patientName.toLowerCase().includes(lowerQuery)
      );
    },
    []
  );

  const handlePatientFilter = (patientId: string) => {
    setSelectedPatientId(patientId);
    setPage(1);
    loadExaminations({ patientId: patientId || undefined, status: selectedStatus || undefined, from_date: fromDate || undefined, to_date: toDate || undefined });
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
    // TASK-012: pass status to API
    loadExaminations({ patientId: selectedPatientId || undefined, status: status || undefined, from_date: fromDate || undefined, to_date: toDate || undefined });
  };

  const handleDateFilter = (from: string, to: string) => {
    setPage(1);
    loadExaminations({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, from_date: from || undefined, to_date: to || undefined });
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setFilteredExaminations(applyFilters(examinations, query));
    }, 200);
  }, [examinations, applyFilters]);

  const handleLoadMore = () => {
    if (!continuationToken) return;
    loadExaminations({
      patientId: selectedPatientId || undefined,
      status: selectedStatus || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      token: continuationToken,
      append: true,
    });
  };

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

  // Prepare rows for DataTable — keep patientId for click handler
  const allRows = filteredExaminations.map((exam) => ({
    id: exam.examinationId,
    patientName: exam.patientName,
    patientId: exam.patientId,
    mrn: exam.mrn,
    examDate: formatDateShort(exam.examDate.includes('T') ? exam.examDate : exam.examDate + 'T00:00:00'),
    examinationType: exam.examinationType
      ? exam.examinationType.replace(/_/g, ' ')
      : EXAM_TYPE_LABEL,
    gestationalAge: exam.gestationalAge || '—',
    status: exam.status,
    createdBy: exam.createdByName || exam.createdBy,
    actions: exam.examinationId, // used to render button
  }));

  // Pagination
  const totalItems = allRows.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  if (isLoading && examinations.length === 0) {
    return <PageLoader description="Loading ultrasound prenatal tests..." />;
  }

  return (
    <div style={{ padding: '2rem' }}>
      {/* TASK-032: renamed page title */}
      <h1 style={{ marginBottom: '2rem' }}>Ultrasound Prenatal Tests</h1>

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
        {/* TASK-014: Date range filter */}
        <div style={{ flex: '0 0 auto' }}>
          <DatePicker
            datePickerType="range"
            dateFormat="d/m/Y"
            value={[
              fromDate ? toDisplayDate(fromDate) : '',
              toDate ? toDisplayDate(toDate) : '',
            ]}
            onChange={(dates: Date[]) => {
              const from = dates[0] ? toISODate(dates[0]) : '';
              const to = dates[1] ? toISODate(dates[1]) : '';
              setFromDate(from);
              setToDate(to);
              if (from && to) {
                handleDateFilter(from, to);
              } else if (!from && !to) {
                handleDateFilter('', '');
              }
            }}
          >
            <DatePickerInput
              id="fromDate"
              labelText="From Date"
              placeholder="dd/mm/yyyy"
            />
            <DatePickerInput
              id="toDate"
              labelText="To Date"
              placeholder="dd/mm/yyyy"
            />
          </DatePicker>
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
            title="Ultrasound Prenatal Tests"
            description={`${totalItems} test${totalItems !== 1 ? 's' : ''} found`}
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
                {/* TASK-010: hide Create for viewer */}
                {canCreate && (
                  <Button
                    renderIcon={Add}
                    onClick={handleCreateExamination}
                    aria-label="Create new ultrasound prenatal test"
                  >
                    Create Test
                  </Button>
                )}
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} aria-label="Ultrasound Prenatal Tests table">
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
                          ? `No tests found matching "${searchQuery}"`
                          : selectedPatientId
                          ? 'No tests found for this patient.'
                          : 'No ultrasound prenatal tests yet. Click "Create Test" to get started.'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, rowIndex) => {
                    const originalRow = allRows.find((r) => r.id === row.id);
                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        onClick={() => handleRowClick(row.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f4f4f4',
                        }}
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
                                  aria-label="View details for test"
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

      {/* TASK-013: Load More button for server-side pagination */}
      {hasMore && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button
            kind="tertiary"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            Load More Tests
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
