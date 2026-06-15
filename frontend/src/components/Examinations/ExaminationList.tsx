import React, { useState } from 'react';
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
    Tag,
    Modal,
} from '@carbon/react';
import { Add, View, Edit, TrashCan } from '@carbon/icons-react';
import type { Examination } from '../../types';
import { format } from 'date-fns';

interface ExaminationListProps {
    examinations: Examination[];
    onView: (exam: Examination) => void;
    onEdit: (exam: Examination) => void;
    onAdd: () => void;
    onDelete?: (exam: Examination) => Promise<void>;
}

const headers = [
    { key: 'examDate', header: 'Date' },
    { key: 'patientName', header: 'Patient' },
    { key: 'gestationalAge', header: 'GA' },
    { key: 'efw', header: 'EFW (g)' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: 'Actions' },
];

const getStatusTag = (status: string) => {
    const statusMap = {
        draft: { type: 'gray', label: 'Draft' },
        completed: { type: 'green', label: 'Completed' },
        reviewed: { type: 'blue', label: 'Reviewed' },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    return <Tag type={config.type as any}>{config.label}</Tag>;
};

export const ExaminationList: React.FC<ExaminationListProps> = ({
    examinations,
    onView,
    onEdit,
    onAdd,
    onDelete,
}) => {
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [examToDelete, setExamToDelete] = useState<Examination | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (exam: Examination) => {
        setExamToDelete(exam);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!examToDelete || !onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(examToDelete);
            setDeleteModalOpen(false);
            setExamToDelete(null);
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const rows = examinations.map((exam) => ({
        id: exam.examinationId,
        examDate: format(new Date(exam.examDate), 'dd/MM/yyyy'),
        patientName: exam.patientName,
        gestationalAge: exam.gestationalAge || '-',
        efw: exam.biometry?.efw || '-',
        status: getStatusTag(exam.status),
        actions: (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={View}
                    iconDescription="View"
                    hasIconOnly
                    onClick={() => onView(exam)}
                />
                <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Edit}
                    iconDescription="Edit"
                    hasIconOnly
                    onClick={() => onEdit(exam)}
                />
                {onDelete && (
                    <Button
                        kind="danger--ghost"
                        size="sm"
                        renderIcon={TrashCan}
                        iconDescription="Delete"
                        hasIconOnly
                        onClick={() => handleDeleteClick(exam)}
                    />
                )}
            </div>
        ),
    }));

    return (
        <>
            <DataTable rows={rows} headers={headers}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                    <TableContainer>
                        <TableToolbar>
                            <TableToolbarContent>
                                <Button kind="primary" renderIcon={Add} onClick={onAdd}>
                                    New Examination
                                </Button>
                            </TableToolbarContent>
                        </TableToolbar>
                        <Table {...getTableProps()}>
                            <TableHead>
                                <TableRow>
                                    {headers.map((header) => (
                                        <TableHeader {...getHeaderProps({ header })}>
                                            {header.header}
                                        </TableHeader>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow {...getRowProps({ row })}>
                                        {row.cells.map((cell) => (
                                            <TableCell key={cell.id}>{cell.value}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DataTable>

            <Modal
                open={deleteModalOpen}
                onRequestClose={() => !isDeleting && setDeleteModalOpen(false)}
                onRequestSubmit={handleDeleteConfirm}
                modalHeading="Delete Examination"
                primaryButtonText="Delete"
                secondaryButtonText="Cancel"
                danger
                primaryButtonDisabled={isDeleting}
                preventCloseOnClickOutside
            >
                <p>
                    Are you sure you want to delete this examination?
                </p>
                {examToDelete && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f4f4f4', borderRadius: '4px' }}>
                        <strong>Patient:</strong> {examToDelete.patientName}
                        <br />
                        <strong>Date:</strong> {format(new Date(examToDelete.examDate), 'dd/MM/yyyy')}
                        <br />
                        <strong>Status:</strong> {examToDelete.status}
                    </div>
                )}
                <p style={{ marginTop: '1rem', color: '#da1e28' }}>
                    <strong>Warning:</strong> This action cannot be undone.
                </p>
            </Modal>
        </>
    );
};

// Made with Bob
