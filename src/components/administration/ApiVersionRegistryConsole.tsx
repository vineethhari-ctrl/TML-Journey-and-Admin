import React, { useState, useEffect } from 'react';
import {
  rulesEngineService,
  ApiVersionRelease,
  ApiVersionStatus,
  VersionComparisonResult,
} from '../../services/rulesEngineService';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  GitCompare,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ExternalLink,
  Sliders,
  X,
} from 'lucide-react';

export const ApiVersionRegistryConsole: React.FC = () => {
  const [releases, setReleases] = useState<ApiVersionRelease[]>(() =>
    rulesEngineService.getAllApiVersions()
  );
  const [activeVersion, setActiveVersion] = useState<string>(
    () => rulesEngineService.getActiveApiVersion().version
  );
  const [selectedVersion, setSelectedVersion] = useState<string>(
    releases[0]?.version || 'v1.1.0'
  );
  const [compareSource, setCompareSource] = useState<string>('v1.1.0');
  const [compareTarget, setCompareTarget] = useState<string>('v2.0.0-rc1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Draft Creation Modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [baseVersion, setBaseVersion] = useState('v1.1.0');
  const [newVersionStr, setNewVersionStr] = useState('v2.1.0-draft');
  const [newReleaseName, setNewReleaseName] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');

  useEffect(() => {
    const unsub = rulesEngineService.subscribe(() => {
      setReleases(rulesEngineService.getAllApiVersions());
      setActiveVersion(rulesEngineService.getActiveApiVersion().version);
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((cur) => (cur === msg ? null : cur)), 3500);
  };

  const handleSetActive = (version: string) => {
    const res = rulesEngineService.setActiveApiVersion(version, 'TML-ADMIN');
    if (res.success) {
      showToast(res.message);
    }
  };

  const handleRollback = (targetVersion: string) => {
    if (
      confirm(
        `Perform emergency rollback to version ${targetVersion}? Active dealer workflows will immediately fallback to this schema.`
      )
    ) {
      const res = rulesEngineService.rollbackToVersion(targetVersion, 'TML-ADMIN');
      if (res.success) {
        showToast(res.message);
      }
    }
  };

  const handleDeleteDraft = (version: string) => {
    if (confirm(`Delete draft release ${version}?`)) {
      const res = rulesEngineService.deleteVersion(version);
      if (res.success) {
        showToast(`Draft release ${version} removed.`);
      } else {
        showToast(res.error || 'Cannot delete this release.');
      }
    }
  };

  const handleCreateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    rulesEngineService.createDraftVersion(
      baseVersion,
      newVersionStr,
      newReleaseName,
      newReleaseNotes,
      'TML-ADMIN'
    );
    setShowDraftModal(false);
    showToast(`Draft release ${newVersionStr} created.`);
  };

  const diffResult: VersionComparisonResult = rulesEngineService.compareVersions(
    compareSource,
    compareTarget
  );

  const selectedRelease = releases.find((r) => r.version === selectedVersion) || releases[0];

  const statusColors: Record<ApiVersionStatus, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    BETA: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    DRAFT: 'bg-amber-100 text-amber-800 border-amber-300',
    DEPRECATED: 'bg-slate-100 text-slate-700 border-slate-300',
    SUNSET: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white border border-indigo-900/60 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-white">
                API Versioning &amp; Release Management
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                Active: {activeVersion}
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Enforce semantic versioning, backward-compatibility contracts, and instant zero-downtime rollouts or emergency rollback.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDraftModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer border border-indigo-400/40"
        >
          <Plus className="h-4 w-4" />
          <span>Fork New Version Draft</span>
        </button>
      </div>

      {/* Registry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Releases List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Registered Releases ({releases.length})
              </span>
              <span className="text-[10px] text-slate-400">SemVer standard</span>
            </div>

            <div className="space-y-2.5">
              {releases.map((rel) => {
                const isActive = rel.version === activeVersion;
                const isSelected = rel.version === selectedVersion;

                return (
                  <div
                    key={rel.version}
                    onClick={() => setSelectedVersion(rel.version)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900">
                          {rel.version}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            statusColors[rel.status]
                          }`}
                        >
                          {rel.status}
                        </span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold">
                            LIVE PAN-INDIA
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono">
                        {rel.releaseDate}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-xs">{rel.releaseName}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{rel.releaseNotes}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                      <span>{rel.rules.length} schema fields</span>
                      <span>Min Client: {rel.minClientAppVersion}</span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {!isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(rel.version);
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Promote to Active
                        </button>
                      )}

                      {isActive && rel.version !== 'v1.0.0' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollback('v1.0.0');
                          }}
                          className="px-2 py-1 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Emergency Rollback</span>
                        </button>
                      )}

                      {rel.status === 'DRAFT' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(rel.version);
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Release Inspector & Semantic Diff Engine */}
        <div className="lg:col-span-7 space-y-4">
          {/* Release Detail Card */}
          {selectedRelease && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black text-slate-900">
                    {selectedRelease.version}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      statusColors[selectedRelease.status]
                    }`}
                  >
                    {selectedRelease.status}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Published by: {selectedRelease.publishedBy} ({selectedRelease.releaseDate})
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs">{selectedRelease.releaseName}</h4>
                <p className="text-xs text-slate-600 mt-1">{selectedRelease.releaseNotes}</p>
              </div>

              {selectedRelease.breakingChanges && selectedRelease.breakingChanges.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                    <span>Breaking Changes Notice</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                    {selectedRelease.breakingChanges.map((bc, idx) => (
                      <li key={idx}>{bc}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Total Fields Defined</span>
                  <span className="text-base font-black text-slate-900">
                    {selectedRelease.rules.length}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Min Dealer App Version</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {selectedRelease.minClientAppVersion}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Semantic Diff Engine */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-indigo-600" />
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Semantic Version Diff Engine
                </h4>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={compareSource}
                  onChange={(e) => setCompareSource(e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[11px]"
                >
                  {releases.map((r) => (
                    <option key={r.version} value={r.version}>
                      Source: {r.version}
                    </option>
                  ))}
                </select>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <select
                  value={compareTarget}
                  onChange={(e) => setCompareTarget(e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[11px]"
                >
                  {releases.map((r) => (
                    <option key={r.version} value={r.version}>
                      Target: {r.version}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Diff Summary Badges */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                  diffResult.isBackwardCompatible
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {diffResult.isBackwardCompatible
                  ? '✓ 100% Backward Compatible'
                  : '⚠️ Contains Breaking Changes'}
              </span>
              <span className="text-slate-500 text-[11px]">
                {diffResult.totalChangesCount} field differences ({diffResult.breakingChangesCount} breaking)
              </span>
            </div>

            {/* Diff Table */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {diffResult.diffs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Both releases have identical field configurations.
                </div>
              ) : (
                diffResult.diffs.map((d) => (
                  <div
                    key={d.key}
                    className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                      d.isBreaking
                        ? 'bg-rose-50/60 border-rose-200'
                        : d.changeType === 'ADDED'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            d.changeType === 'ADDED'
                              ? 'bg-emerald-600 text-white'
                              : d.changeType === 'REMOVED'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {d.changeType}
                        </span>
                        <span className="font-bold text-slate-900">{d.label}</span>
                        <span className="font-mono text-[10px] text-slate-400">({d.key})</span>
                      </div>
                      {d.isBreaking && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">
                          BREAKING
                        </span>
                      )}
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 pl-1">
                      {d.details.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE DRAFT MODAL */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 text-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Fork New Version Draft
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Clone an existing release into an isolated sandbox draft
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Base Version to Clone From
                </label>
                <select
                  value={baseVersion}
                  onChange={(e) => setBaseVersion(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-mono"
                >
                  {releases.map((r) => (
                    <option key={r.version} value={r.version}>
                      {r.version} - {r.releaseName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  New Version String (SemVer) *
                </label>
                <input
                  type="text"
                  required
                  value={newVersionStr}
                  onChange={(e) => setNewVersionStr(e.target.value)}
                  placeholder="e.g. v2.1.0-draft"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Release Title *
                </label>
                <input
                  type="text"
                  required
                  value={newReleaseName}
                  onChange={(e) => setNewReleaseName(e.target.value)}
                  placeholder="e.g. Commercial Fleet OBD Telemetry Extension"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Release Notes
                </label>
                <textarea
                  rows={2}
                  value={newReleaseNotes}
                  onChange={(e) => setNewReleaseNotes(e.target.value)}
                  placeholder="Summary of proposed field and validation additions..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xs"
                >
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
