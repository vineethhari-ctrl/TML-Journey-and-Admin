import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Car,
  FileText,
  User,
  Smartphone,
  Clock,
  X,
  ArrowRight,
  CornerDownLeft,
  Compass,
  History,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NAV_PAGES } from '../../config/navigation';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  section: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  hint: string;
  mono?: boolean;
  run: () => void;
}

const RECENT_KEY = 'tml_recent_searches_v1';
const MAX_RECENT = 6;

const loadRecent = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecent = (query: string) => {
  const q = query.trim();
  if (!q) return;
  try {
    const next = [q, ...loadRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recents are a convenience only
  }
};

/**
 * Command palette: search every entity (vehicles, JCs, users, devices, sessions),
 * jump to any page the active role can access, and drive it all from the keyboard.
 */
export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const { searchGlobal, navigate, canAccessRoute } = useApp();
  const listRef = useRef<HTMLDivElement>(null);

  // Reset each time the palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setRecent(loadRecent());
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!isOpen) return [];
    const q = query.trim();
    const ql = q.toLowerCase();
    const go = (route: string) => () => {
      if (q) saveRecent(q);
      navigate(route);
      onClose();
    };
    const list: PaletteItem[] = [];

    if (!q) {
      recent.forEach((r, i) =>
        list.push({
          id: `recent-${i}`,
          section: 'Recent searches',
          icon: History,
          title: r,
          hint: 'Search',
          mono: true,
          run: () => setQuery(r),
        })
      );
      NAV_PAGES.filter((p) => canAccessRoute(p.route)).forEach((p) =>
        list.push({
          id: `page-${p.route}`,
          section: 'Go to',
          icon: Compass,
          title: p.label,
          subtitle: p.group,
          hint: 'Open',
          run: go(p.route),
        })
      );
      return list;
    }

    const results = searchGlobal(q);
    const canJourney = canAccessRoute('/journey');

    // Exact JC hit → offer a direct jump first
    const exactJc = results.serviceCases.find((sc) => sc.jcNumber.toLowerCase() === ql);
    if (exactJc && canJourney) {
      list.push({
        id: `jump-${exactJc.jcNumber}`,
        section: 'Best match',
        icon: Zap,
        title: `Open journey ${exactJc.jcNumber}`,
        subtitle: `${exactJc.vehicleRegistration} • ${exactJc.currentStage} • ${exactJc.overallStatus}`,
        hint: 'Open',
        mono: true,
        run: go(`/journey/${exactJc.jcNumber}`),
      });
    }

    NAV_PAGES.filter(
      (p) => canAccessRoute(p.route) && `${p.label} ${p.group} ${p.keywords}`.toLowerCase().includes(ql)
    ).forEach((p) =>
      list.push({
        id: `page-${p.route}`,
        section: 'Pages',
        icon: Compass,
        title: p.label,
        subtitle: p.group,
        hint: 'Open',
        run: go(p.route),
      })
    );

    if (canJourney) {
      results.serviceCases.slice(0, 5).forEach((sc) => {
        if (exactJc?.jcNumber === sc.jcNumber) return;
        list.push({
          id: `jc-${sc.jcNumber}`,
          section: `Job Cards (${results.serviceCases.length})`,
          icon: FileText,
          title: sc.jcNumber,
          subtitle: `${sc.vehicleRegistration} • ${sc.currentStage} • ${sc.customerName}`,
          hint: 'Timeline',
          mono: true,
          run: go(`/journey/${sc.jcNumber}`),
        });
      });
      results.vehicles.slice(0, 4).forEach((v) =>
        list.push({
          id: `veh-${v.vehicleId}`,
          section: `Vehicles (${results.vehicles.length})`,
          icon: Car,
          title: v.registrationNumber,
          subtitle: `${v.model} • ${v.customerName} • VIN ${v.vin}`,
          hint: 'Journeys',
          mono: true,
          run: go(`/journey?search=${encodeURIComponent(v.registrationNumber)}`),
        })
      );
    }

    if (canAccessRoute('/admin/users')) {
      results.users.slice(0, 4).forEach((u) =>
        list.push({
          id: `user-${u.userId}`,
          section: `Users (${results.users.length})`,
          icon: User,
          title: u.name,
          subtitle: `${u.userId} • ${u.role} • ${u.status}`,
          hint: 'Manage',
          run: go(`/admin/users?search=${encodeURIComponent(u.userId)}`),
        })
      );
    }
    if (canAccessRoute('/admin/devices')) {
      results.devices.slice(0, 3).forEach((d) =>
        list.push({
          id: `dev-${d.deviceId}`,
          section: `Devices (${results.devices.length})`,
          icon: Smartphone,
          title: d.deviceId,
          subtitle: `${d.assignedUserName} • ${d.deviceType} • ${d.status}`,
          hint: 'Manage',
          mono: true,
          run: go(`/admin/devices?search=${encodeURIComponent(d.deviceId)}`),
        })
      );
    }
    if (canAccessRoute('/admin/sessions')) {
      results.sessions.slice(0, 3).forEach((s) =>
        list.push({
          id: `sess-${s.sessionId}`,
          section: `Sessions (${results.sessions.length})`,
          icon: Clock,
          title: s.sessionId,
          subtitle: `${s.userName} • ${s.ipAddress} • ${s.status}`,
          hint: 'Manage',
          mono: true,
          run: go(`/admin/sessions?search=${encodeURIComponent(s.sessionId)}`),
        })
      );
    }

    // Always offer a full journey search as the fallback action
    if (canJourney) {
      list.push({
        id: 'search-all',
        section: 'Search',
        icon: Search,
        title: `Search all journeys for "${q}"`,
        hint: 'Search',
        run: go(`/journey?search=${encodeURIComponent(q)}`),
      });
    }
    return list;
  }, [isOpen, query, recent, searchGlobal, navigate, canAccessRoute, onClose]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row visible while arrowing through results
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastSection = '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div
          className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-slate-200 gap-3 bg-slate-50/50">
            <Search className="h-5 w-5 text-blue-600 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search vehicles, JCs, VINs, users, devices… or jump to a page"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
              aria-activedescendant={items[activeIndex] ? `palette-${items[activeIndex].id}` : undefined}
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
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded-md bg-white text-slate-500 border border-slate-300 text-[10px] font-mono font-bold hover:bg-slate-100 cursor-pointer shrink-0"
              title="Close (Esc)"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No matching records found for "{query}"
              </div>
            ) : (
              items.map((item, index) => {
                const showHeader = item.section !== lastSection;
                lastSection = item.section;
                const Icon = item.icon;
                const active = index === activeIndex;
                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.section}
                      </div>
                    )}
                    <div
                      id={`palette-${item.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => !active && setActiveIndex(index)}
                      onClick={item.run}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        active ? 'bg-blue-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-200' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold truncate ${item.mono ? 'font-mono' : ''}`}>{item.title}</div>
                        {item.subtitle && (
                          <div className={`text-[11px] truncate ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-semibold shrink-0 ${
                          active ? 'text-white' : 'text-slate-400'
                        }`}
                      >
                        {item.hint}
                        {active ? <CornerDownLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Footer: keyboard hints */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">↓</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Enter</kbd> open</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Esc</kbd> close</span>
            </div>
            <span className="hidden sm:inline">Open anywhere with <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Ctrl/⌘ K</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">/</kbd></span>
          </div>
        </div>
      </div>
    </div>
  );
};
