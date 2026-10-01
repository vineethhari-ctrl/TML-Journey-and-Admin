import React from 'react';
import { AlertTriangle, ShieldAlert, User, Smartphone, Sliders, Check, ExternalLink, ClipboardCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, navigate } = useApp();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'EXCEPTION':
        return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />;
      case 'SECURITY':
        return <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />;
      case 'USER':
        return <User className="h-4 w-4 text-blue-600 shrink-0" />;
      case 'APPROVAL':
        return <ClipboardCheck className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'DEVICE':
        return <Smartphone className="h-4 w-4 text-purple-600 shrink-0" />;
      default:
        return <Sliders className="h-4 w-4 text-slate-600 shrink-0" />;
    }
  };

  const handleNotificationClick = (id: string, targetPath: string) => {
    markNotificationAsRead(id);
    navigate(targetPath);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-96 rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
            <p className="text-[11px] text-slate-500">Live operational & security alerts</p>
          </div>
          <button
            onClick={markAllNotificationsAsRead}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No new notifications</div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item.id, item.targetPath)}
                className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${
                  !item.read ? 'bg-blue-50/40' : ''
                }`}
              >
                <div className="mt-0.5">{getIcon(item.type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${!item.read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {item.title}
                    </p>
                    {!item.read && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                    <span className="text-[10px] text-blue-600 font-medium inline-flex items-center gap-0.5">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
