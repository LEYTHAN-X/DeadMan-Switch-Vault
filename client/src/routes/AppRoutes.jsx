import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from '../components/ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';

// Public Pages
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import RecipientVerifyPage from '../pages/RecipientVerifyPage';

// Protected Pages
import DashboardPage from '../pages/DashboardPage';
import VaultPage from '../pages/VaultPage';
import UploadEvidencePage from '../pages/UploadEvidencePage';
import ContactsPage from '../pages/ContactsPage';
import GmailPage from '../pages/GmailPage';
import CheckInConfigPage from '../pages/CheckInConfigPage';
import MonitoringPage from '../pages/MonitoringPage';
import ActivityPage from '../pages/ActivityPage';
import SettingsPage from '../pages/SettingsPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/contacts/verify/:token" element={<RecipientVerifyPage />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="vault" element={<VaultPage />} />
        <Route path="vault/upload" element={<UploadEvidencePage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="gmail" element={<GmailPage />} />
        <Route path="check-in" element={<CheckInConfigPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

