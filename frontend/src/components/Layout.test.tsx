// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../contexts/AuthContext', () => authMock);

import Layout from './Layout';

function renderLayout(role: 'admin' | 'doctor' | 'viewer') {
  authMock.useAuth.mockReturnValue({
    isAuthenticated: true,
    logout: vi.fn(),
    user: { id: 'u', username: 'user1', full_name: 'Test User', email: 'u@example.com', role },
  });
  render(
    <MemoryRouter>
      <Layout>
        <div>content</div>
      </Layout>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /Test User \(/ }));
}

describe('Layout user menu', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it.each(['doctor', 'admin'] as const)('shows Email Settings for %s', (role) => {
    renderLayout(role);
    expect(screen.getByRole('button', { name: 'Email Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeTruthy();
  });

  it('hides Email Settings for viewer', () => {
    renderLayout('viewer');
    expect(screen.queryByRole('button', { name: 'Email Settings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeTruthy();
  });
});
