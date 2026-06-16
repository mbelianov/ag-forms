import type { ReactNode } from 'react';
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

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

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
            <HeaderMenuItem href="/examinations">Examinations</HeaderMenuItem>
          </HeaderNavigation>
        )}

        <HeaderGlobalBar>
          {isAuthenticated && user && (
            <>
              <HeaderGlobalAction
                aria-label={`User: ${user.username} (${user.role})`}
                tooltipAlignment="end"
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
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
