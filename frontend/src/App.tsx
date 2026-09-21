import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import PatientsPage from './features/patients/PatientsPage';
import CreatePatientPage from './features/patients/CreatePatientPage';
import PatientDetailPage from './features/patients/PatientDetailPage';
import EditPatientPage from './features/patients/EditPatientPage';
import ExaminationsPage from './features/examinations/ExaminationsPage';
import CreateExaminationPage from './features/examinations/CreateExaminationPage';
import ExaminationDetailPage from './features/examinations/ExaminationDetailPage';
import EditExaminationPage from './features/examinations/EditExaminationPage';
import ChangePasswordPage from './features/auth/ChangePasswordPage';
import UsersPage from './features/users/UsersPage';
import CreateUserPage from './features/users/CreateUserPage';
import EditUserPage from './features/users/EditUserPage';
import AuditLogPage from './features/audit/AuditLogPage';

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
        {/* TASK-008: Change Password */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        {/* TASK-022: User management — admin only */}
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateUserPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id/edit"
          element={
            <ProtectedRoute requiredRole="admin">
              <EditUserPage />
            </ProtectedRoute>
          }
        />
        {/* TASK-023: Audit log — admin only */}
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requiredRole="admin">
              <AuditLogPage />
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
