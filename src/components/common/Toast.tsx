import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useApp();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-white shadow-xl shadow-emerald-900/10',
    error: 'border-rose-200 bg-white shadow-xl shadow-rose-900/10',
    info: 'border-blue-200 bg-white shadow-xl shadow-blue-900/10',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-slate-800 ${borders[toast.type]}`}>
        {icons[toast.type]}
        <span className="font-medium">{toast.message}</span>
        <button
          onClick={clearToast}
          className="ml-3 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
