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
  Button,
  Tag,
  InlineNotification,
  Pagination,
} from '@carbon/react';
import { Add, Edit } from '@carbon/icons-react';
import { userService } from '../services/userService';
import type { UserRecord } from '../services/userService';
import PageLoader from '../components/PageLoader';
import { formatDateShort } from '../utils/formatters';

const headers = [
  { key: 'username', header: 'Username' },
  { key: 'fullName', header: 'Full Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role' },
  { key: 'isActive', header: 'Active' },
  { key: 'createdAt', header: 'Created' },
  { key: 'actions', header: 'Actions' },
];

function roleBadge(role: string) {
  const kindMap: Record<string, any> = { admin: 'red', doctor: 'blue', viewer: 'gray' };
  return <Tag type={kindMap[role] ?? 'gray'}>{role}</Tag>;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const loadUsers = useCallback(async (_token?: string, append?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await userService.getUsers();
      if (append) {
        setUsers((prev) => [...prev, ...result.users]);
      } else {
        setUsers(result.users);
      }
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const rows = users.map((u) => ({
    id: u.userId,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive ? 'Yes' : 'No',
    createdAt: formatDateShort(u.createdAt),
    actions: u.userId,
  }));

  const totalItems = rows.length;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading && users.length === 0) return <PageLoader description="Loading users..." />;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>User Management</h1>
        <Button renderIcon={Add} onClick={() => navigate('/users/new')}>
          Create User
        </Button>
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

      <DataTable rows={paginatedRows} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
          <TableContainer title="Users" description={`${totalItems} user${totalItems !== 1 ? 's' : ''}`} {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label="Users table">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell) => {
                      if (cell.info.header === 'role') {
                        return <TableCell key={cell.id}>{roleBadge(cell.value as string)}</TableCell>;
                      }
                      if (cell.info.header === 'actions') {
                        return (
                          <TableCell key={cell.id}>
                            <Button kind="ghost" size="sm" renderIcon={Edit} onClick={() => navigate(`/users/${row.id}/edit`)}>
                              Edit
                            </Button>
                          </TableCell>
                        );
                      }
                      return <TableCell key={cell.id}>{cell.value}</TableCell>;
                    })}
                  </TableRow>
                ))}
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
          pageSizes={[10, 20, 50]}
          totalItems={totalItems}
          onChange={({ page: p, pageSize: ps }) => { setPage(p); setPageSize(ps); }}
          style={{ marginTop: '1rem' }}
        />
      )}
      {hasMore && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button kind="tertiary" onClick={() => loadUsers(continuationToken, true)} disabled={isLoading}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
