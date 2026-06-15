import React, { useState } from 'react';
import { 
    Search, 
    Button, 
    TextInput, 
    NumberInput,
    Select,
    SelectItem,
    InlineNotification,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import type { Patient } from '../../types';
import { searchPatients, getPatientByMRN } from '../../api/patients';

interface PatientSearchProps {
    onSelect: (patient: Patient) => void;
}

export const PatientSearch: React.FC<PatientSearchProps> = ({ onSelect }) => {
    const [searchType, setSearchType] = useState<'name' | 'mrn'>('name');
    const [query, setQuery] = useState('');
    const [minAge, setMinAge] = useState<number | undefined>(undefined);
    const [maxAge, setMaxAge] = useState<number | undefined>(undefined);
    const [results, setResults] = useState<Patient[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setError(null);
        setHasSearched(true);

        // Validate inputs
        if (!query.trim() && searchType !== 'name') {
            setError('Please enter a search term');
            return;
        }

        if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
            setError('Minimum age cannot be greater than maximum age');
            return;
        }

        setIsSearching(true);

        try {
            let patients: Patient[] = [];

            if (searchType === 'mrn') {
                // Search by MRN - exact match
                try {
                    const patient = await getPatientByMRN(query.trim());
                    patients = [patient];
                } catch (err: any) {
                    // If not found, return empty array
                    if (err.message?.includes('not found') || err.response?.status === 404) {
                        patients = [];
                    } else {
                        throw err;
                    }
                }
            } else {
                // Search by name
                patients = await searchPatients({
                    query: query.trim(),
                    searchBy: 'name',
                });
            }

            // Apply age filters if specified
            if (minAge !== undefined || maxAge !== undefined) {
                patients = patients.filter(patient => {
                    if (minAge !== undefined && patient.age < minAge) return false;
                    if (maxAge !== undefined && patient.age > maxAge) return false;
                    return true;
                });
            }

            setResults(patients);
        } catch (err: any) {
            console.error('Search failed:', err);
            setError(err.message || 'Search failed. Please try again.');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleClearFilters = () => {
        setQuery('');
        setMinAge(undefined);
        setMaxAge(undefined);
        setResults([]);
        setError(null);
        setHasSearched(false);
        setSearchType('name');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '1rem' }}>
                <h4>Search Patients</h4>
            </div>

            {error && (
                <InlineNotification
                    kind="error"
                    title="Search Error"
                    subtitle={error}
                    onCloseButtonClick={() => setError(null)}
                    style={{ marginBottom: '1rem' }}
                />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <Select
                    id="search-type"
                    labelText="Search by"
                    value={searchType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setSearchType(e.target.value as 'name' | 'mrn');
                        setQuery('');
                        setResults([]);
                        setHasSearched(false);
                    }}
                >
                    <SelectItem value="name" text="Name" />
                    <SelectItem value="mrn" text="Medical Record Number (MRN)" />
                </Select>

                <div>
                    {searchType === 'name' ? (
                        <Search
                            id="search-input"
                            labelText="Search term"
                            placeholder="Enter patient name..."
                            value={query}
                            onChange={(e: any) => setQuery(e.target?.value || e || '')}
                            onKeyPress={handleKeyPress}
                            disabled={isSearching}
                        />
                    ) : (
                        <TextInput
                            id="mrn-input"
                            labelText="Medical Record Number"
                            placeholder="MRN-2026-000001"
                            value={query}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isSearching}
                        />
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <NumberInput
                    id="min-age"
                    label="Minimum Age"
                    placeholder="e.g., 2"
                    min={2}
                    max={99}
                    value={minAge}
                    onChange={(e: any) => {
                        const value = e.target?.value;
                        setMinAge(value === '' ? undefined : Number(value));
                    }}
                    disabled={isSearching}
                    allowEmpty
                />

                <NumberInput
                    id="max-age"
                    label="Maximum Age"
                    placeholder="e.g., 99"
                    min={2}
                    max={99}
                    value={maxAge}
                    onChange={(e: any) => {
                        const value = e.target?.value;
                        setMaxAge(value === '' ? undefined : Number(value));
                    }}
                    disabled={isSearching}
                    allowEmpty
                />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? 'Searching...' : 'Search'}
                </Button>
                <Button 
                    kind="secondary" 
                    renderIcon={Reset}
                    onClick={handleClearFilters}
                    disabled={isSearching}
                >
                    Clear Filters
                </Button>
            </div>

            {hasSearched && (
                <div style={{ marginTop: '2rem' }}>
                    {results.length > 0 ? (
                        <>
                            <h4 style={{ marginBottom: '1rem' }}>
                                Search Results ({results.length} {results.length === 1 ? 'patient' : 'patients'} found)
                            </h4>
                            <div style={{ 
                                border: '1px solid #e0e0e0', 
                                borderRadius: '4px',
                                overflow: 'hidden',
                            }}>
                                {results.map((patient, index) => (
                                    <div
                                        key={patient.patientId}
                                        style={{
                                            padding: '1rem',
                                            borderBottom: index < results.length - 1 ? '1px solid #e0e0e0' : 'none',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                            backgroundColor: '#ffffff',
                                        }}
                                        onClick={() => onSelect(patient)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f4f4f4';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div>
                                                <strong style={{ fontSize: '1.1rem' }}>{patient.name}</strong>
                                                <div style={{ marginTop: '0.25rem', color: '#525252' }}>
                                                    <span>MRN: {patient.mrn}</span>
                                                    {' | '}
                                                    <span>Age: {patient.age} years</span>
                                                </div>
                                                <div style={{ marginTop: '0.25rem', color: '#525252', fontSize: '0.875rem' }}>
                                                    <span>Phone: {patient.phone}</span>
                                                    {patient.email && (
                                                        <>
                                                            {' | '}
                                                            <span>Email: {patient.email}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <Button size="sm" kind="ghost">
                                                Select
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <InlineNotification
                            kind="info"
                            title="No Results"
                            subtitle="No patients found matching your search criteria. Try adjusting your filters."
                            hideCloseButton
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// Made with Bob