import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Examinations from './pages/Examinations';
import ExaminationDetail from './pages/ExaminationDetail';
import Users from './pages/Users';
import Layout from './components/Layout/Layout';

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="patients" element={<Patients />} />
                        <Route path="patients/:id" element={<PatientDetail />} />
                        <Route path="examinations" element={<Examinations />} />
                        <Route path="examinations/:id" element={<ExaminationDetail />} />
                        <Route
                            path="users"
                            element={
                                <ProtectedRoute requiredRole="admin">
                                    <Users />
                                </ProtectedRoute>
                            }
                        />
                    </Route>
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;

// Made with Bob
