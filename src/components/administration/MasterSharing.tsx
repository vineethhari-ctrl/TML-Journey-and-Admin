import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { PUBLISHED_FILE, buildChangesWorkbook, buildPublished, diffMasters, hasLocalChanges } from '../../utils/masterPublish';
import { downloadWorkbook } from '../../utils/masterWorkbook';

const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';

const downloadText = (text: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Admin: save every master as one file (published-masters.json) for the person who deploys the portal. */
export const PublishMastersDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { masterConfigs, publishedInfo, currentUser, logAudit, showToast } = useApp();
  const nextVersion = (publishedInfo?.version ?? 0) + 1;
  const [note, setNote] = useState('');
  const [testOnly, setTestOnly] = useState(false);

  const save = () => {
    const file = buildPublished(masterConfigs, nextVersion, currentUser.name, note.trim());
    downloadText(JSON.stringify(file, null, 1), PUBLISHED_FILE);
    logAudit('Masters Exported for Publishing', 'Masters', PUBLISHED_FILE, `v${publishedInfo?.version ?? 0}`, `v${nextVersion}, ${masterConfigs.length} masters`);
    showToast(`${PUBLISHED_FILE} saved (version ${nextVersion}). Send it to the person who deploys the portal.`, 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish all masters" subtitle="So that everybody sees the masters as they are in this browser" maxWidth="lg">
      <div className="space-y-3 text-xs text-slate-700" data-testid="publish-dialog">
        <ol className="list-decimal space-y-1 pl-4">
          <li>Check that the masters here are the ones everybody should see.</li>
          <li>Save the file below. It holds all {masterConfigs.length} masters with their fields, rules and rows.</li>
          <li>Send <b>{PUBLISHED_FILE}</b> to the person who deploys the portal. After the next deployment everybody sees these masters.</li>
        </ol>
        <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
          <span className="font-semibold">Version</span>
          <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 font-bold" data-testid="publish-version">v{nextVersion}</span>
          <label htmlFor="publish-note" className="font-semibold">What changed</label>
          <input id="publish-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Skill master updated by Priya" />
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-amber-900">
          <input type="checkbox" className="mt-0.5" checked={testOnly} onChange={(e) => setTestOnly(e.target.checked)} />
          <span>I confirm these masters contain <b>test data only</b>. The portal site is public, so real employee, customer or dealer data must never be published.</span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold cursor-pointer">Cancel</button>
          <button type="button" disabled={!testOnly} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 font-bold text-white disabled:opacity-40 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Save {PUBLISHED_FILE}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** Anyone: export only the rows added or changed in this browser, in the Upload a Master format, to send for review. */
export const SendChangesDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { masterConfigs, baselineMasters, currentUser, showToast, logAudit } = useApp();
  const changes = useMemo(() => diffMasters(baselineMasters, masterConfigs), [baselineMasters, masterConfigs]);
  const rows = changes.reduce((n, c) => n + c.added.length + c.changed.length, 0);
  const definition = changes.filter((c) => c.definitionChanged);

  const save = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadWorkbook(buildChangesWorkbook(changes, currentUser.name), `TML_Master_Changes_${date}.xlsx`);
    logAudit('Master Changes Exported', 'Masters', `${rows} rows in ${changes.length} masters`, 'None', 'Excel for review');
    showToast('Changes saved as Excel. Email it to the master owner.', 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send my changes for review" subtitle="Only what you added or changed, ready for Upload a Master" maxWidth="lg">
      <div className="space-y-3 text-xs text-slate-700" data-testid="changes-dialog">
        {changes.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3" data-testid="no-changes">You have no changes of your own in this browser: the masters are the same as the published ones.</p>
        ) : (
          <>
            <table className="w-full text-left" data-testid="changes-table">
              <thead><tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500"><th className="py-1">Master</th><th>Added</th><th>Changed</th><th>Removed</th><th>Fields / rules</th></tr></thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.master.id} className="border-b border-slate-100">
                    <td className="py-1 font-semibold">{c.master.name}{c.isNew ? ' (new master)' : ''}</td>
                    <td>{c.added.length}</td><td>{c.changed.length}</td><td>{c.removedIds.length}</td><td>{c.definitionChanged ? 'changed' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {definition.length > 0 && (
              <p className="rounded-lg bg-amber-50 p-2.5 text-amber-900">Fields or rules were changed in {definition.map((c) => c.master.name).join(', ')}. These cannot travel as rows. Send the BA workbook for them (Export → Whole group (Excel)).</p>
            )}
            {changes.some((c) => c.removedIds.length > 0) && <p className="text-slate-500">Removed rows are not sent. To retire a row, set it Inactive instead of deleting it.</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold cursor-pointer">Close</button>
          <button type="button" disabled={rows === 0} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-white disabled:opacity-40 cursor-pointer">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Save changes as Excel
          </button>
        </div>
      </div>
    </Modal>
  );
};

/** Shows which published version this browser is on, and offers a newer one when this browser also has changes of its own. */
export const PublishedBanner: React.FC<{ onSendChanges: () => void }> = ({ onSendChanges }) => {
  const { publishedInfo, pendingPublished, loadPublishedMasters, masterConfigs, baselineMasters } = useApp();
  const mine = hasLocalChanges(baselineMasters, masterConfigs);
  if (pendingPublished) {
    return (
      <div role="status" data-testid="published-banner" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="mr-auto">
          New published masters are available: <b>v{pendingPublished.version}</b> by {pendingPublished.publishedBy} ({pendingPublished.publishedAt.slice(0, 10)}
          {pendingPublished.note ? `, ${pendingPublished.note}` : ''}). You also have changes of your own in this browser; loading replaces them.
        </span>
        <button type="button" onClick={onSendChanges} className="rounded-lg border border-amber-400 bg-white px-2.5 py-1 font-bold cursor-pointer">Send my changes first</button>
        <button type="button" onClick={loadPublishedMasters} className="rounded-lg bg-amber-700 px-2.5 py-1 font-bold text-white cursor-pointer">Load published masters</button>
      </div>
    );
  }
  if (!publishedInfo) return null;
  return (
    <div data-testid="published-chip" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
      <Upload className="h-3 w-3" /> Published masters v{publishedInfo.version} · {publishedInfo.publishedAt.slice(0, 10)} · {publishedInfo.publishedBy}
      {mine ? ' · you have changes of your own' : ''}
    </div>
  );
};
