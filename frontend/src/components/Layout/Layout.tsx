import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';

const Layout: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />
            <main style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;

// Made with Bob
