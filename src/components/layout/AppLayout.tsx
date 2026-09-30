import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toast } from '../common/Toast';
import { useApp } from '../../context/AppContext';
import { ChevronRight, Home, ShieldAlert } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentRoute, navigate, canAccessRoute, currentUser, setActiveRoleId } = useApp();
  const isPermitted = canAccessRoute(currentRoute);

  const getBreadcrumbs = () => {
    if (currentRoute === '/dashboard') {
      return [{ label: 'Dashboard', path: '/dashboard' }];
    }
    if (currentRoute === '/journey' || currentRoute.startsWith('/journey?')) {
      return [
        { label: 'TML Journey', path: '/journey' },
        { label: 'Journey Search', path: '/journey' },
      ];
    }
    if (currentRoute.startsWith('/journey/')) {
      const jc = currentRoute.split('/')[2];
      return [
        { label: 'TML Journey', path: '/journey' },
        { label: 'Vehicle Journey Details', path: currentRoute },
        { label: jc, path: currentRoute },
      ];
    }
    if (currentRoute === '/admin/masters') {
      return [
        { label: 'Administration', path: '/admin/masters' },
        { label: 'Masters Maintenance', path: '/admin/masters' },
      ];
    }
    if (currentRoute === '/admin/users') {
      return [
        { label: 'Administration', path: '/admin/users' },
        { label: 'Employee / User Management', path: '/admin/users' },
      ];
    }
    if (currentRoute === '/admin/roles') {
      return [
        { label: 'Administration', path: '/admin/roles' },
        { label: 'Role & Access Management', path: '/admin/roles' },
      ];
    }
    if (currentRoute === '/admin/devices') {
      return [
        { label: 'Administration', path: '/admin/devices' },
        { label: 'Device Management', path: '/admin/devices' },
      ];
    }
    if (currentRoute === '/admin/sessions') {
      return [
        { label: 'Administration', path: '/admin/sessions' },
        { label: 'Session Management', path: '/admin/sessions' },
      ];
    }
    if (currentRoute === '/admin/config') {
      return [
        { label: 'Administration', path: '/admin/config' },
        { label: 'Administrative Configuration', path: '/admin/config' },
      ];
    }
    if (currentRoute === '/admin/audit') {
      return [
        { label: 'Administration', path: '/admin/audit' },
        { label: 'Audit Log', path: '/admin/audit' },
      ];
    }
    return [{ label: 'Service Transformation', path: '/dashboard' }];
  };

  const crumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Breadcrumb strip */}
          <div className="border-b border-slate-200/80 bg-white/70 px-6 py-2.5 flex items-center text-xs text-slate-500">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 hover:text-blue-700 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </button>
            {crumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="h-3 w-3 mx-1.5 text-slate-400" />
                <button
                  onClick={() => navigate(crumb.path)}
                  className={`hover:text-blue-700 transition-colors ${
                    idx === crumbs.length - 1 ? 'font-semibold text-slate-800 pointer-events-none' : ''
                  }`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Page contents */}
          <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {isPermitted ? (
              children
            ) : (
              <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-rose-200 p-8 shadow-sm text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Your active role (<span className="font-bold text-slate-800">{currentUser.role}</span>) does not have permission to view this module ({currentRoute}).
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => setActiveRoleId('superAdmin')}
                    className="px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    Switch to Super Administrator
                  </button>
                  <button
                    onClick={() => navigate('/journey')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Go to Journey
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <Toast />
    </div>
  );
};
