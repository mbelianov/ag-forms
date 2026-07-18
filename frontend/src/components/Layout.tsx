import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Content,
  Theme,
} from '@carbon/react';
import { UserAvatar, Logout } from '@carbon/icons-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

/** Format an ISO date string for last-login display */
function formatLastLogin(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  const handleChangePassword = () => {
    setUserMenuOpen(false);
    navigate('/change-password');
  };

  const lastLoginStr = formatLastLogin((user as any)?.last_login);

  return (
    <Theme theme="white">
      <Header aria-label="AG Forms">
        <HeaderName href="/" prefix="">
          AG Forms
        </HeaderName>
        
        {isAuthenticated && user && (
          <HeaderNavigation aria-label="Main Navigation">
            <HeaderMenuItem href="/dashboard">Dashboard</HeaderMenuItem>
            <HeaderMenuItem href="/patients">Patients</HeaderMenuItem>
            <HeaderMenuItem href="/examinations">Exams</HeaderMenuItem>
            {/* TASK-011: Admin-only Users link */}
            {user.role === 'admin' && (
              <HeaderMenuItem href="/users">Users</HeaderMenuItem>
            )}
            {/* TASK-011 + TASK-023: Admin-only Audit Logs */}
            {user.role === 'admin' && (
              <HeaderMenuItem href="/audit-logs">Audit Logs</HeaderMenuItem>
            )}
          </HeaderNavigation>
        )}

        <HeaderGlobalBar>
          {isAuthenticated && user && (
            <>
              {/* User avatar with dropdown */}
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <HeaderGlobalAction
                  aria-label={lastLoginStr
                    ? `${user.full_name || user.username} (${user.role}) — Last login: ${lastLoginStr}`
                    : `${user.full_name || user.username} (${user.role})`}
                  tooltipAlignment="end"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  <UserAvatar size={20} />
                </HeaderGlobalAction>

                  {userMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '3rem',
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      zIndex: 9999,
                      minWidth: '200px',
                    }}
                  >
                    <div
                      style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', fontSize: '0.875rem', color: '#525252' }}
                    >
                      <strong>{user.full_name || user.username}</strong>
                      <div style={{ fontSize: '0.75rem' }}>{user.role}</div>
                      {lastLoginStr && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Last login: {lastLoginStr}
                        </div>
                      )}
                    </div>
                    <button
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#161616',
                      }}
                      onClick={handleChangePassword}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f4f4f4'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                    >
                      Change Password
                    </button>
                  </div>
                )}
              </div>

              <HeaderGlobalAction
                aria-label="Logout"
                tooltipAlignment="end"
                onClick={handleLogout}
              >
                <Logout size={20} />
              </HeaderGlobalAction>
            </>
          )}
        </HeaderGlobalBar>
      </Header>

      <Content>
        {children}
      </Content>
    </Theme>
  );
}

// Made with Bob
