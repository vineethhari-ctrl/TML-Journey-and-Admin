import { AuditLogEntry } from '../types';

export const auditService = {
  createEntry(
    action: string,
    module: string,
    entity: string,
    oldValue: string,
    newValue: string,
    user = { userId: 'TML-PO-VH01', userName: 'Vineeth Hari' },
    status: 'SUCCESS' | 'FAILED' | 'WARNING' = 'SUCCESS'
  ): AuditLogEntry {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return {
      id: `AUD-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: formatted,
      userId: user.userId,
      userName: user.userName,
      action,
      module,
      entity,
      oldValue,
      newValue,
      ipAddress: '192.168.1.108',
      status,
    };
  },

  exportToCSV(logs: AuditLogEntry[]): void {
    const headers = ['Timestamp', 'User ID', 'User Name', 'Action', 'Module', 'Entity', 'Old Value', 'New Value', 'IP Address', 'Status'];
    const rows = logs.map((log) => [
      `"${log.timestamp}"`,
      `"${log.userId}"`,
      `"${log.userName}"`,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${log.module.replace(/"/g, '""')}"`,
      `"${log.entity.replace(/"/g, '""')}"`,
      `"${log.oldValue.replace(/"/g, '""')}"`,
      `"${log.newValue.replace(/"/g, '""')}"`,
      `"${log.ipAddress}"`,
      `"${log.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TML_Service_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
