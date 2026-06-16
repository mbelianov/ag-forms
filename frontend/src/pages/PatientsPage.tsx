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
  TableToolbarSearch,
  Button,
  Pagination,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { patientService } from '../services/patientService';
import type { Patient } from '../types';

const headers = [
  { key: 'name', header: 'Name' },
  { key: 'age', header: 'Age' },
  { key: 'mrn', header: 'MRN' },
  { key: 'phone', header: 'Phone' },
  { key: 'createdAt', header: 'Created Date' },
];

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce timer for search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    // Clear existing timer
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    // If query is empty, show all patients
    if (!query.trim()) {
      setFilteredPatients(patients);
      setIsSearching(false);
      return;
    }

    // Debounce search by 300ms
    const timer = setTimeout(async () => {
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

    setSearchTimer(timer);
  }, [patients, searchTimer]);

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
    age: patient.age.toString(),
    mrn: patient.mrn,
    phone: patient.phone,
    createdAt: formatDate(patient.createdAt),
  }));

  // Pagination
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  if (isLoading && patients.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading patients..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Patients</h1>

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
                <TableToolbarSearch
                  placeholder="Search by name or MRN"
                  onChange={(e: any) => handleSearch(e.target?.value || e)}
                  value={searchQuery}
                  disabled={isSearching}
                />
                <Button
                  renderIcon={Add}
                  onClick={handleCreatePatient}
                >
                  Create Patient
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
                        {searchQuery
                          ? 'No patients found matching your search'
                          : 'No patients yet. Create your first patient to get started.'}
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
