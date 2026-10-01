import React, { useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, ChevronUp, Eye, FileText, Video } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BS_MASTER_IDS, BsRole, JobType, bodyshopHealthCheck, insuranceDocumentsToCollect, resolveInventoryCapture } from '../../utils/bodyshopRules';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-orange-500 focus:outline-hidden';

/** Shows what the dealer app will ask a DSvAdv / Driver to capture, live from the Bodyshop masters. */
export const BodyshopCapturePreview: React.FC = () => {
  const { masterConfigs } = useApp();
  const rows = useMemo(() => {
    const byId = (id: string) => masterConfigs.find((m) => m.id === id)?.records ?? [];
    return { sections: byId(BS_MASTER_IDS.sections), checkpoints: byId(BS_MASTER_IDS.checkpoints), docs: byId(BS_MASTER_IDS.insuranceDocs) };
  }, [masterConfigs]);

  const [open, setOpen] = useState(true);
  const [bu, setBu] = useState('PV');
  const [job, setJob] = useState<JobType>('Accident');
  const [role, setRole] = useState<BsRole>('DSvAdv');

  const capture = resolveInventoryCapture(rows.sections, rows.checkpoints, { bu, job, role });
  const docs = insuranceDocumentsToCollect(rows.docs);
  const issues = bodyshopHealthCheck(rows.sections, rows.checkpoints, rows.docs);
  const itemCount = capture.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 shadow-xs" data-testid="bodyshop-preview">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-orange-700" />
          <span className="text-sm font-bold text-slate-900">Inventory Capture Preview</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">What the dealer app asks each role to capture — uses the masters as they are now.</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            data-testid="bodyshop-health"
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${issues.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}
          >
            {issues.length ? `${issues.length} item(s) to fix` : 'Configuration OK'}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2 max-w-xl">
            <div>
              <label htmlFor="bs-bu" className="block text-[11px] font-semibold text-slate-600 mb-1">BU</label>
              <select id="bs-bu" className={input} value={bu} onChange={(e) => setBu(e.target.value)}>
                <option>PV</option>
                <option>EV</option>
              </select>
            </div>
            <div>
              <label htmlFor="bs-job" className="block text-[11px] font-semibold text-slate-600 mb-1">Job type</label>
              <select id="bs-job" className={input} value={job} onChange={(e) => setJob(e.target.value as JobType)}>
                <option value="Accident">Accident</option>
                <option value="General">General (non-accident)</option>
              </select>
            </div>
            <div>
              <label htmlFor="bs-role" className="block text-[11px] font-semibold text-slate-600 mb-1">Role</label>
              <select id="bs-role" className={input} value={role} onChange={(e) => setRole(e.target.value as BsRole)}>
                <option>DSvAdv</option>
                <option>Driver</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2" data-testid="bodyshop-capture">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sections for {role} · {bu} · {job} ({capture.length} sections, {itemCount} items)
              </div>
              {capture.length === 0 ? (
                <p className="text-slate-500">No active section for this BU / job type / role.</p>
              ) : (
                <ol className="space-y-2">
                  {capture.map((s) => (
                    <li key={s.id} data-section={s.section}>
                      <div className="font-bold text-slate-900">
                        <span className="font-mono text-orange-700 mr-1">{s.sequencePriority}.</span> {s.section}
                      </div>
                      {s.items.length === 0 ? (
                        <p className="pl-5 text-slate-400 italic">No checkpoints defined yet.</p>
                      ) : (
                        <ul className="pl-5 space-y-0.5">
                          {s.items.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-x-2 border-l-2 border-orange-200 pl-2">
                              <span className="text-slate-800">
                                {i.subSection1 && i.label !== i.subSection1 && <span className="text-slate-400">{i.subSection1} › </span>}
                                {i.label}
                                {i.mandatory && <span className="text-rose-500"> *</span>}
                              </span>
                              {i.acceptableValues.length > 0 && <span className="text-[10px] text-slate-500">[{i.acceptableValues.join(' / ')}]</span>}
                              {i.media && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-orange-800 bg-orange-50 rounded px-1.5">
                                  {/video/i.test(i.media.type) && <Video className="h-3 w-3" />}
                                  {/image/i.test(i.media.type) && <Camera className="h-3 w-3" />}
                                  {i.media.type} ×{i.media.count} · {i.media.on === 'Not OK' ? 'when Not OK' : 'always'}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2" data-testid="bodyshop-docs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Insurance documents (customer)</div>
              {job !== 'Accident' ? (
                <p className="text-slate-500">Collected for accident jobs only.</p>
              ) : docs.length === 0 ? (
                <p className="text-slate-500">No active documents.</p>
              ) : (
                <ol className="space-y-1">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-orange-700" />
                      <span>
                        <span className="font-mono text-slate-400">{d.sequence}.</span> {d.documentCategory}
                        {d.mandatoryFlag === 'Y' ? <span className="text-rose-500"> *</span> : <span className="text-slate-400"> (optional)</span>}
                        <span className="text-[10px] text-slate-500">
                          {' '}
                          · {d.documentType}
                          {d.imagesRequired ? ` ×${d.imagesRequired}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className={`rounded-xl border p-3 ${issues.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`} data-testid="bodyshop-issues">
            {issues.length === 0 ? (
              <p className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Nothing to fix in the Bodyshop masters.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-amber-900 font-bold mb-1">
                  <AlertTriangle className="h-4 w-4" /> Needs a BA decision (gaps found in the masters / Excel)
                </p>
                <ul className="list-disc pl-5 text-amber-900 space-y-0.5">
                  {issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
