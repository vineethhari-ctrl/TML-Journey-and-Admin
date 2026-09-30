import React, { useState, useEffect } from 'react';
import { Search, Car, FileText, User, Smartphone, Clock, X, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { searchGlobal, navigate } = useApp();

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = searchGlobal(query);
  const totalResults =
    results.vehicles.length +
    results.serviceCases.length +
    results.users.length +
    results.devices.length +
    results.sessions.length;

  const handleSelectVehicle = (reg: string) => {
    navigate(`/journey?search=${encodeURIComponent(reg)}`);
    onClose();
  };

  const handleSelectJC = (jc: string) => {
    navigate(`/journey/${jc}`);
    onClose();
  };

  const handleSelectUser = () => {
    navigate('/admin/users');
    onClose();
  };

  const handleSelectDevice = () => {
    navigate('/admin/devices');
    onClose();
  };

  const handleSelectSession = () => {
    navigate('/admin/sessions');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div
          className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-slate-200 gap-3 bg-slate-50/50">
            <Search className="h-5 w-5 text-blue-600 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search by Vehicle No (e.g. MH01AB1234), VIN, JC, Employee ID, User ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/70 transition-colors cursor-pointer"
                title="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {/* Prominent Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/80 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Close search modal (Esc)"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
              <kbd className="hidden sm:inline-block ml-0.5 px-1 py-0.2 text-[9px] font-mono font-medium text-slate-500 bg-white border border-slate-200 rounded">
                ESC
              </kbd>
            </button>
          </div>

          {/* Quick presets if empty */}
          {!query.trim() && (
            <div className="p-5 text-xs text-slate-500 space-y-3">
              <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                Quick Search Suggestions:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setQuery('MH01AB1234')}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 hover:bg-blue-100 font-mono"
                >
                  MH01AB1234 (Demo EV)
                </button>
                <button
                  onClick={() => setQuery('JC20260930001234')}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200 hover:bg-slate-200 font-mono"
                >
                  JC20260930001234
                </button>
                <button
                  onClick={() => setQuery('Amit Kumar')}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200 hover:bg-slate-200"
                >
                  Amit Kumar (Technician)
                </button>
                <button
                  onClick={() => setQuery('Priya Shinde')}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200 hover:bg-slate-200"
                >
                  Priya Shinde (Advisor)
                </button>
              </div>
            </div>
          )}

          {/* Results list */}
          {query.trim() && (
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 divide-y divide-slate-100">
              {totalResults === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No matching records found for "{query}"
                </div>
              ) : (
                <>
                  {/* Vehicles */}
                  {results.vehicles.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 uppercase tracking-wider mb-2">
                        <Car className="h-3.5 w-3.5" />
                        Vehicles ({results.vehicles.length})
                      </div>
                      <div className="space-y-1.5">
                        {results.vehicles.slice(0, 4).map((v) => (
                          <div
                            key={v.vehicleId}
                            onClick={() => handleSelectVehicle(v.registrationNumber)}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 cursor-pointer text-xs transition-colors border border-transparent hover:border-blue-200"
                          >
                            <div>
                              <span className="font-bold text-slate-900 font-mono text-sm">
                                {v.registrationNumber}
                              </span>
                              <span className="ml-2 text-slate-600 font-medium">{v.model}</span>
                              <p className="text-slate-400 text-[11px]">
                                VIN: {v.vin} • Customer: {v.customerName}
                              </p>
                            </div>
                            <span className="text-blue-600 flex items-center gap-1 font-medium">
                              View Journey <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Job Cards */}
                  {results.serviceCases.length > 0 && (
                    <div className="pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">
                        <FileText className="h-3.5 w-3.5" />
                        Job Cards / Service Cases ({results.serviceCases.length})
                      </div>
                      <div className="space-y-1.5">
                        {results.serviceCases.slice(0, 4).map((sc) => (
                          <div
                            key={sc.jcNumber}
                            onClick={() => handleSelectJC(sc.jcNumber)}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 cursor-pointer text-xs transition-colors border border-transparent hover:border-indigo-200"
                          >
                            <div>
                              <span className="font-bold text-indigo-900 font-mono">
                                {sc.jcNumber}
                              </span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                {sc.currentStage}
                              </span>
                              <p className="text-slate-500 text-[11px]">
                                {sc.vehicleRegistration} • {sc.dealerName} • {sc.customerName}
                              </p>
                            </div>
                            <span className="text-indigo-600 flex items-center gap-1 font-medium">
                              Open Timeline <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users */}
                  {results.users.length > 0 && (
                    <div className="pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        <User className="h-3.5 w-3.5" />
                        Users / Employees ({results.users.length})
                      </div>
                      <div className="space-y-1.5">
                        {results.users.slice(0, 4).map((u) => (
                          <div
                            key={u.userId}
                            onClick={handleSelectUser}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-xs transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{u.name}</span>
                              <span className="ml-2 text-slate-500 font-mono text-[11px]">
                                {u.userId}
                              </span>
                              <p className="text-slate-400 text-[11px]">
                                {u.role} • {u.dealer} • {u.userType}
                              </p>
                            </div>
                            <span className="text-slate-600 font-medium">Manage</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Devices & Sessions */}
                  {(results.devices.length > 0 || results.sessions.length > 0) && (
                    <div className="pt-3 flex gap-4 text-xs">
                      {results.devices.length > 0 && (
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            <Smartphone className="h-3.5 w-3.5" /> Devices ({results.devices.length})
                          </div>
                          <button
                            onClick={handleSelectDevice}
                            className="text-blue-600 hover:underline"
                          >
                            View matching devices →
                          </button>
                        </div>
                      )}
                      {results.sessions.length > 0 && (
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            <Clock className="h-3.5 w-3.5" /> Sessions ({results.sessions.length})
                          </div>
                          <button
                            onClick={handleSelectSession}
                            className="text-blue-600 hover:underline"
                          >
                            View matching sessions →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Modal Footer with explicit Close action */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">ESC</kbd> or click outside to dismiss</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
