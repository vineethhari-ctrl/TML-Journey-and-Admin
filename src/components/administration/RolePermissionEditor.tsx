import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Role, RolePermission, ModuleType } from '../../types';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Check, AlertCircle } from 'lucide-react';

interface RolePermissionEditorProps {
  role: Role | null;
  isOpen: boolean;
  onClose: () => void;
}

const ALL_AVAILABLE_MODULES: (ModuleType | 'Dashboard' | 'Administration' | 'TML Journey')[] = [
  'Dashboard',
  'TML Journey',
  'JC Creation',
  'JC Tracking',
  'SPD',
  'THD',
  'EQC',
  'Claim',
  'BodyShop',
  'IRA',
  'Administration',
];

export const RolePermissionEditor: React.FC<RolePermissionEditorProps> = ({
  role,
  isOpen,
  onClose,
}) => {
  const { updateRolePermissions } = useApp();

  const [permissions, setPermissions] = useState<RolePermission[]>([]);

  React.useEffect(() => {
    if (role) {
      // Ensure all modules are represented
      const mapped = ALL_AVAILABLE_MODULES.map((mod) => {
        const existing = role.permissions.find((p) => p.module === mod);
        if (existing) return { ...existing };
        return {
          module: mod,
          view: true,
          create: false,
          edit: false,
          approve: false,
          delete: false,
          export: false,
        };
      });
      setPermissions(mapped);
    }
  }, [role, isOpen]);

  if (!role) return null;

  const handleToggle = (moduleName: string, field: keyof Omit<RolePermission, 'module'>) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.module === moduleName) {
          return { ...p, [field]: !p[field] };
        }
        return p;
      })
    );
  };

  const handleSave = () => {
    updateRolePermissions(role.id, permissions);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Permissions: ${role.name}`}
      subtitle="Role-Based Access Control (RBAC) Matrix"
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs">
        {/* Role brief */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <h5 className="font-bold text-slate-900 text-sm">{role.name}</h5>
            <p className="text-slate-500 text-[11px] mt-0.5">{role.description}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
            {role.userCount} Assigned Users
          </span>
        </div>

        {/* Matrix Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Module / Workspace</th>
                <th className="py-2.5 px-3 text-center">View</th>
                <th className="py-2.5 px-3 text-center">Create</th>
                <th className="py-2.5 px-3 text-center">Edit</th>
                <th className="py-2.5 px-3 text-center">Approve</th>
                <th className="py-2.5 px-3 text-center">Delete</th>
                <th className="py-2.5 px-3 text-center">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-xs">
              {permissions.map((perm) => (
                <tr key={perm.module} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>{perm.module}</span>
                  </td>

                  {(['view', 'create', 'edit', 'approve', 'delete', 'export'] as const).map(
                    (field) => (
                      <td key={field} className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perm[field]}
                            onChange={() => handleToggle(perm.module, field)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px] px-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Modifying role permissions triggers an administrative audit log event automatically.</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold transition-colors shadow-xs"
          >
            <ShieldCheck className="h-4 w-4" />
            Apply Permission Matrix
          </button>
        </div>
      </div>
    </Modal>
  );
};
