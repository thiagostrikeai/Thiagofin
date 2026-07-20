/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bills from './pages/Bills';
import Expenses from './pages/Expenses';
import Goals from './pages/Goals';
import Settings from './pages/Settings';

/** Spinner while Supabase auth state is resolving */
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    </div>
  );
}

/** Requires login — redirects to /login when unauthenticated */
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Login page — redirects to dashboard when already authenticated */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Público: login */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />

          {/* Protegido: app com sidebar + páginas */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="bills" element={<Bills />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="goals" element={<Goals />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Qualquer outra rota → home (ou login via ProtectedRoute) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
