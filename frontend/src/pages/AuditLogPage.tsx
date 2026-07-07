import { useState, useEffect, useCallback } from 'react';
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
  TextInput,
  InlineNotification,
  Pagination,
} from '@carbon/react';
import { auditService } from '../services/auditService';
import type { AuditLogEntry } from '../services/auditService';
import PageLoader from '../components/PageLoader';
import { formatDateTime } from '../utils/formatters';

const headers = [
  { key: 'actionTimestamp', header: 'Timestamp' },
  { key: 'username', header: 'User' },
  { key: 'action', header: 'Action' },
  { key: 'ipAddress', header: 'IP Address' },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const loadLogs = useCallback(async (token?: string, append?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await auditService.getAuditLogs({
        user: filterUser || undefined,
        action: filterAction || undefined,
        continuationToken: token,
      });
      if (append) {
        setLogs((prev) => [...prev, ...result.logs]);
      } else {
        setLogs(result.logs);
      }
      setContinuationToken(result.continuationToken);
      setHasMore(!!result.continuationToken);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [filterUser, filterAction]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const rows = logs.map((log) => ({
    id: log.auditId,
    actionTimestamp: formatDateTime(log.actionTimestamp),
    username: log.username || log.userId,
    action: log.action,
    ipAddress: log.ipAddress || '—',
  }));

  const totalItems = rows.length;
  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading && logs.length === 0) return <PageLoader description="Loading audit logs..." />;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Audit Logs</h1>

      {error && (
        <InlineNotification kind="error" title="Error" subtitle={error} onCloseButtonClick={() => setError(null)} lowContrast style={{ marginBottom: '1rem' }} />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 220px' }}>
          <TextInput
            id="filterUser"
            labelText="Filter by User"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="Username or ID"
          />
        </div>
        <div style={{ flex: '0 0 220px' }}>
          <TextInput
            id="filterAction"
            labelText="Filter by Action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="e.g. USER_LOGIN"
          />
        </div>
        <Button onClick={() => { setPage(1); loadLogs(); }}>Apply Filters</Button>
      </div>

      <DataTable rows={paginatedRows} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
          <TableContainer title="Audit Logs" description={`${totalItems} log entries`} {...getTableContainerProps()}>
            <Table {...getTableProps()} aria-label="Audit logs table">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>No audit log entries found.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
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
          pageSizes={[20, 50, 100]}
          totalItems={totalItems}
          onChange={({ page: p, pageSize: ps }) => { setPage(p); setPageSize(ps); }}
          style={{ marginTop: '1rem' }}
        />
      )}
      {hasMore && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button kind="tertiary" onClick={() => loadLogs(continuationToken, true)} disabled={isLoading}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

// Made with Bob
