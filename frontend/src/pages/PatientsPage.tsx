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
  Search,
  Button,
  Pagination,
  InlineNotification,
  InlineLoading,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import type { Patient } from '../types';

const headers = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age' },
  { key: 'phone', header: 'Phone' },
  { key: 'createdAt', header: 'Created Date' },
];

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Use ref for debounce timer to avoid stale closure issues
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPatients = useCallback(async (token?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await patientService.getPatients(token);
      setPatients(response.patients);
      setFilteredPatients(response.patients);
      setContinuationToken(response.continuationToken);
    } catch (err: any) {
      setError(err.message || 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);

    // Clear existing timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // Empty query — restore full list, clear all notices
    if (!query.trim()) {
      setFilteredPatients(patients);
      setIsSearching(false);
      setSearchInfo(null);
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

    // Debounce search by 300ms
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await patientService.searchPatients(query);
        setFilteredPatients(results);
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setFilteredPatients([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [patients]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleRowClick = (patientId: string) => {
    navigate(`/patients/${patientId}`);
  };

  const handleCreatePatient = () => {
    navigate('/patients/new');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Prepare rows for DataTable
  const rows = filteredPatients.map((patient) => ({
    id: patient.patientId,
    name: patient.name,
    age: `${patient.age} yrs`,
    phone: patient.phone,
    createdAt: formatDate(patient.createdAt),
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
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onClear={() => handleSearch('')}
            aria-label="Search patients"
          />
        </div>
        {isSearching && (
          <InlineLoading description="Searching..." style={{ width: 'auto', flexShrink: 0 }} />
        )}
        <Button
          renderIcon={Add}
          onClick={handleCreatePatient}
          aria-label="Create new patient"
          style={{ flexShrink: 0 }}
        >
          Create Patient
        </Button>
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
            title="Patient List"
            description={`${totalItems} patient${totalItems !== 1 ? 's' : ''} found`}
            {...getTableContainerProps()}
          >
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
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                        {searchQuery
                          ? `No patients found matching "${searchQuery}"`
                          : 'No patients yet. Click "Create Patient" to add your first patient.'}
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
          }}
          style={{ marginTop: '1rem' }}
        />
      )}

      {continuationToken && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button
            kind="tertiary"
            onClick={() => loadPatients(continuationToken)}
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
