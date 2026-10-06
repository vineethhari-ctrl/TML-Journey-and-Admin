import React, { useEffect, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toast } from '../common/Toast';
import { useApp } from '../../context/AppContext';
import { ChevronRight, Home, ShieldAlert } from 'lucide-react';
import { NAV_PAGES } from '../../config/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentRoute, navigate, canAccessRoute, currentUser, setActiveRoleId } = useApp();
  const isPermitted = canAccessRoute(currentRoute);
  const homeRoute = NAV_PAGES.find((p) => canAccessRoute(p.route))?.route;
  const mainRef = useRef<HTMLElement>(null);

  // <main> is the scroll container (not window), so reset it on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentRoute]);

  const getBreadcrumbs = () => {
    const path = currentRoute.split('?')[0];
    if (path === '/dashboard') {
      return [{ label: 'Dashboard', path: '/dashboard' }];
    }
    if (path === '/journey') {
      return [
        { label: 'TML Journey', path: '/journey' },
        { label: 'Journey Search', path: '/journey' },
      ];
    }
    if (path.startsWith('/journey/')) {
      const jc = decodeURIComponent(path.split('/')[2] || '');
      return [
        { label: 'TML Journey', path: '/journey' },
        { label: 'Vehicle Journey Details', path: currentRoute },
        { label: jc, path: currentRoute },
      ];
    }
    if (path === '/admin/bay-approvals') {
      return [
        { label: 'Administration', path: '/admin/masters' },
        { label: 'Bay Approvals', path: '/admin/bay-approvals' },
      ];
    }
    if (path === '/admin/masters-guide') {
      return [
        { label: 'Administration', path: '/admin/masters' },
        { label: 'Masters Maintenance', path: '/admin/masters' },
        { label: 'BA Guide', path: '/admin/masters-guide' },
      ];
    }
    if (path === '/admin/masters') {
      return [
        { label: 'Administration', path: '/admin/masters' },
        { label: 'Masters Maintenance', path: '/admin/masters' },
      ];
    }
    if (path === '/admin/users') {
      return [
        { label: 'Administration', path: '/admin/users' },
        { label: 'Employee / User Management', path: '/admin/users' },
      ];
    }
    if (path === '/admin/roles') {
      return [
        { label: 'Administration', path: '/admin/roles' },
        { label: 'Role & Access Management', path: '/admin/roles' },
      ];
    }
    if (path === '/admin/devices') {
      return [
        { label: 'Administration', path: '/admin/devices' },
        { label: 'Device Management', path: '/admin/devices' },
      ];
    }
    if (path === '/admin/sessions') {
      return [
        { label: 'Administration', path: '/admin/sessions' },
        { label: 'Session Management', path: '/admin/sessions' },
      ];
    }
    if (path === '/admin/config') {
      return [
        { label: 'Administration', path: '/admin/config' },
        { label: 'Administrative Configuration', path: '/admin/config' },
      ];
    }
    if (path === '/admin/audit') {
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

        <main ref={mainRef} className="flex-1 overflow-y-auto flex flex-col">
          {/* Breadcrumb strip */}
          <div className="border-b border-slate-200/80 bg-white/70 px-6 py-2.5 flex items-center text-xs text-slate-500">
            <button
              onClick={() => navigate('/home')}
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
                  {homeRoute && (
                    <button
                      onClick={() => navigate(homeRoute)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Go to {NAV_PAGES.find((p) => p.route === homeRoute)?.label}
                    </button>
                  )}
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
