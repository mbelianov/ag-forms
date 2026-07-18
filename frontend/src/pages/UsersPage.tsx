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
  Modal,
  Select,
  SelectItem,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';
import { userService } from '../services/userService';
import type { UserRecord } from '../services/userService';
import PageLoader from '../components/PageLoader';
import { formatDateShort } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reassignToId, setReassignToId] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Determine whether a given user is the last active admin
  const isLastAdmin = (u: UserRecord): boolean => {
    const activeAdmins = users.filter((x) => x.role === 'admin' && x.isActive);
    return u.role === 'admin' && activeAdmins.length <= 1;
  };

  const handleDeleteClick = (u: UserRecord) => {
    setDeleteTarget(u);
    setReassignToId('');
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await userService.deleteUser(deleteTarget.userId, reassignToId || undefined);
      setUsers((prev) => prev.filter((u) => u.userId !== deleteTarget.userId));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteModalClose = () => {
    if (isDeleting) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteError(null);
  };

  // Candidates for reassignment: active, non-deleted, excluding the user being deleted
  const reassignCandidates = users.filter(
    (u) => u.isActive && u.userId !== deleteTarget?.userId
  );

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

  // Check whether the delete button should be disabled for a given userId
  const isDeleteDisabled = (userId: string): boolean => {
    if (userId === (currentUser as any)?.id || userId === (currentUser as any)?.userId) return true;
    const u = users.find((x) => x.userId === userId);
    if (!u) return false;
    return isLastAdmin(u);
  };

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
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <Button kind="ghost" size="sm" renderIcon={Edit} onClick={() => navigate(`/users/${row.id}/edit`)}>
                                Edit
                              </Button>
                              <Button
                                kind="danger--ghost"
                                size="sm"
                                renderIcon={TrashCan}
                                onClick={() => {
                                  const u = users.find((x) => x.userId === row.id);
                                  if (u) handleDeleteClick(u);
                                }}
                                disabled={isDeleteDisabled(row.id)}
                              >
                                Delete
                              </Button>
                            </div>
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

      {/* Delete User Modal */}
      <Modal
        open={deleteModalOpen}
        danger
        modalHeading="Delete User"
        primaryButtonText={isDeleting ? 'Deleting…' : 'Delete'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={isDeleting || (reassignCandidates.length > 0 && !reassignToId)}
        onRequestSubmit={handleDeleteConfirm}
        onRequestClose={handleDeleteModalClose}
        onSecondarySubmit={handleDeleteModalClose}
      >
        {deleteTarget && (
          <div>
            <p>
              Are you sure you want to delete user <strong>{deleteTarget.fullName}</strong>{' '}
              (<code>{deleteTarget.username}</code>)?
            </p>
            <p style={{ marginTop: '0.75rem' }}>
              All examinations created by this user will be reassigned to the selected user.
            </p>

            {reassignCandidates.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <Select
                  id="reassign-to"
                  labelText="Reassign examinations to"
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  disabled={isDeleting}
                >
                  <SelectItem value="" text="— Select a user —" />
                  {reassignCandidates.map((u) => (
                    <SelectItem key={u.userId} value={u.userId} text={`${u.fullName} (${u.username})`} />
                  ))}
                </Select>
              </div>
            ) : (
              <p style={{ marginTop: '1rem', color: '#525252', fontSize: '0.875rem' }}>
                This user has no examinations. No reassignment needed.
              </p>
            )}

            {deleteError && (
              <InlineNotification
                kind="error"
                title="Error"
                subtitle={deleteError}
                onCloseButtonClick={() => setDeleteError(null)}
                lowContrast
                style={{ marginTop: '1rem' }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Made with Bob
