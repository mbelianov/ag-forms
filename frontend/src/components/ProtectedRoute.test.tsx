// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../contexts/AuthContext', () => authMock);

import ProtectedRoute from './ProtectedRoute';

function renderRoute(role: 'admin' | 'doctor' | 'viewer' | null) {
  authMock.useAuth.mockReturnValue({
    isAuthenticated: role !== null,
    isLoading: false,
    user: role ? { id: 'u', username: 'u', full_name: 'U', email: 'u@example.com', role } : null,
  });
  render(
    <MemoryRouter initialEntries={['/email-settings']}>
      <Routes>
        <Route
          path="/email-settings"
          element={
            <ProtectedRoute allowedRoles={['doctor', 'admin']}>
              <div>Email settings content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute allowedRoles', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it.each(['doctor', 'admin'] as const)('lets %s in', (role) => {
    renderRoute(role);
    expect(screen.getByText('Email settings content')).toBeTruthy();
  });

  it('redirects a viewer to the dashboard', () => {
    renderRoute('viewer');
    expect(screen.queryByText('Email settings content')).toBeNull();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('redirects an unauthenticated user to login', () => {
    renderRoute(null);
    expect(screen.getByText('Login')).toBeTruthy();
  });
});
