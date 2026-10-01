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
    // Query strings (e.g. ?search=...) are handled by the pages themselves
    const path = currentRoute.split('?')[0];
    if (path === '/dashboard') {
      return <DashboardPage />;
    }
    if (path === '/journey') {
      return <JourneySearchPage />;
    }
    if (path.startsWith('/journey/')) {
      const jcNumber = decodeURIComponent(path.split('/')[2] || '') || 'JC20260930001234';
      return <JourneyDetailPage jcNumber={jcNumber} />;
    }
    if (path === '/admin/masters') {
      return <MastersMaintenancePage />;
    }
    if (path === '/admin/users') {
      return <UserManagementPage />;
    }
    if (path === '/admin/roles') {
      return <RoleManagementPage />;
    }
    if (path === '/admin/devices') {
      return <DeviceManagementPage />;
    }
    if (path === '/admin/sessions') {
      return <SessionManagementPage />;
    }
    if (path === '/admin/config') {
      return <ConfigurationPage />;
    }
    if (path === '/admin/audit') {
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
