import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
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

const PrivateRoute = ({ children, roles }) => {
  const { currentUser } = useAuth();

  if (!currentUser) return <Navigate to="/dashboard" replace />;
  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  const { currentUser, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          Opening SIRTS preview...
        </div>
      </div>
    );
  }

  if (authError || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-6">
        <div className="w-full max-w-lg border border-red-500/20 bg-zinc-950 rounded-xl p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-red-400 font-semibold">SIRTS preview</p>
          <h1 className="text-xl font-semibold text-white mt-2">Preview session could not be established</h1>
          <p className="text-sm text-zinc-400 mt-3">{authError || 'No preview user is available.'}</p>
          <p className="text-xs text-zinc-600 mt-5">Refresh after the Supabase preview account is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/incidents" element={<PrivateRoute><IncidentsPage /></PrivateRoute>} />
        <Route path="/incidents/new" element={<PrivateRoute><NewIncidentPage /></PrivateRoute>} />
        <Route path="/incidents/:id" element={<PrivateRoute><IncidentDetailPage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute roles={['ADMIN','SOC_LEAD']}><ReportsPage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute roles={['ADMIN']}><UsersPage /></PrivateRoute>} />
        <Route path="/knowledge-base" element={<PrivateRoute><KnowledgeBasePage /></PrivateRoute>} />
        <Route path="/knowledge-base/:id" element={<PrivateRoute><KnowledgeBaseArticlePage /></PrivateRoute>} />
        <Route path="/assets" element={<PrivateRoute><AssetsPage /></PrivateRoute>} />
        <Route path="/audit-logs" element={<PrivateRoute roles={['ADMIN','SOC_LEAD']}><AuditLogsPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
