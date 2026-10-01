import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Database, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import {
  LOGICAL_MODULES,
  LogicalModuleGroup,
  MasterConfig,
  MasterFieldDef,
  WORKSHOP_MODULES,
  DealerTargetModule,
} from '../../data/masterCatalogue';
import {
  createMasterConfig,
  slugifyFieldKey,
  slugifyMasterId,
  validateMasterDefinition,
  FIELD_TYPES,
  DEALER_TARGETS,
} from '../../utils/masterWorkbook';

interface CreateMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroup: LogicalModuleGroup;
  /** In the Dealer Admin view only dealer-owned masters can be created. */
  isAdminTml: boolean;
  onCreated: (master: MasterConfig) => void;
}

interface FieldDraft {
  label: string;
  key: string;
  keyEdited: boolean;
  type: MasterFieldDef['type'];
  mandatory: boolean;
  options: string;
  displayInDealerApp: boolean;
  dealerTargetModule: DealerTargetModule;
}

const emptyField = (): FieldDraft => ({
  label: '',
  key: '',
  keyEdited: false,
  type: 'text',
  mandatory: false,
  options: '',
  displayInDealerApp: false,
  dealerTargetModule: 'general',
});

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';

export const CreateMasterModal: React.FC<CreateMasterModalProps> = ({ isOpen, onClose, defaultGroup, isAdminTml, onCreated }) => {
  const { masterConfigs, createMaster } = useApp();

  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idEdited, setIdEdited] = useState(false);
  const [logicalGroup, setLogicalGroup] = useState<LogicalModuleGroup>(defaultGroup);
  const [moduleCode, setModuleCode] = useState<string>(WORKSHOP_MODULES[0].code);
  const [owner, setOwner] = useState<MasterConfig['owner']>(isAdminTml ? 'TML_ADMIN' : 'DEALER_ADMIN');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([emptyField()]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setId('');
    setIdEdited(false);
    setLogicalGroup(defaultGroup);
    setModuleCode(WORKSHOP_MODULES[0].code);
    setOwner(isAdminTml ? 'TML_ADMIN' : 'DEALER_ADMIN');
    setCategory('');
    setDescription('');
    setFields([emptyField()]);
    setErrors([]);
  }, [isOpen, defaultGroup, isAdminTml]);

  const updateField = (idx: number, patch: Partial<FieldDraft>) =>
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined && !next.keyEdited) next.key = slugifyFieldKey(patch.label);
        return next;
      })
    );

  const fieldDefs: MasterFieldDef[] = useMemo(
    () =>
      fields.map((f) => ({
        key: f.key,
        label: f.label.trim(),
        type: f.type,
        mandatory: f.mandatory,
        options:
          f.type === 'select'
            ? f.options
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
        displayInDealerApp: f.displayInDealerApp,
        dealerTargetModule: f.displayInDealerApp ? f.dealerTargetModule : undefined,
      })),
    [fields]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const def = { id, name, moduleCode, logicalGroup, owner, category, description, fields: fieldDefs };
    const problems = validateMasterDefinition(def, masterConfigs.map((m) => m.id));
    if (!isAdminTml && owner !== 'DEALER_ADMIN') problems.push('Dealer Admin can only create dealer-owned masters.');
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const config = createMasterConfig(def);
    if (createMaster(config)) {
      onCreated(config);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Master"
      subtitle="Define a master and its fields — available immediately, no deployment"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs" aria-label="Create new master">
        {/* Master metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="cm-name" className="font-bold text-slate-700 block mb-1">
              Master Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="cm-name"
              className={inputCls}
              value={name}
              placeholder="e.g. Tyre Brand Master"
              onChange={(e) => {
                setName(e.target.value);
                if (!idEdited) setId(e.target.value.trim() ? slugifyMasterId(e.target.value) : '');
              }}
            />
          </div>
          <div>
            <label htmlFor="cm-id" className="font-bold text-slate-700 block mb-1">
              Master ID <span className="text-rose-500">*</span>
            </label>
            <input
              id="cm-id"
              className={`${inputCls} font-mono`}
              value={id}
              placeholder="tyre_brand_master"
              onChange={(e) => {
                setId(e.target.value.toLowerCase());
                setIdEdited(true);
              }}
            />
          </div>
          <div>
            <label htmlFor="cm-group" className="font-bold text-slate-700 block mb-1">Logical Group</label>
            <select id="cm-group" className={inputCls} value={logicalGroup} onChange={(e) => setLogicalGroup(e.target.value as LogicalModuleGroup)}>
              {LOGICAL_MODULES.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cm-module" className="font-bold text-slate-700 block mb-1">Service Module</label>
            <select id="cm-module" className={inputCls} value={moduleCode} onChange={(e) => setModuleCode(e.target.value)}>
              {WORKSHOP_MODULES.map((m) => (
                <option key={m.code} value={m.code}>{m.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cm-owner" className="font-bold text-slate-700 block mb-1">Governance Owner</label>
            <select
              id="cm-owner"
              className={inputCls}
              value={owner}
              disabled={!isAdminTml}
              onChange={(e) => setOwner(e.target.value as MasterConfig['owner'])}
            >
              <option value="TML_ADMIN">TML Central (OEM)</option>
              <option value="DEALER_ADMIN">Dealership Floor</option>
            </select>
          </div>
          <div>
            <label htmlFor="cm-category" className="font-bold text-slate-700 block mb-1">Category</label>
            <input id="cm-category" className={inputCls} value={category} placeholder="e.g. Tyres & Wheels" onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="cm-desc" className="font-bold text-slate-700 block mb-1">Description</label>
            <input id="cm-desc" className={inputCls} value={description} placeholder="What this master is used for" onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Field builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-blue-700" /> Fields ({fields.length})
            </span>
            <button
              type="button"
              onClick={() => setFields((prev) => [...prev, emptyField()])}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 font-bold hover:bg-blue-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Field
            </button>
          </div>

          {fields.map((f, idx) => (
            <div key={idx} data-testid={`cm-field-${idx}`} className="grid grid-cols-12 gap-2 items-end p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="col-span-12 sm:col-span-3">
                <label htmlFor={`cm-f-label-${idx}`} className="text-[11px] font-semibold text-slate-600 block mb-0.5">Field Label</label>
                <input id={`cm-f-label-${idx}`} className={inputCls} value={f.label} placeholder="e.g. Brand Name" onChange={(e) => updateField(idx, { label: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <label htmlFor={`cm-f-key-${idx}`} className="text-[11px] font-semibold text-slate-600 block mb-0.5">Key</label>
                <input
                  id={`cm-f-key-${idx}`}
                  className={`${inputCls} font-mono`}
                  value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value, keyEdited: true })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <label htmlFor={`cm-f-type-${idx}`} className="text-[11px] font-semibold text-slate-600 block mb-0.5">Type</label>
                <select id={`cm-f-type-${idx}`} className={inputCls} value={f.type} onChange={(e) => updateField(idx, { type: e.target.value as MasterFieldDef['type'] })}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t === 'select' ? 'dropdown' : t}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                {f.type === 'select' ? (
                  <>
                    <label htmlFor={`cm-f-options-${idx}`} className="text-[11px] font-semibold text-slate-600 block mb-0.5">Options (comma separated)</label>
                    <input id={`cm-f-options-${idx}`} className={inputCls} value={f.options} placeholder="MRF, CEAT, Apollo" onChange={(e) => updateField(idx, { options: e.target.value })} />
                  </>
                ) : (
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 pb-2">
                    <input type="checkbox" checked={f.displayInDealerApp} onChange={(e) => updateField(idx, { displayInDealerApp: e.target.checked })} />
                    Show in Dealer App
                  </label>
                )}
              </div>
              <div className="col-span-10 sm:col-span-1 pb-2">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                  <input type="checkbox" aria-label={`Field ${idx + 1} mandatory`} checked={f.mandatory} onChange={(e) => updateField(idx, { mandatory: e.target.checked })} />
                  Req.
                </label>
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end pb-1">
                <button
                  type="button"
                  aria-label={`Remove field ${idx + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {f.type === 'select' && (
                <div className="col-span-12 flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <input type="checkbox" checked={f.displayInDealerApp} onChange={(e) => updateField(idx, { displayInDealerApp: e.target.checked })} />
                    Show in Dealer App
                  </label>
                </div>
              )}
              {f.displayInDealerApp && (
                <div className="col-span-12 sm:col-span-4">
                  <label htmlFor={`cm-f-target-${idx}`} className="text-[11px] font-semibold text-slate-600 block mb-0.5">Dealer screen</label>
                  <select
                    id={`cm-f-target-${idx}`}
                    className={inputCls}
                    value={f.dealerTargetModule}
                    onChange={(e) => updateField(idx, { dealerTargetModule: e.target.value as DealerTargetModule })}
                  >
                    {DEALER_TARGETS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            After creating the master you can add records, more fields, validation ranges and value mappings from its table, or bulk upload rows.
          </p>
        </div>

        {errors.length > 0 && (
          <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Please fix the following
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer">
            Create Master
          </button>
        </div>
      </form>
    </Modal>
  );
};
