import { MasterFieldDef } from '../data/masterCatalogue';

export interface AuditUserContext {
  userId: string;
  userName: string;
}

export type AuditLogFunction = (
  action: string,
  module: string,
  entity: string,
  oldValue: string,
  newValue: string,
  status?: 'SUCCESS' | 'FAILED' | 'WARNING'
) => void;

/**
 * AuditTrailMiddleware
 * Automatically captures and logs all Master CRUD and Schema operations
 * for compliance, accountability, and traceability.
 */
export const AuditTrailMiddleware = {
  /**
   * Log creation of a new row in any master
   */
  logCreateRow: (params: {
    masterName: string;
    masterId: string;
    record: Record<string, any>;
    user: AuditUserContext;
    logAudit: AuditLogFunction;
  }) => {
    const { masterName, record, logAudit } = params;
    const recordId = record.id || 'NEW_RECORD';

    // Format summary of row fields
    const keys = Object.keys(record).filter((k) => k !== 'id');
    const fieldsSummary = keys
      .slice(0, 4)
      .map((k) => `${k}: "${record[k]}"`)
      .join(', ');

    const newValueString = `Record [${recordId}] created: { ${fieldsSummary}${keys.length > 4 ? ', ...' : ''} }`;

    logAudit(
      'Master Row Created',
      'Masters Maintenance',
      `${masterName} (${recordId})`,
      'None (New Entry)',
      newValueString,
      'SUCCESS'
    );
  },

  /**
   * Log update of an existing row with delta diff tracking
   */
  logUpdateRow: (params: {
    masterName: string;
    masterId: string;
    oldRecord: Record<string, any>;
    newRecord: Record<string, any>;
    user: AuditUserContext;
    logAudit: AuditLogFunction;
  }) => {
    const { masterName, oldRecord, newRecord, logAudit } = params;
    const recordId = oldRecord.id || newRecord.id || 'RECORD';

    // Compute delta changes
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

    allKeys.forEach((key) => {
      if (key === 'id') return;
      const oldVal = oldRecord[key];
      const newVal = newRecord[key];
      if (String(oldVal) !== String(newVal)) {
        changes.push(`${key}: "${oldVal ?? ''}" -> "${newVal ?? ''}"`);
      }
    });

    const diffString = changes.length > 0 ? changes.join(' | ') : 'No semantic value change';

    logAudit(
      'Master Row Updated',
      'Masters Maintenance',
      `${masterName} (${recordId})`,
      JSON.stringify(oldRecord).slice(0, 120) + (JSON.stringify(oldRecord).length > 120 ? '...' : ''),
      diffString,
      'SUCCESS'
    );
  },

  /**
   * Log deletion of a row in any master
   */
  logDeleteRow: (params: {
    masterName: string;
    masterId: string;
    record: Record<string, any>;
    user: AuditUserContext;
    logAudit: AuditLogFunction;
  }) => {
    const { masterName, record, logAudit } = params;
    const recordId = record.id || 'RECORD';

    const keys = Object.keys(record).filter((k) => k !== 'id');
    const snapshot = keys
      .slice(0, 4)
      .map((k) => `${k}: "${record[k]}"`)
      .join(', ');

    logAudit(
      'Master Row Deleted',
      'Masters Maintenance',
      `${masterName} (${recordId})`,
      `Deleted record snapshot: { ${snapshot} }`,
      'PURGED / REMOVED',
      'WARNING'
    );
  },

  /**
   * Log schema parameter extension added by Business Units
   */
  logSchemaExtend: (params: {
    masterName: string;
    masterId: string;
    fieldDef: MasterFieldDef;
    defaultValue: any;
    user: AuditUserContext;
    logAudit: AuditLogFunction;
  }) => {
    const { masterName, fieldDef, defaultValue, logAudit } = params;

    const details = [
      `Field: "${fieldDef.label}" (${fieldDef.key})`,
      `Type: ${fieldDef.type.toUpperCase()}`,
      `Mandatory: ${fieldDef.mandatory ? 'YES' : 'NO'}`,
      fieldDef.options ? `Options: [${fieldDef.options.join(', ')}]` : '',
      `Default: "${defaultValue}"`,
    ]
      .filter(Boolean)
      .join(' | ');

    logAudit(
      'Master Schema Extended',
      'Masters Maintenance',
      `${masterName} (Schema)`,
      'Original Schema Definition',
      details,
      'SUCCESS'
    );
  },
};
