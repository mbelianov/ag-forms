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
  Button,
  Select,
  SelectItem,
  ComboBox,
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

  // ── Core state ─────────────────────────────────────────────────────────────
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExhausting, setIsExhausting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state (URL-derived)
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

  // Pagination
  const [page, setPage] = useState<number>(
    () => Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  );
  const [pageSize, setPageSize] = useState(10);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Patient combobox state (IMPL-010)
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [isPatientSearching, setIsPatientSearching] = useState(false);

  // Refs
  const dateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const patientSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientSearchAbortRef = useRef<AbortController | null>(null);

  // ── fetchOnePage — pure data fetcher, no state mutation ──────────────────
  const fetchOnePage = useCallback(async (opts?: {
    patientId?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    examinationType?: string;
    token?: string;
    signal?: AbortSignal;
  }) => {
    const result = await examinationService.getExaminations({
      patientId: opts?.patientId,
      status: opts?.status || undefined,
      from_date: opts?.from_date || undefined,
      to_date: opts?.to_date || undefined,
      examinationType: opts?.examinationType || undefined,
      continuationToken: opts?.token,
      signal: opts?.signal,
    });
    return { examinations: result.examinations, continuationToken: result.continuationToken };
  }, []);

  // ── startBrowse — browse mode: first page only ────────────────────────────
  const startBrowse = useCallback(async (opts?: {
    patientId?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    examinationType?: string;
  }) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchOnePage({ ...opts, signal: controller.signal });
      setExaminations(result.examinations);
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load examinations');
    } finally {
      setIsLoading(false);
    }
  }, [fetchOnePage]);

  // ── startFilterExhaustion — filter mode: auto-exhaust all pages ───────────
  const startFilterExhaustion = useCallback(async (opts: {
    patientId?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    examinationType?: string;
  }) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setIsExhausting(true);
    setIsLoading(true);
    setError(null);
    setExaminations([]);
    setHasMore(false);

    let token: string | undefined;
    let running: Examination[] = [];
    try {
      while (true) {
        const result = await fetchOnePage({ ...opts, token, signal: controller.signal });
        running = [...running, ...result.examinations];
        setExaminations([...running]);
        token = result.continuationToken;
        if (!token) break;
      }
      setContinuationToken(undefined);
      setHasMore(false);
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load examinations');
    } finally {
      setIsExhausting(false);
      setIsLoading(false);
    }
  }, [fetchOnePage]);

  // ── Mount: load initial data using URL-derived state ─────────────────────
  useEffect(() => {
    const urlPatient = searchParams.get('patient') || undefined;
    const urlStatus = searchParams.get('status') || undefined;
    const urlFrom = searchParams.get('from') || undefined;
    const urlTo = searchParams.get('to') || undefined;
    const urlType = searchParams.get('type') || undefined;
    const hasFilter = !!(urlPatient || urlStatus || urlFrom || urlTo || urlType);

    if (hasFilter) {
      startFilterExhaustion({ patientId: urlPatient, status: urlStatus, from_date: urlFrom, to_date: urlTo, examinationType: urlType });
    } else {
      startBrowse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
      if (patientSearchTimerRef.current) clearTimeout(patientSearchTimerRef.current);
      loadAbortRef.current?.abort();
      patientSearchAbortRef.current?.abort();
    };
  }, []);

  // ── Patient combobox handlers (IMPL-010) ──────────────────────────────────
  const handlePatientComboInputChange = (value: string) => {

    if (!value) {
      // Clear — reset patient filter and return to browse mode if no other filter active
      setSelectedPatientId('');
      setSelectedPatientName('');
      setPatientSearchResults([]);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('patient');
        next.set('page', '1');
        return next;
      });
      startBrowse({
        status: selectedStatus || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        examinationType: selectedExamType || undefined,
      });
      return;
    }

    if (value.trim().length < 2) {
      // Too short — clear results but preserve existing filter
      setPatientSearchResults([]);
      return;
    }

    // 2+ chars — debounce
    if (patientSearchTimerRef.current) clearTimeout(patientSearchTimerRef.current);
    patientSearchAbortRef.current?.abort();
    const controller = new AbortController();
    patientSearchAbortRef.current = controller;

    setIsPatientSearching(true);
    patientSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await patientService.searchPatients(value, controller.signal);
        setPatientSearchResults(results);
      } catch (err: any) {
        if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
        setPatientSearchResults([]);
      } finally {
        setIsPatientSearching(false);
      }
    }, 350);
  };

  const handlePatientComboSelect = (selectedItem: Patient | null) => {
    if (!selectedItem) {
      // Clear selection
      setSelectedPatientId('');
      setSelectedPatientName('');
      setPatientSearchResults([]);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('patient');
        next.set('page', '1');
        return next;
      });
      startBrowse({
        status: selectedStatus || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        examinationType: selectedExamType || undefined,
      });
      return;
    }

    setSelectedPatientId(selectedItem.patientId);
    setSelectedPatientName(selectedItem.name);
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('patient', selectedItem.patientId);
      next.set('page', '1');
      return next;
    });
    startFilterExhaustion({
      patientId: selectedItem.patientId,
      status: selectedStatus || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      examinationType: selectedExamType || undefined,
    });
  };

  // ── Other filter handlers ─────────────────────────────────────────────────
  const handleStatusFilter = (status: string) => {
    setContinuationToken(undefined);
    setSelectedStatus(status);
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status) next.set('status', status); else next.delete('status');
      next.set('page', '1');
      return next;
    });
    startFilterExhaustion({ patientId: selectedPatientId || undefined, status: status || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, examinationType: selectedExamType || undefined });
  };

  const handleExamTypeFilter = (type: string) => {
    setSelectedExamType(type);
    setPage(1);
    setContinuationToken(undefined);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (type) next.set('type', type); else next.delete('type');
      next.set('page', '1');
      return next;
    });
    startFilterExhaustion({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, from_date: fromDate || undefined, to_date: toDate || undefined, examinationType: type || undefined });
  };

  const handleDateFilter = (from: string, to: string) => {
    setContinuationToken(undefined);
    setPage(1);
    startFilterExhaustion({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, from_date: from || undefined, to_date: to || undefined, examinationType: selectedExamType || undefined });
  };

  const handleLoadMore = async () => {
    if (!continuationToken) return;
    setIsLoading(true);
    try {
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      const result = await fetchOnePage({
        patientId: selectedPatientId || undefined,
        status: selectedStatus || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        examinationType: selectedExamType || undefined,
        token: continuationToken,
        signal: controller.signal,
      });
      setExaminations((prev) => [...prev, ...result.examinations]);
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
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

  // ── Derived helpers ───────────────────────────────────────────────────────
  const isFilterActive = !!(selectedPatientId || selectedStatus || selectedExamType || fromDate || toDate);

  const activeFilterSummary = [
    selectedPatientId && selectedPatientName && `Patient: ${selectedPatientName}`,
    selectedStatus && `Status: ${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}`,
    selectedExamType && `Type: ${getExamTypeLabel(selectedExamType)}`,
    fromDate && `From: ${toDisplayDate(fromDate)}`,
    toDate && `To: ${toDisplayDate(toDate)}`,
  ].filter(Boolean).join(', ');

  const clearAllFilters = () => {
    setSelectedPatientId('');
    setSelectedStatus('');
    setSelectedExamType('');
    setFromDate('');
    setToDate('');
    setSelectedPatientName('');
    setPatientSearchResults([]);
    setContinuationToken(undefined);
    setPage(1);
    setSearchParams({});
    startBrowse();
  };

  // ── Count label ───────────────────────────────────────────────────────────
  const N = examinations.length;
  const examWord = N === 1 ? 'exam' : 'exams';
  const countLabel = isFilterActive
    ? (isExhausting ? `${N} ${examWord} found…` : `${N} ${examWord} found`)
    : `${N} ${examWord} loaded`;

  // ── Table rows ────────────────────────────────────────────────────────────
  const allRows = examinations.map((exam) => ({
    id: exam.examinationId,
    patientName: exam.patientName,
    patientId: exam.patientId,
    mrn: exam.mrn,
    examDate: formatDateShort(exam.examDate.includes('T') ? exam.examDate : exam.examDate + 'T00:00:00'),
    examinationType: getExamTypeLabel(exam.examinationType ?? 'ultrasound_prenatal'),
    gestationalAge: exam.gestationalAge || '—',
    status: exam.status,
    createdBy: exam.createdByName || exam.createdBy,
    actions: exam.examinationId,
  }));

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

      {/* Filter bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* Patient combobox (IMPL-010) */}
        <div style={{ flex: '0 0 280px' }}>
          <ComboBox<Patient>
            id="patientFilter"
            titleText="Filter by Patient"
            placeholder="Type to search patients..."
            items={patientSearchResults}
            itemToString={(item) => item?.name ?? ''}
            selectedItem={patientSearchResults.find(p => p.patientId === selectedPatientId) ?? null}
            onInputChange={handlePatientComboInputChange}
            onChange={({ selectedItem }) => handlePatientComboSelect(selectedItem ?? null)}
            shouldFilterItem={() => true}
            disabled={isLoading}
          />
          {isPatientSearching && <InlineLoading description="Searching..." style={{ width: 'auto' }} />}
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
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (from) next.set('from', from); else next.delete('from');
                if (to) next.set('to', to); else next.delete('to');
                return next;
              });
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
        {/* Create Exam button — outside DataTable */}
        {canCreate && (
          <Button
            renderIcon={Add}
            onClick={handleCreateExamination}
            aria-label="Create new exam"
            style={{ marginTop: 'auto' }}
          >
            Create Exam
          </Button>
        )}
      </div>

      {/* Filter mode exhaustion loading indicator */}
      {isExhausting && (
        <InlineLoading description="Loading all results..." style={{ marginBottom: '1rem' }} />
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
          <TableContainer {...getTableContainerProps()}>
            {/* Inline count label (IMPL-011) */}
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Exam List</span>
              <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', color: '#525252' }}>
                {countLabel}
              </span>
            </div>
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
                                  aria-label="View details for exam"
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
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('page', String(newPage));
            return next;
          });
        }}
        style={{ marginTop: '1rem' }}
      />

      {/* Load More Exams — browse mode only, hidden in filter mode */}
      {hasMore && !isFilterActive && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button
            kind="tertiary"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            Load More Exams
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
