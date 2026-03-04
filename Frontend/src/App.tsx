import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import type { MemberRole } from '@/types';

// Layout
import AppLayout from '@/components/layout/AppLayout';

// Auth pages (no layout)
import Login        from '@/pages/auth/Login';
import Register     from '@/pages/auth/Register';
import VerifyEmail  from '@/pages/auth/VerifyEmail';
import GetStarted   from '@/pages/GetStarted';

// Admin pages
import AdminDashboard     from '@/pages/admin/Dashboard';
import AdminGames         from '@/pages/admin/Games';
import AdminGameDetail    from '@/pages/admin/GameDetail';
import AdminIncidents     from '@/pages/admin/Incidents';
import AdminUsers         from '@/pages/admin/Users';
import AdminImport        from '@/pages/admin/Import';
import AdminNotifications  from '@/pages/admin/Notifications';
import AdminMemberProfile  from '@/pages/admin/MemberProfile';

// Umpire pages
import UmpireDashboard   from '@/pages/umpire/Dashboard';
import UmpireGames       from '@/pages/umpire/Games';
import UmpireSubmissions from '@/pages/umpire/Submissions';

// Manager pages
import ManagerDashboard   from '@/pages/manager/Dashboard';
import ManagerGames       from '@/pages/manager/Games';
import ManagerSubmissions from '@/pages/manager/Submissions';

// Shared
import SubmissionStepper from '@/pages/shared/SubmissionStepper';

// ─── Route guards ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
    </div>
  );
}

/** Redirect authenticated users to their role-appropriate home. */
function RoleRedirect() {
  const { isLoading, isAuthenticated, orgId, orgRole } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!orgId) return <Navigate to="/get-started" replace />;
  if (orgRole === 'ADMIN')   return <Navigate to="/admin"   replace />;
  if (orgRole === 'UMPIRE')  return <Navigate to="/umpire"  replace />;
  return <Navigate to="/manager" replace />;
}

/**
 * Wraps a route so it requires authentication.
 * If the user has no org yet they go to /get-started.
 * Optionally restrict to specific org roles.
 */
function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: MemberRole[];
}) {
  const { isLoading, isAuthenticated, orgId, orgRole } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!orgId) return <Navigate to="/get-started" replace />;
  if (roles && orgRole && !roles.includes(orgRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public (no layout) ────────────────────────────────────────────── */}
      <Route path="/login"         element={<Login />} />
      <Route path="/register"      element={<Register />} />
      <Route path="/verify-email"  element={<VerifyEmail />} />
      <Route path="/get-started"   element={<GetStarted />} />

      {/* ── Protected (inside AppLayout) ──────────────────────────────────── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin */}
        <Route
          path="/admin"
          element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/admin/games"
          element={<ProtectedRoute roles={['ADMIN']}><AdminGames /></ProtectedRoute>}
        />
        <Route
          path="/admin/games/:gameId"
          element={<ProtectedRoute roles={['ADMIN']}><AdminGameDetail /></ProtectedRoute>}
        />
        <Route
          path="/admin/incidents"
          element={<ProtectedRoute roles={['ADMIN']}><AdminIncidents /></ProtectedRoute>}
        />
        <Route
          path="/admin/users"
          element={<ProtectedRoute roles={['ADMIN']}><AdminUsers /></ProtectedRoute>}
        />
        <Route
          path="/admin/import"
          element={<ProtectedRoute roles={['ADMIN']}><AdminImport /></ProtectedRoute>}
        />
        <Route
          path="/admin/notifications"
          element={<ProtectedRoute roles={['ADMIN']}><AdminNotifications /></ProtectedRoute>}
        />
        <Route
          path="/admin/members/:userId"
          element={<ProtectedRoute roles={['ADMIN']}><AdminMemberProfile /></ProtectedRoute>}
        />

        {/* Umpire */}
        <Route
          path="/umpire"
          element={<ProtectedRoute roles={['UMPIRE']}><UmpireDashboard /></ProtectedRoute>}
        />
        <Route
          path="/umpire/games"
          element={<ProtectedRoute roles={['UMPIRE']}><UmpireGames /></ProtectedRoute>}
        />
        <Route
          path="/umpire/submissions"
          element={<ProtectedRoute roles={['UMPIRE']}><UmpireSubmissions /></ProtectedRoute>}
        />
        <Route
          path="/umpire/submissions/:submissionId"
          element={<ProtectedRoute roles={['UMPIRE']}><SubmissionStepper /></ProtectedRoute>}
        />

        {/* Manager / Coach */}
        <Route
          path="/manager"
          element={<ProtectedRoute roles={['MANAGER', 'COACH']}><ManagerDashboard /></ProtectedRoute>}
        />
        <Route
          path="/manager/games"
          element={<ProtectedRoute roles={['MANAGER', 'COACH']}><ManagerGames /></ProtectedRoute>}
        />
        <Route
          path="/manager/submissions"
          element={<ProtectedRoute roles={['MANAGER', 'COACH']}><ManagerSubmissions /></ProtectedRoute>}
        />
        <Route
          path="/manager/submissions/:submissionId"
          element={<ProtectedRoute roles={['MANAGER', 'COACH']}><SubmissionStepper /></ProtectedRoute>}
        />
      </Route>

      {/* ── Default ───────────────────────────────────────────────────────── */}
      <Route path="/"  element={<RoleRedirect />} />
      <Route path="*"  element={<RoleRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
