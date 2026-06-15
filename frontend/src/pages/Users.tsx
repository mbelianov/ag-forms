import React, { useState } from 'react';
import {
    Button,
    InlineNotification,
    Modal,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { UserList } from '../components/Users/UserList';
import { UserForm } from '../components/Users/UserForm';
import type { User } from '../types';

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleUserCreated = (newUser: User) => {
        setUsers(prev => [...prev, newUser]);
        setShowCreateModal(false);
        setSuccessMessage(`User "${newUser.username}" created successfully!`);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>User Management</h1>
                    <p style={{ marginTop: '0.5rem', color: '#525252' }}>
                        Create and manage system users (Admin only)
                    </p>
                </div>
                <Button
                    renderIcon={Add}
                    onClick={() => setShowCreateModal(true)}
                >
                    Create New User
                </Button>
            </div>

            {successMessage && (
                <InlineNotification
                    kind="success"
                    title="Success"
                    subtitle={successMessage}
                    onCloseButtonClick={() => setSuccessMessage(null)}
                    style={{ marginBottom: '2rem' }}
                />
            )}

            <InlineNotification
                kind="info"
                title="User List API Not Available"
                subtitle="The backend does not currently provide an API to list all users. This page shows users created during this session only. To view all users, you would need to implement a GetUsers API endpoint in the backend."
                hideCloseButton
                style={{ marginBottom: '2rem' }}
            />

            {users.length > 0 ? (
                <div>
                    <h3 style={{ marginBottom: '1rem' }}>
                        Users Created This Session ({users.length})
                    </h3>
                    <UserList users={users} />
                </div>
            ) : (
                <div style={{ 
                    padding: '3rem', 
                    textAlign: 'center', 
                    border: '1px dashed #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: '#f4f4f4',
                }}>
                    <p style={{ color: '#525252', marginBottom: '1rem' }}>
                        No users created in this session yet.
                    </p>
                    <p style={{ color: '#525252', fontSize: '0.875rem' }}>
                        Click "Create New User" to add a new user to the system.
                    </p>
                </div>
            )}

            <Modal
                open={showCreateModal}
                onRequestClose={() => setShowCreateModal(false)}
                modalHeading="Create New User"
                passiveModal
                size="md"
            >
                <UserForm
                    onSuccess={handleUserCreated}
                    onCancel={() => setShowCreateModal(false)}
                />
            </Modal>
        </div>
    );
};

export default Users;

// Made with Bob