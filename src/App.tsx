/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { JourneySearchPage } from './pages/JourneySearchPage';
import { JourneyDetailPage } from './pages/JourneyDetailPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { RoleManagementPage } from './pages/RoleManagementPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { SessionManagementPage } from './pages/SessionManagementPage';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { MastersMaintenancePage } from './pages/MastersMaintenancePage';

const AppRouter: React.FC = () => {
  const { currentRoute } = useApp();

  const renderContent = () => {
    if (currentRoute === '/dashboard') {
      return <DashboardPage />;
    }
    if (currentRoute === '/journey' || currentRoute.startsWith('/journey?')) {
      return <JourneySearchPage />;
    }
    if (currentRoute.startsWith('/journey/')) {
      const parts = currentRoute.split('/');
      const jcNumber = parts[2] || 'JC20260930001234';
      return <JourneyDetailPage jcNumber={jcNumber} />;
    }
    if (currentRoute === '/admin/masters') {
      return <MastersMaintenancePage />;
    }
    if (currentRoute === '/admin/users') {
      return <UserManagementPage />;
    }
    if (currentRoute === '/admin/roles') {
      return <RoleManagementPage />;
    }
    if (currentRoute === '/admin/devices') {
      return <DeviceManagementPage />;
    }
    if (currentRoute === '/admin/sessions') {
      return <SessionManagementPage />;
    }
    if (currentRoute === '/admin/config') {
      return <ConfigurationPage />;
    }
    if (currentRoute === '/admin/audit') {
      return <AuditLogPage />;
    }
    return <DashboardPage />;
  };

  return <AppLayout>{renderContent()}</AppLayout>;
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
