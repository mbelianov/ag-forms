import React from 'react';
import { Search, Button } from '@carbon/react';
import type { Patient } from '../../types';

interface PatientSearchProps {
    onSearch: (query: string) => Promise<Patient[]>;
    onSelect: (patient: Patient) => void;
}

export const PatientSearch: React.FC<PatientSearchProps> = ({
    onSearch,
    onSelect,
}) => {
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<Patient[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const patients = await onSearch(query);
            setResults(patients);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <Search
                    labelText="Search patients"
                    placeholder="Search by name, MRN, or phone..."
                    value={query}
                    onChange={(e: any) => setQuery(e.target?.value || e || '')}
                    onKeyPress={(e: any) => e.key === 'Enter' && handleSearch()}
                    style={{ flex: 1 }}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                    Search
                </Button>
            </div>

            {results.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <h4>Search Results ({results.length})</h4>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {results.map((patient) => (
                            <li
                                key={patient.patientId}
                                style={{
                                    padding: '1rem',
                                    border: '1px solid #e0e0e0',
                                    marginBottom: '0.5rem',
                                    cursor: 'pointer',
                                }}
                                onClick={() => onSelect(patient)}
                            >
                                <strong>{patient.name}</strong> - {patient.mrn}
                                <br />
                                <small>
                                    Age: {patient.age} | Phone: {patient.phone}
                                </small>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// Made with Bob