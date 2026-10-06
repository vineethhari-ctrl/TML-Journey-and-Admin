import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, RotateCcw, Settings2, Star } from 'lucide-react';
import { useTabPreferences, TabDef } from '../../hooks/useTabPreferences';

type TabPrefs = ReturnType<typeof useTabPreferences>;

const Badge: React.FC<{ n?: number; active?: boolean }> = ({ n, active }) =>
  n === undefined ? null : (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'}`}>{n}</span>
  );

function useClickOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, close]);
}

interface Props {
  prefs: TabPrefs;
  activeTab: string;
  onSelect: (id: string) => void;
}

/** Workflow tabs in the user's order; extra and hidden tabs collapse into "More (n)" with their badges. */
export const WorkshopTabBar: React.FC<Props> = ({ prefs, activeTab, onSelect }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useClickOutside(moreRef, () => setMoreOpen(false));
  const tabBtn = (t: TabDef) => {
    const active = t.id === activeTab;
    return (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onSelect(t.id)}
        className={`flex shrink-0 items-center rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${active ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
      >
        {t.label}
        <Badge n={t.badge} active={active} />
      </button>
    );
  };
  const activeInMore = prefs.moreTabs.some((t) => t.id === activeTab);

  return (
    <div className="relative flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5" data-testid="workshop-tabs">
      <div role="tablist" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {prefs.inlineTabs.map(tabBtn)}
      </div>
      {prefs.moreTabs.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${activeInMore ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            More ({prefs.moreTabs.length}) <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {moreOpen && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {prefs.moreTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(t.id);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <span>
                    {t.label}
                    {prefs.isHidden(t.id) && <span className="ml-1 text-[10px] text-slate-400">(hidden)</span>}
                  </span>
                  <Badge n={t.badge} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => setCustomizeOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Customise tabs" title="Customise tabs">
        <Settings2 className="h-4 w-4" />
      </button>
      {customizeOpen && <TabCustomizer prefs={prefs} onClose={() => setCustomizeOpen(false)} />}
    </div>
  );
};

/** Show / hide, reorder and pick the landing tab. At least two tabs always stay visible. */
export const TabCustomizer: React.FC<{ prefs: TabPrefs; onClose: () => void }> = ({ prefs, onClose }) => {
  const [warning, setWarning] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  return (
    <div ref={ref} role="dialog" aria-label="Customise tabs" className="absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl" data-testid="tab-customizer">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-slate-900">My tabs</span>
        <button type="button" onClick={prefs.reset} className="flex items-center gap-1 rounded-md px-2 py-1 text-blue-700 hover:bg-blue-50 cursor-pointer">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to role default
        </button>
      </div>
      <ul className="space-y-1">
        {prefs.orderedTabs.map((t, i) => {
          const hidden = prefs.isHidden(t.id);
          const isDefault = prefs.defaultLandingTab === t.id;
          return (
            <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
              <input
                id={`tab-vis-${t.id}`}
                type="checkbox"
                checked={!hidden}
                onChange={(e) => setWarning(prefs.setVisible(t.id, e.target.checked) ? '' : `At least ${prefs.minVisible} tabs must stay visible.`)}
              />
              <label htmlFor={`tab-vis-${t.id}`} className="flex-1 cursor-pointer">{t.label}</label>
              <button
                type="button"
                disabled={hidden}
                onClick={() => prefs.setDefaultLanding(t.id)}
                aria-label={`Open ${t.label} first`}
                title={hidden ? 'Hidden tabs cannot be the landing tab' : 'Open this tab first'}
                className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${isDefault ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
              >
                <Star className="h-3.5 w-3.5" fill={isDefault ? 'currentColor' : 'none'} />
              </button>
              <button type="button" disabled={i === 0} onClick={() => prefs.move(t.id, -1)} aria-label={`Move ${t.label} up`} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={i === prefs.orderedTabs.length - 1} onClick={() => prefs.move(t.id, 1)} aria-label={`Move ${t.label} down`} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {warning && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-900" role="alert">{warning}</p>}
      <p className="mt-2 text-[11px] text-slate-500">★ = landing tab. Hidden tabs stay reachable under "More".</p>
    </div>
  );
};
