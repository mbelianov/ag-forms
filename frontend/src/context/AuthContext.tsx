import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    isLoading: boolean;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state from localStorage
    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                try {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                    
                    // Verify token is still valid by fetching current user
                    const currentUser = await authApi.getCurrentUser();
                    setUser(currentUser);
                    localStorage.setItem('user', JSON.stringify(currentUser));
                } catch (error) {
                    // Token is invalid, clear storage
                    console.error('Failed to verify token:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                }
            }
            
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        try {
            const response = await authApi.login(username, password);
            
            setToken(response.token);
            setUser(response.user);
            
            // Store in localStorage
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            // Clear state and storage regardless of API call result
            setToken(null);
            setUser(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }, []);

    const refreshUser = useCallback(async () => {
        if (!token) return;
        
        try {
            const currentUser = await authApi.getCurrentUser();
            setUser(currentUser);
            localStorage.setItem('user', JSON.stringify(currentUser));
        } catch (error) {
            console.error('Failed to refresh user:', error);
            // If refresh fails, logout
            await logout();
        }
    }, [token, logout]);

    const value: AuthContextType = {
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Made with Bob
