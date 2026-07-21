import api from './api';

export interface UserRecord {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'doctor' | 'viewer';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: 'admin' | 'doctor' | 'viewer';
}

export interface UpdateUserRequest {
  fullName?: string;
  role?: 'admin' | 'doctor' | 'viewer';
  isActive?: boolean;
}

function extractMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { error?: { message?: string } | string } } }).response;
    const e = r?.data?.error;
    if (typeof e === 'object' && e?.message) return e.message;
    if (typeof e === 'string') return e;
  }
  return fallback;
}

class UserService {
  private readonly USERS_BASE_URL = '/v1/users';

  async getUsers(): Promise<{ users: UserRecord[]; continuationToken?: string }> {
    try {
      const response = await api.get<{ users: UserRecord[]; continuationToken?: string }>(this.USERS_BASE_URL);
      return response.data;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to fetch users'), { cause: err });
    }
  }

  async createUser(data: CreateUserRequest): Promise<UserRecord> {
    try {
      const response = await api.post<{ user: UserRecord }>(this.USERS_BASE_URL, data);
      return response.data.user;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to create user'), { cause: err });
    }
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserRecord> {
    try {
      const response = await api.put<{ user: UserRecord }>(`${this.USERS_BASE_URL}/${id}`, data);
      return response.data.user;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to update user'), { cause: err });
    }
  }

  async deleteUser(id: string, reassignTo?: string): Promise<void> {
    try {
      await api.delete(`${this.USERS_BASE_URL}/${id}`, {
        data: reassignTo ? { reassignTo } : undefined,
      });
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to delete user'), { cause: err });
    }
  }

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    try {
      await api.post(`${this.USERS_BASE_URL}/${id}/reset-password`, { newPassword });
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to reset password'), { cause: err });
    }
  }
}

export const userService = new UserService();

// Made with Bob
