import React from 'react';
import {
    DataTable,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableHeader,
    TableBody,
    TableCell,
    Button,
    TableToolbar,
    TableToolbarContent,
    TableToolbarSearch,
    Pagination,
} from '@carbon/react';
import { Add, View, Edit, TrashCan } from '@carbon/icons-react';
import type { Patient } from '../../types';
import { format } from 'date-fns';

interface PatientListProps {
    patients: Patient[];
    onView: (patient: Patient) => void;
    onEdit: (patient: Patient) => void;
    onDelete: (patient: Patient) => void;
    onAdd: () => void;
    isLoading?: boolean;
}

const headers = [
    { key: 'mrn', header: 'MRN' },
    { key: 'name', header: 'Name' },
    { key: 'age', header: 'Age' },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    { key: 'createdAt', header: 'Created' },
    { key: 'actions', header: 'Actions' },
];

export const PatientList: React.FC<PatientListProps> = ({
    patients,
    onView,
    onEdit,
    onDelete,
    onAdd,
    isLoading = false,
}) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(10);

    const filteredPatients = patients.filter(
        (patient) =>
            patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            patient.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
            patient.phone.includes(searchTerm)
    );

    const paginatedPatients = filteredPatients.slice(
        (page - 1) * pageSize,
        page * pageSize
    );

    const rows = paginatedPatients.map((patient) => ({
        id: patient.patientId,
        mrn: patient.mrn,
        name: patient.name,
        age: patient.age,
        phone: patient.phone,
        email: patient.email || '-',
        createdAt: format(new Date(patient.createdAt), 'dd/MM/yyyy'),
        actions: (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={View}
                    iconDescription="View"
                    hasIconOnly
                    onClick={() => onView(patient)}
                />
                <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Edit}
                    iconDescription="Edit"
                    hasIconOnly
                    onClick={() => onEdit(patient)}
                />
                <Button
                    kind="danger--ghost"
                    size="sm"
                    renderIcon={TrashCan}
                    iconDescription="Delete"
                    hasIconOnly
                    onClick={() => onDelete(patient)}
                />
            </div>
        ),
    }));

    return (
        <DataTable rows={rows} headers={headers}>
            {({
                rows,
                headers,
                getTableProps,
                getHeaderProps,
                getRowProps,
            }) => (
                <TableContainer>
                    <TableToolbar>
                        <TableToolbarContent>
                            <TableToolbarSearch
                                placeholder="Search patients..."
                                onChange={(e: any) =>
                                    setSearchTerm(e.target?.value || e || '')
                                }
                            />
                            <Button
                                kind="primary"
                                renderIcon={Add}
                                onClick={onAdd}
                            >
                                Add Patient
                            </Button>
                        </TableToolbarContent>
                    </TableToolbar>
                    <Table {...getTableProps()}>
                        <TableHead>
                            <TableRow>
                                {headers.map((header) => (
                                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                        {header.header}
                                    </TableHeader>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow {...getRowProps({ row })} key={row.id}>
                                    {row.cells.map((cell) => (
                                        <TableCell key={cell.id}>
                                            {cell.value}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filteredPatients.length > 0 && (
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            pageSizes={[10, 20, 30, 40, 50]}
                            totalItems={filteredPatients.length}
                            onChange={({ page, pageSize }) => {
                                setPage(page);
                                setPageSize(pageSize);
                            }}
                        />
                    )}
                </TableContainer>
            )}
        </DataTable>
    );
};

// Made with Bob