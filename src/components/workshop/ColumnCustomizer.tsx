import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';

type ColumnPrefs = ReturnType<typeof useColumnPreferences<any>>;

/** Column picker behind the grid's column icon: show / hide, reorder, pinned columns locked, Reset to Default. */
export const ColumnCustomizer: React.FC<{ prefs: ColumnPrefs }> = ({ prefs }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  const middle = prefs.visibleColumns.filter((c) => !prefs.isPinned(c.key));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Columns displayed"
        title="Columns displayed: choose the fields shown in this list"
        className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Columns displayed</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Columns displayed" className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl" data-testid="column-customizer">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold text-slate-900">Columns displayed</span>
            <button type="button" onClick={prefs.reset} className="flex items-center gap-1 rounded-md px-2 py-1 text-blue-700 hover:bg-blue-50 cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
            </button>
          </div>
          <ul className="space-y-1">
            {prefs.visibleColumns.map((c) => {
              const pinned = prefs.isPinned(c.key);
              const i = middle.findIndex((m) => m.key === c.key);
              return (
                <li key={c.key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                  {pinned ? <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Pinned" /> : <input id={`col-${c.key}`} type="checkbox" checked onChange={() => prefs.setVisible(c.key, false)} />}
                  <label htmlFor={`col-${c.key}`} className="flex-1">{c.label}{pinned && <span className="ml-1 text-[10px] text-slate-400">pinned</span>}</label>
                  {!pinned && (
                    <>
                      <button type="button" disabled={i === 0} onClick={() => prefs.move(c.key, -1)} aria-label={`Move ${c.label} left`} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={i === middle.length - 1} onClick={() => prefs.move(c.key, 1)} aria-label={`Move ${c.label} right`} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {prefs.hiddenColumns.length > 0 && (
            <>
              <div className="mt-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">More columns</div>
              <ul className="space-y-1">
                {prefs.hiddenColumns.map((c) => (
                  <li key={c.key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                    <input id={`col-${c.key}`} type="checkbox" checked={false} onChange={() => prefs.setVisible(c.key, true)} />
                    <label htmlFor={`col-${c.key}`} className="flex-1 cursor-pointer text-slate-600">{c.label}</label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};
