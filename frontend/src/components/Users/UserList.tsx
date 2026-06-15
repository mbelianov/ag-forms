import React from 'react';
import {
    DataTable,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    Tag,
} from '@carbon/react';
import type { User } from '../../types';
import { format } from 'date-fns';

interface UserListProps {
    users: User[];
}

const headers = [
    { key: 'username', header: 'Username' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    { key: 'createdAt', header: 'Created' },
];

export const UserList: React.FC<UserListProps> = ({ users }) => {
    const getRoleTag = (role: string) => {
        const roleMap = {
            admin: { type: 'red', label: 'Admin' },
            doctor: { type: 'blue', label: 'Doctor' },
            viewer: { type: 'gray', label: 'Viewer' },
        };
        const config = roleMap[role as keyof typeof roleMap] || roleMap.viewer;
        return <Tag type={config.type as any}>{config.label}</Tag>;
    };

    const rows = users.map(user => ({
        id: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    }));

    return (
        <DataTable rows={rows} headers={headers}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                <Table {...getTableProps()}>
                    <TableHead>
                        <TableRow>
                            {headers.map((header: any) => (
                                <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                    {header.header}
                                </TableHeader>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row: any) => (
                            <TableRow {...getRowProps({ row })} key={row.id}>
                                {row.cells.map((cell: any) => (
                                    <TableCell key={cell.id}>
                                        {cell.info.header === 'role' ? (
                                            getRoleTag(cell.value)
                                        ) : cell.info.header === 'createdAt' && cell.value ? (
                                            format(new Date(cell.value), 'dd/MM/yyyy HH:mm')
                                        ) : (
                                            cell.value
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </DataTable>
    );
};

// Made with Bob