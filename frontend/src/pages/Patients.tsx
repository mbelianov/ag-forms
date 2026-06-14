import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Modal,
    InlineNotification,
    Loading,
} from '@carbon/react';
import { PatientList } from '../components/Patients/PatientList';
import { PatientForm } from '../components/Patients/PatientForm';
import { usePatients } from '../hooks/usePatients';
import type { Patient, CreatePatientRequest } from '../types';

const Patients: React.FC = () => {
    const navigate = useNavigate();
    const { patients, isLoading, error, createPatient, updatePatient, deletePatient, fetchPatients } =
        usePatients();

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [selectedPatient, setSelectedPatient] = React.useState<Patient | undefined>();
    const [notification, setNotification] = React.useState<{
        kind: 'success' | 'error';
        message: string;
    } | null>(null);

    React.useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const handleAdd = () => {
        setSelectedPatient(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (patient: Patient) => {
        setSelectedPatient(patient);
        setIsModalOpen(true);
    };

    const handleView = (patient: Patient) => {
        navigate(`/patients/${patient.patientId}`);
    };

    const handleDelete = async (patient: Patient) => {
        if (window.confirm(`Delete patient ${patient.name}?`)) {
            try {
                await deletePatient(patient.patientId, patient.etag);
                setNotification({
                    kind: 'success',
                    message: 'Patient deleted successfully',
                });
            } catch (err) {
                setNotification({
                    kind: 'error',
                    message: 'Failed to delete patient',
                });
            }
        }
    };

    const handleSubmit = async (data: Partial<Patient>) => {
        try {
            if (selectedPatient) {
                await updatePatient(selectedPatient.patientId, data, selectedPatient.etag);
                setNotification({
                    kind: 'success',
                    message: 'Patient updated successfully',
                });
            } else {
                await createPatient(data as CreatePatientRequest);
                setNotification({
                    kind: 'success',
                    message: 'Patient created successfully',
                });
            }
            setIsModalOpen(false);
        } catch (err) {
            throw err;
        }
    };

    if (isLoading && patients.length === 0) {
        return <Loading description="Loading patients..." />;
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Patient Management</h1>

            {notification && (
                <InlineNotification
                    kind={notification.kind}
                    title={notification.kind === 'success' ? 'Success' : 'Error'}
                    subtitle={notification.message}
                    onClose={() => setNotification(null)}
                    style={{ marginBottom: '1rem', marginTop: '1rem' }}
                />
            )}

            {error && (
                <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error}
                    style={{ marginBottom: '1rem', marginTop: '1rem' }}
                />
            )}

            <PatientList
                patients={patients}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAdd}
                isLoading={isLoading}
            />

            <Modal
                open={isModalOpen}
                modalHeading={selectedPatient ? 'Edit Patient' : 'Add Patient'}
                primaryButtonText="Save"
                secondaryButtonText="Cancel"
                onRequestClose={() => setIsModalOpen(false)}
                passiveModal
            >
                <PatientForm
                    patient={selectedPatient}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default Patients;

// Made with Bob
