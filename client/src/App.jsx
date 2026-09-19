import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { hasCapability } from './lib/rbac.js';
import Navbar from './components/Navbar.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import NeuralBackdrop from './components/NeuralBackdrop.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import IncidentDetailPage from './pages/IncidentDetailPage.jsx';
import NewIncidentPage from './pages/NewIncidentPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import KnowledgeBasePage from './pages/KnowledgeBasePage.jsx';
import KnowledgeBaseArticlePage from './pages/KnowledgeBaseArticlePage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';

const PrivateRoute = ({ children, capability }) => {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (capability && !hasCapability(currentUser.role, capability)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  const { currentUser, loading, authError } = useAuth();

  return (
    <div className="app-shell">
      <NeuralBackdrop muted={Boolean(currentUser)} />
      <div className="app-content">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              Initialising SIRTS...
            </div>
          </div>
        ) : (
          <>
            {currentUser && <Navbar />}
            {authError && currentUser && (
              <div className="mx-auto max-w-screen-2xl px-6 pt-4">
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                  {authError}
                </div>
              </div>
            )}
            <ErrorBoundary>
              <Routes>
              <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
              <Route path="/incidents" element={<PrivateRoute><IncidentsPage /></PrivateRoute>} />
              <Route path="/incidents/new" element={<PrivateRoute><NewIncidentPage /></PrivateRoute>} />
              <Route path="/incidents/:id" element={<PrivateRoute><IncidentDetailPage /></PrivateRoute>} />
              <Route path="/reports" element={<PrivateRoute capability="reports.view"><ReportsPage /></PrivateRoute>} />
              <Route path="/users" element={<PrivateRoute capability="users.manage"><UsersPage /></PrivateRoute>} />
              <Route path="/knowledge-base" element={<PrivateRoute><KnowledgeBasePage /></PrivateRoute>} />
              <Route path="/knowledge-base/:id" element={<PrivateRoute><KnowledgeBaseArticlePage /></PrivateRoute>} />
              <Route path="/assets" element={<PrivateRoute><AssetsPage /></PrivateRoute>} />
              <Route path="/audit-logs" element={<PrivateRoute capability="audit.view"><AuditLogsPage /></PrivateRoute>} />
              <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
              </Routes>
            </ErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}
