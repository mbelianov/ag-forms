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
  Search,
  Button,
  Pagination,
  InlineNotification,
  InlineLoading,
  ActionableNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { calculateAgeAtDate } from '../utils/calculations';
import { formatDateShort } from '../utils/formatters';
import type { Patient } from '../types';

const headers = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age' },
  { key: 'phone', header: 'Phone' },
  { key: 'createdAt', header: 'Created Date' },
];

export default function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canCreate = user?.role !== 'viewer';

  // Task 5: URL-derived state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  // searchQuery mirrors what was last *submitted* (used for URL and banner)
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('q') || ''
  );
  // inputValue tracks the current typed value in the Search field (T4-03)
  const [inputValue, setInputValue] = useState<string>(
    () => searchParams.get('q') || ''
  );
  // isSearchActive is true only when a search has been submitted (T4-02)
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [page, setPage] = useState<number>(
    () => Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  );
  const [pageSize, setPageSize] = useState(10);

  // AbortControllers (Task 11 — timer ref removed per T4-03)
  const loadAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const loadPatients = useCallback(async (token?: string, append = false) => {
    // Task 11: abort previous in-flight request
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const response = await patientService.getPatients(token, controller.signal);
      // T4-04: append when loading more, replace on initial/clear load
      if (append) {
        setPatients(prev => [...prev, ...response.patients]);
        setFilteredPatients(prev => [...prev, ...response.patients]);
      } else {
        setPatients(response.patients);
        setFilteredPatients(response.patients);
      }
      setContinuationToken(response.continuationToken);
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Task 5 / 9: mount effect — load patients, then restore search if q is set
  useEffect(() => {
    const q = searchParams.get('q') || '';
    loadPatients();
    // If q is 2+ chars, trigger a search to restore results
    if (q.trim().length >= 2) {
      // handleSearch will be called after initial loadPatients resolves;
      // since searchPatients uses its own API call it is safe to fire in parallel.
      handleSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, []);

  // T4-03: handleSearch is called only on Enter submission or explicit clear
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setPage(1);

    // Task 5: write URL (replace — no extra history entry per keystroke)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (query) next.set('q', query); else next.delete('q');
      next.set('page', '1');
      return next;
    }, { replace: true });

    // Empty query — restore full list, clear all notices, reload browse list
    if (!query.trim()) {
      setFilteredPatients(patients);
      setIsSearching(false);
      setSearchInfo(null);
      setIsSearchActive(false); // T4-02
      loadPatients();
      return;
    }

    // Single character — show info hint, don't call the API
    if (query.trim().length < 2) {
      setFilteredPatients(patients);
      setSearchInfo('Type at least 2 characters to search.');
      return;
    }

    // Two or more characters — clear any lingering info hint and search
    setSearchInfo(null);
    // Task 9: synchronous token reset before API call
    setContinuationToken(undefined);

    // T4-03: abort previous search, dispatch immediately (no debounce)
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    try {
      const results = await patientService.searchPatients(query, controller.signal);
      setFilteredPatients(results);
      setIsSearchActive(true); // T4-02: mark search as active after successful dispatch
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED' || err.name === 'AbortError' || err.name === 'CanceledError') return;
      setError(err.message || 'Search failed');
      setFilteredPatients([]);
    } finally {
      setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, loadPatients]);

  const handleRowClick = (patientId: string) => {
    navigate(`/patients/${patientId}`);
  };

  const handleCreatePatient = () => {
    navigate('/patients/new');
  };

  // TASK-038: Display age from birthDate if available, else fall back to stored age
  const displayAge = (patient: Patient): string => {
    if (patient.birthDate) {
      const age = calculateAgeAtDate(patient.birthDate, new Date().toISOString().split('T')[0]);
      return age !== undefined ? `${age} yrs` : '—';
    }
    return patient.age !== undefined ? `${patient.age} yrs` : '—';
  };

  // Prepare rows for DataTable
  const rows = filteredPatients.map((patient) => ({
    id: patient.patientId,
    name: patient.name,
    age: displayAge(patient),
    phone: patient.phone,
    createdAt: formatDateShort(patient.createdAt),
  }));

  // Pagination
  const totalItems = rows.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  if (isLoading && patients.length === 0) {
    return <PageLoader description="Loading patients..." />;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Patients</h1>

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

      {/* Task 9: search mode banner — T4-02: use isSearchActive */}
      {/* FR-03: fixed-height slot always rendered so the table never shifts */}
      <div style={{ height: '40px', marginBottom: '1rem' }}>
        {isSearchActive && (
          <ActionableNotification
            kind="info"
            lowContrast
            inline
            title=""
            subtitle={`Showing search results for "${searchQuery}".`}
            actionButtonLabel="Clear search"
            onActionButtonClick={() => {
              setInputValue('');
              handleSearch('');
            }}
          />
        )}
      </div>

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

      {/* Search and actions live OUTSIDE DataTable so they are never re-mounted
          when paginatedRows changes and DataTable recreates its render-prop tree */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <Search
            id="patient-search"
            labelText=""
            placeholder="Search by name…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClear={() => {
              setInputValue('');
              handleSearch('');
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                handleSearch(inputValue);
              } else if (e.key === 'Escape') {
                setInputValue('');
                handleSearch('');
              }
            }}
            aria-label="Search patients"
          />
        </div>
        {isSearching && (
          <InlineLoading description="Searching..." style={{ width: 'auto', flexShrink: 0 }} />
        )}
        {/* TASK-010: hide Create for viewer */}
        {canCreate && (
          <Button
            renderIcon={Add}
            onClick={handleCreatePatient}
            aria-label="Create new patient"
            style={{ flexShrink: 0 }}
          >
            Create Patient
          </Button>
        )}
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
            {...getTableContainerProps()}
            style={{ textAlign: 'left' }}
          >
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Patient List</span>
              <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', color: '#525252' }}>
                {totalItems} patient{totalItems !== 1 ? 's' : ''} {isSearchActive ? 'found' : 'loaded'}
              </span>
            </div>
            <Table {...getTableProps()} aria-label="Patients table">
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
                      {isSearchActive ? (
                        <ActionableNotification
                          kind="info"
                          lowContrast
                          inline
                          title={`No patients found matching "${searchQuery}".`}
                          subtitle=""
                          actionButtonLabel="Clear search"
                          onActionButtonClick={() => {
                            setInputValue('');
                            handleSearch('');
                          }}
                          style={{ marginTop: '1rem', marginBottom: '1rem' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                          <p>No patients have been added yet.</p>
                          {canCreate && (
                            <Button
                              kind="ghost"
                              size="sm"
                              renderIcon={Add}
                              onClick={handleCreatePatient}
                              style={{ marginTop: '0.5rem' }}
                            >
                              Add Patient
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      {...getRowProps({ row })}
                      key={row.id}
                      onClick={() => handleRowClick(row.id)}
                      style={{ cursor: 'pointer' }}
                      aria-label={`View patient ${rows.find(r => r.id === row.id)?.cells[0]?.value ?? ''}`}
                    >
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))
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
            // Task 5: write page to URL (push)
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('page', String(newPage));
              return next;
            });
          }}
          style={{ marginTop: '1rem' }}
        />
      )}

      {/* Task 9: hide Load More in search mode — T4-02/T4-04: use isSearchActive */}
      {continuationToken && !isSearchActive && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button
            kind="tertiary"
            onClick={() => loadPatients(continuationToken, true)}
            disabled={isLoading}
          >
            Load More Patients
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
