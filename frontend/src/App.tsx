import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import CreatePatientPage from './pages/CreatePatientPage';
import PatientDetailPage from './pages/PatientDetailPage';
import EditPatientPage from './pages/EditPatientPage';
import ExaminationsPage from './pages/ExaminationsPage';
import CreateExaminationPage from './pages/CreateExaminationPage';
import ExaminationDetailPage from './pages/ExaminationDetailPage';
import EditExaminationPage from './pages/EditExaminationPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/new"
          element={
            <ProtectedRoute>
              <CreatePatientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <ProtectedRoute>
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/edit"
          element={
            <ProtectedRoute>
              <EditPatientPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/examinations"
          element={
            <ProtectedRoute>
              <ExaminationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/examinations/new"
          element={
            <ProtectedRoute>
              <CreateExaminationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/examinations/:id"
          element={
            <ProtectedRoute>
              <ExaminationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/examinations/:id/edit"
          element={
            <ProtectedRoute>
              <EditExaminationPage />
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

// Made with Bob
