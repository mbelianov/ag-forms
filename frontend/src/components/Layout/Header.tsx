import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Header as CarbonHeader,
    HeaderName,
    HeaderNavigation,
    HeaderMenuItem,
    HeaderGlobalBar,
    HeaderGlobalAction,
} from '@carbon/react';
import { Logout, User } from '@carbon/icons-react';
import { useAuth } from '../../hooks/useAuth';

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <CarbonHeader aria-label="Prenatal Ultrasound System">
            <HeaderName href="#" prefix="" onClick={() => navigate('/dashboard')}>
                Prenatal Ultrasound System
            </HeaderName>
            <HeaderNavigation aria-label="Main Navigation">
                <HeaderMenuItem
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/dashboard');
                    }}
                    isActive={isActive('/dashboard')}
                >
                    Dashboard
                </HeaderMenuItem>
                <HeaderMenuItem
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/patients');
                    }}
                    isActive={isActive('/patients')}
                >
                    Patients
                </HeaderMenuItem>
                <HeaderMenuItem
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/examinations');
                    }}
                    isActive={isActive('/examinations')}
                >
                    Examinations
                </HeaderMenuItem>
            </HeaderNavigation>
            <HeaderGlobalBar>
                <HeaderGlobalAction
                    aria-label="User Profile"
                    tooltipAlignment="end"
                    onClick={() => {}}
                >
                    <User size={20} />
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                        {user?.username}
                    </span>
                </HeaderGlobalAction>
                <HeaderGlobalAction
                    aria-label="Logout"
                    tooltipAlignment="end"
                    onClick={handleLogout}
                >
                    <Logout size={20} />
                </HeaderGlobalAction>
            </HeaderGlobalBar>
        </CarbonHeader>
    );
};

// Made with Bob
