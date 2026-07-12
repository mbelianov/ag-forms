import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  InlineLoading,
  DatePicker,
  DatePickerInput,
  ActionableNotification,
} from '@carbon/react';
import { getStatusTag } from '../utils/statusHelpers';
import { Add, View } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort } from '../utils/formatters';
import type { Examination, Patient } from '../types';
import { EXAM_TYPES, getExamTypeLabel } from '../constants/examinationTypes';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canCreate = user?.role !== 'viewer';

  // ── URL-derived state (Task 4) ──────────────────────────────────────────────
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [filteredExaminations, setFilteredExaminations] = useState<Examination[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    () => searchParams.get('patient') || ''
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    () => searchParams.get('status') || ''
  );
  const [selectedExamType, setSelectedExamType] = useState<string>(
    () => searchParams.get('type') || ''
  );
  const [fromDate, setFromDate] = useState<string>(
    () => searchParams.get('from') || ''
  );
  const [toDate, setToDate] = useState<string>(
    () => searchParams.get('to') || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('q') || ''
  );
  const [page, setPage] = useState<number>(
    () => Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  );
  const [pageSize, setPageSize] = useState(10);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Task 8: search-specific state
  const [isSearching, setIsSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);

  // Refs for debounce timers and AbortControllers (Tasks 7, 11)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

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
    examinationType?: string;
    token?: string;
    append?: boolean;
  }) => {
    // Task 11: abort previous in-flight request
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const result = await examinationService.getExaminations({
        patientId: opts?.patientId,
        status: opts?.status || undefined,
        from_date: opts?.from_date || undefined,
        to_date: opts?.to_date || undefined,
        examinationType: opts?.examinationType || undefined,
        continuationToken: opts?.token,
        signal: controller.signal,
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
        // NOTE: do NOT clear searchQuery here (Task 8 regression fix)
      }
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
    } catch (err: any) {
      // Task 11: silently ignore aborted requests
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load examinations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mount: load data using URL-derived state (Task 4)
  useEffect(() => {
    loadPatients();
    loadExaminations({
      patientId: searchParams.get('patient') || undefined,
      status: searchParams.get('status') || undefined,
      from_date: searchParams.get('from') || undefined,
      to_date: searchParams.get('to') || undefined,
      examinationType: searchParams.get('type') || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
      loadAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, []);

  // ── Filter handlers (Tasks 4, 6) ───────────────────────────────────────────

  const handlePatientFilter = (patientId: string) => {
    // Task 6: synchronous token reset
    setContinuationToken(undefined);
    setSelectedPatientId(patientId);
    setPage(1);
    // Task 4: write URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (patientId) next.set('patient', patientId); else next.delete('patient');
      next.set('page', '1');
      return next;
    });
    loadExaminations({ patientId: patientId || undefined, status: selectedStatus || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, examinationType: selectedExamType || undefined });
  };

  const handleStatusFilter = (status: string) => {
    // Task 6: synchronous token reset
    setContinuationToken(undefined);
    setSelectedStatus(status);
    setPage(1);
    // Task 4: write URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status) next.set('status', status); else next.delete('status');
      next.set('page', '1');
      return next;
    });
    loadExaminations({ patientId: selectedPatientId || undefined, status: status || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, examinationType: selectedExamType || undefined });
  };

  const handleExamTypeFilter = (type: string) => {
    setSelectedExamType(type);
    setPage(1);
    setContinuationToken(undefined);
    // Task 4: write URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (type) next.set('type', type); else next.delete('type');
      next.set('page', '1');
      return next;
    });
    loadExaminations({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, examinationType: type || undefined });
  };

  const handleDateFilter = (from: string, to: string) => {
    // Task 6: synchronous token reset
    setContinuationToken(undefined);
    setPage(1);
    loadExaminations({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, from_date: from || undefined, to_date: to || undefined, examinationType: selectedExamType || undefined });
  };

  // Task 8: server-side search with debounce + composable filters
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);

    // Task 4: write URL (replace — no extra history entries per keystroke)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (query) next.set('q', query); else next.delete('q');
      next.set('page', '1');
      return next;
    }, { replace: true });

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    // Empty query — restore full browse list
    if (!query.trim()) {
      setSearchInfo(null);
      loadExaminations({
        patientId: selectedPatientId || undefined,
        status: selectedStatus || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        examinationType: selectedExamType || undefined,
      });
      return;
    }

    // < 2 chars — show hint
    if (query.trim().length < 2) {
      setSearchInfo('Type at least 2 characters to search.');
      return;
    }

    // 2+ chars — debounced API call
    setSearchInfo(null);
    setContinuationToken(undefined);

    searchTimerRef.current = setTimeout(async () => {
      // Task 11: abort previous search
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setIsSearching(true);
      try {
        const result = await examinationService.getExaminations({
          patientId: selectedPatientId || undefined,
          status: selectedStatus || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          examinationType: selectedExamType || undefined,
          patientName: query,
          signal: controller.signal,
        });
        setExaminations(result.examinations);
        setFilteredExaminations(result.examinations);
        setContinuationToken(result.continuationToken);
        setHasMore(!!result.continuationToken);
      } catch (err: any) {
        if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
        setError(err.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, selectedStatus, fromDate, toDate, selectedExamType, loadExaminations]);

  const handleLoadMore = () => {
    if (!continuationToken) return;
    loadExaminations({
      patientId: selectedPatientId || undefined,
      status: selectedStatus || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      examinationType: selectedExamType || undefined,
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

  // Task 12: derived helpers for empty state
  const isFilterActive = !!(selectedPatientId || selectedStatus || selectedExamType || fromDate || toDate || searchQuery.trim().length >= 2);

  const activeFilterSummary = [
    selectedPatientId && patients.find(p => p.patientId === selectedPatientId)?.name && `Patient: ${patients.find(p => p.patientId === selectedPatientId)!.name}`,
    selectedStatus && `Status: ${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}`,
    selectedExamType && `Type: ${getExamTypeLabel(selectedExamType)}`,
    fromDate && `From: ${toDisplayDate(fromDate)}`,
    toDate && `To: ${toDisplayDate(toDate)}`,
    searchQuery.trim().length >= 2 && `Search: "${searchQuery}"`,
  ].filter(Boolean).join(', ');

  const clearAllFilters = () => {
    setSelectedPatientId('');
    setSelectedStatus('');
    setSelectedExamType('');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setSearchInfo(null);
    setContinuationToken(undefined);
    setPage(1);
    setSearchParams({});
    loadExaminations();
  };

  // Prepare rows for DataTable — keep patientId for click handler
  const allRows = filteredExaminations.map((exam) => ({
    id: exam.examinationId,
    patientName: exam.patientName,
    patientId: exam.patientId,
    mrn: exam.mrn,
    examDate: formatDateShort(exam.examDate.includes('T') ? exam.examDate : exam.examDate + 'T00:00:00'),
    examinationType: getExamTypeLabel(exam.examinationType ?? 'ultrasound_prenatal'),
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
    return <PageLoader description="Loading exams..." />;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>All Exams</h1>

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

      {/* Task 7: Filter bar with disabled={isLoading} on selects */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 280px' }}>
          <Select
            id="patientFilter"
            labelText="Filter by Patient"
            value={selectedPatientId}
            onChange={(e) => handlePatientFilter(e.target.value)}
            aria-label="Filter examinations by patient"
            disabled={isLoading}
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
            disabled={isLoading}
          >
            <SelectItem value="" text="All Statuses" />
            <SelectItem value="draft" text="Draft" />
            <SelectItem value="completed" text="Completed" />
            <SelectItem value="reviewed" text="Reviewed" />
          </Select>
        </div>
        <div style={{ flex: '0 0 200px' }}>
          <Select
            id="examTypeFilter"
            labelText="Filter by Type"
            value={selectedExamType}
            onChange={(e) => handleExamTypeFilter(e.target.value)}
            aria-label="Filter examinations by type"
            disabled={isLoading}
          >
            <SelectItem value="" text="All Types" />
            {EXAM_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key} text={t.label} />
            ))}
          </Select>
        </div>
        {/* Task 7: DatePicker with dateTimerRef debounce */}
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
              // UI reflects picks immediately
              setFromDate(from);
              setToDate(to);
              // Task 4: write URL immediately
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (from) next.set('from', from); else next.delete('from');
                if (to) next.set('to', to); else next.delete('to');
                return next;
              });
              // Task 7: debounce the API call to avoid firing mid-range-pick
              if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
              dateTimerRef.current = setTimeout(() => {
                if (from && to) {
                  handleDateFilter(from, to);
                } else if (!from && !to) {
                  handleDateFilter('', '');
                }
              }, 300);
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

      {/* Task 8: 2-char hint */}
      {searchInfo && (
        <InlineNotification
          kind="info"
          title=""
          subtitle={searchInfo}
          lowContrast
          hideCloseButton
          style={{ marginBottom: '1rem' }}
        />
      )}

      {/* Task 10: search mode banner */}
      {searchQuery.trim().length >= 2 && (
        <ActionableNotification
          kind="info"
          lowContrast
          inline
          title=""
          subtitle={`Showing search results for "${searchQuery}".`}
          actionButtonLabel="Clear search"
          onActionButtonClick={() => handleSearch('')}
          style={{ marginBottom: '1rem' }}
        />
      )}

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
            title="All Exams"
            description={
              searchQuery.trim().length >= 2
                ? `${totalItems} result${totalItems !== 1 ? 's' : ''} found matching "${searchQuery}"`
                : `${totalItems} exam${totalItems !== 1 ? 's' : ''} found`
            }
            {...getTableContainerProps()}
          >
            <TableToolbar>
              <TableToolbarContent>
                {/* Task 8: persistent search with Escape handler (Task 10) */}
                <TableToolbarSearch
                  placeholder="Search by patient name..."
                  onChange={(e: any) => handleSearch(e.target?.value ?? e)}
                  value={searchQuery}
                  persistent
                  aria-label="Search examinations by patient name"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Escape') handleSearch('');
                  }}
                />
                {/* Task 8: inline searching indicator */}
                {isSearching && (
                  <InlineLoading description="Searching..." style={{ width: 'auto' }} />
                )}
                {/* TASK-010: hide Create for viewer */}
                {canCreate && (
                  <Button
                    renderIcon={Add}
                    onClick={handleCreateExamination}
                    aria-label="Create new exam"
                  >
                    Create Exam
                  </Button>
                )}
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()} aria-label="All Exams table">
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
                {!isLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      {/* Task 12: contextual empty state */}
                      {isFilterActive ? (
                        <ActionableNotification
                          kind="info"
                          lowContrast
                          inline
                          title="No examinations match the current filters."
                          subtitle={activeFilterSummary ? `Active filters: ${activeFilterSummary}` : ''}
                          actionButtonLabel="Clear all filters"
                          onActionButtonClick={clearAllFilters}
                          style={{ marginTop: '1rem', marginBottom: '1rem' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                          No ultrasound prenatal exams yet. Click &quot;Create Exam&quot; to get started.
                        </div>
                      )}
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
          // Task 4: write page to URL (push)
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('page', String(newPage));
            return next;
          });
        }}
        style={{ marginTop: '1rem' }}
      />

      {/* Task 10: hide Load More in search mode */}
      {hasMore && searchQuery.trim().length < 2 && (
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
