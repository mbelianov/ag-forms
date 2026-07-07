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

class UserService {
  private readonly USERS_BASE_URL = '/v1/users';

  async getUsers(): Promise<{ users: UserRecord[]; continuationToken?: string }> {
    try {
      const response = await api.get<{ users: UserRecord[]; continuationToken?: string }>(this.USERS_BASE_URL);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch users';
      throw new Error(message);
    }
  }

  async createUser(data: CreateUserRequest): Promise<UserRecord> {
    try {
      const response = await api.post<{ user: UserRecord }>(this.USERS_BASE_URL, data);
      return response.data.user;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to create user';
      throw new Error(message);
    }
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserRecord> {
    try {
      const response = await api.put<{ user: UserRecord }>(`${this.USERS_BASE_URL}/${id}`, data);
      return response.data.user;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to update user';
      throw new Error(message);
    }
  }
}

export const userService = new UserService();

// Made with Bob
