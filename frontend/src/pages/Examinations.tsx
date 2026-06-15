import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, InlineNotification, Loading } from '@carbon/react';
import { ExaminationList } from '../components/Examinations/ExaminationList';
import { ExaminationForm } from '../components/Examinations/ExaminationForm';
import { useExaminations } from '../hooks/useExaminations';
import { usePatients } from '../hooks/usePatients';
import type { Examination, CreateExaminationRequest, UpdateExaminationRequest } from '../types';

const Examinations: React.FC = () => {
    const navigate = useNavigate();
    const { examinations, isLoading, error, createExamination, updateExamination, deleteExamination, fetchExaminations } =
        useExaminations();
    const { patients } = usePatients();

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedExam, setSelectedExam] = React.useState<Examination | undefined>();
    const [notification, setNotification] = React.useState<{
        kind: 'success' | 'error';
        message: string;
    } | null>(null);

    React.useEffect(() => {
        fetchExaminations();
    }, [fetchExaminations]);

    const handleAdd = () => {
        setSelectedExam(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (exam: Examination) => {
        setSelectedExam(exam);
        setIsModalOpen(true);
    };

    const handleView = (exam: Examination) => {
        navigate(`/examinations/${exam.examinationId}`);
    };

    const handleDelete = async (exam: Examination) => {
        try {
            await deleteExamination(exam.examinationId, exam.etag);
            setNotification({
                kind: 'success',
                message: 'Examination deleted successfully',
            });
        } catch (err) {
            setNotification({
                kind: 'error',
                message: 'Failed to delete examination',
            });
            throw err;
        }
    };

    const handleSubmit = async (data: CreateExaminationRequest | UpdateExaminationRequest) => {
        try {
            if (selectedExam) {
                await updateExamination(selectedExam.examinationId, data as UpdateExaminationRequest);
                setNotification({
                    kind: 'success',
                    message: 'Examination updated successfully',
                });
            } else {
                await createExamination(data as CreateExaminationRequest);
                setNotification({
                    kind: 'success',
                    message: 'Examination created successfully',
                });
            }
            setIsModalOpen(false);
        } catch (err) {
            throw err;
        }
    };

    if (isLoading) {
        return <Loading description="Loading examinations..." />;
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Examination Management</h1>

            {notification && (
                <InlineNotification
                    kind={notification.kind}
                    title={notification.kind === 'success' ? 'Success' : 'Error'}
                    subtitle={notification.message}
                    onClose={() => setNotification(null)}
                    style={{ marginBottom: '1rem' }}
                />
            )}

            {error && (
                <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error}
                    style={{ marginBottom: '1rem' }}
                />
            )}

            <ExaminationList
                examinations={examinations}
                onView={handleView}
                onEdit={handleEdit}
                onAdd={handleAdd}
                onDelete={handleDelete}
            />

            <Modal
                open={isModalOpen}
                modalHeading={selectedExam ? 'Edit Examination' : 'New Examination'}
                size="lg"
                onRequestClose={() => setIsModalOpen(false)}
                passiveModal
            >
                <ExaminationForm
                    examination={selectedExam}
                    patients={patients}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default Examinations;

// Made with Bob
