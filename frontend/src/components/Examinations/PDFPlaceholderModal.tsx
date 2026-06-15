import React from 'react';
import { Modal } from '@carbon/react';

interface PDFPlaceholderModalProps {
    open: boolean;
    onClose: () => void;
}

export const PDFPlaceholderModal: React.FC<PDFPlaceholderModalProps> = ({ open, onClose }) => {
    return (
        <Modal
            open={open}
            onRequestClose={onClose}
            modalHeading="PDF Generation Coming Soon"
            passiveModal
            size="sm"
        >
            <div style={{ padding: '1rem 0' }}>
                <h4 style={{ marginBottom: '1rem' }}>Feature Under Development</h4>
                
                <p style={{ marginBottom: '1rem' }}>
                    PDF report generation is currently under development and will be available in a future release.
                </p>

                <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f4f4f4', 
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    <h5 style={{ marginBottom: '0.5rem' }}>Planned Features:</h5>
                    <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                        <li>Professional A4 format report</li>
                        <li>Complete examination details with biometry and Doppler data</li>
                        <li>Graphical representation of measurements</li>
                        <li>Percentile charts and growth curves</li>
                        <li>Doctor's findings and recommendations</li>
                        <li>Hospital branding and letterhead</li>
                    </ul>
                </div>

                <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#e5f6ff', 
                    borderRadius: '4px',
                    borderLeft: '4px solid #0f62fe'
                }}>
                    <strong>Alternative:</strong> You can use the "Email Report" button to send the examination 
                    report directly to the patient's email address.
                </div>
            </div>
        </Modal>
    );
};

// Made with Bob