import api from './api';

export interface AuditLogEntry {
  auditId: string;
  action: string;
  userId: string;
  username?: string;
  actionTimestamp: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogsFilters {
  user?: string;
  action?: string;
  resourceType?: string;
  from_date?: string;
  to_date?: string;
  month?: string;
  continuationToken?: string;
}

class AuditService {
  private readonly AUDIT_BASE_URL = '/v1/audit-logs';

  async getAuditLogs(filters?: AuditLogsFilters): Promise<{ logs: AuditLogEntry[]; continuationToken?: string }> {
    try {
      const params: Record<string, string> = {};
      if (filters?.user) params.user = filters.user;
      if (filters?.action) params.action = filters.action;
      if (filters?.resourceType) params.resourceType = filters.resourceType;
      if (filters?.from_date) params.from_date = filters.from_date;
      if (filters?.to_date) params.to_date = filters.to_date;
      if (filters?.month) params.month = filters.month;
      if (filters?.continuationToken) params.continuationToken = filters.continuationToken;

      const response = await api.get<{ logs: AuditLogEntry[]; continuationToken?: string }>(
        this.AUDIT_BASE_URL, { params }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch audit logs';
      throw new Error(message);
    }
  }
}

export const auditService = new AuditService();

// Made with Bob
