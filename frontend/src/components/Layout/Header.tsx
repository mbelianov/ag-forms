import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Header as CarbonHeader,
    HeaderName,
    HeaderNavigation,
    HeaderMenuItem,
    HeaderGlobalBar,
    HeaderGlobalAction,
    OverflowMenu,
    OverflowMenuItem,
} from '@carbon/react';
import { Logout, User } from '@carbon/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { ChangePasswordModal } from '../Auth/ChangePasswordModal';

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

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
        <>
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
                    {user?.role === 'admin' && (
                        <HeaderMenuItem
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate('/users');
                            }}
                            isActive={isActive('/users')}
                        >
                            Users
                        </HeaderMenuItem>
                    )}
                </HeaderNavigation>
                <HeaderGlobalBar>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#f4f4f4' }}>
                            {user?.username}
                        </span>
                        <OverflowMenu
                            ariaLabel="User menu"
                            iconDescription="User menu"
                            renderIcon={User}
                            flipped
                        >
                            <OverflowMenuItem
                                itemText="Change Password"
                                onClick={() => setIsChangePasswordOpen(true)}
                            />
                            <OverflowMenuItem
                                itemText="Logout"
                                onClick={handleLogout}
                                hasDivider
                            />
                        </OverflowMenu>
                    </div>
                </HeaderGlobalBar>
            </CarbonHeader>

            <ChangePasswordModal
                open={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />
        </>
    );
};

// Made with Bob
