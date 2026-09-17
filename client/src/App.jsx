import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
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

const PrivateRoute = ({ children, roles }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading session...</p>
      </div>
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  const { currentUser, loading } = useAuth();

  // Don't render routes at all until session is resolved — prevents flash redirects
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Initialising SIRTS...</p>
      </div>
    </div>
  );

  return (
    <>
      {currentUser && <Navbar />}
      <Routes>
        <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
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
        <Route path="*" element={<Navigate to={currentUser ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  );
}

