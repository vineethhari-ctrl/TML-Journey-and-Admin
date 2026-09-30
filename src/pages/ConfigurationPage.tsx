import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SystemConfiguration } from '../types';
import { validateConfiguration } from '../utils/configUtil';
import {
  Sliders,
  Clock,
  Shield,
  Bell,
  Compass,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const ConfigurationPage: React.FC = () => {
  const { configuration, updateConfiguration, showToast } = useApp();

  const [formData, setFormData] = useState<SystemConfiguration>({ ...configuration });
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = <K extends keyof SystemConfiguration>(
    key: K,
    value: SystemConfiguration[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateConfiguration(formData);
    if (errors.length > 0) {
      showToast(errors.join(' '), 'error');
      return;
    }
    updateConfiguration(formData);
    setIsDirty(false);
  };

  const handleReset = () => {
    setFormData({ ...configuration });
    setIsDirty(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
              System Policy Engine
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Global Operational Parameters</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Administrative Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enforce enterprise timeouts, password hygiene, exception escalations, and automated journey dispatch thresholds
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span>You have unsaved configuration changes. Click "Save Configuration" to apply and log audit event.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Session Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-700">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Session Configuration
              </h3>
              <p className="text-[11px] text-slate-500">Token lifetimes and concurrency limits</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Session Timeout</span>
                <span className="font-mono text-blue-900 font-bold">{formData.sessionTimeoutMinutes} min</span>
              </div>
              <input
                type="range"
                min="15"
                max="240"
                step="15"
                value={formData.sessionTimeoutMinutes}
                onChange={(e) => handleChange('sessionTimeoutMinutes', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Total duration before a signed JWT token requires re-authentication.
              </p>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Idle Timeout Threshold</span>
                <span className="font-mono text-blue-900 font-bold">{formData.idleTimeoutMinutes} min</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={formData.idleTimeoutMinutes}
                onChange={(e) => handleChange('idleTimeoutMinutes', Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Duration of inactivity before the session changes to IDLE status.
              </p>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Maximum Concurrent Sessions per User</span>
                <span className="font-mono text-blue-900 font-bold">{formData.maxConcurrentSessions} devices</span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.maxConcurrentSessions}
                onChange={(e) => handleChange('maxConcurrentSessions', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-semibold text-slate-800 block">
                  Force Logout on Password Change
                </span>
                <span className="text-[11px] text-slate-400">
                  Revoke all active device tokens immediately upon credential change.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.forceLogoutOnPasswordChange}
                  onChange={(e) => handleChange('forceLogoutOnPasswordChange', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 2. Security Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-700">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Security Configuration
              </h3>
              <p className="text-[11px] text-slate-500">Lockout protection and credential policies</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Maximum Failed Login Attempts
              </label>
              <input
                type="number"
                min="3"
                max="10"
                value={formData.maxLoginAttempts}
                onChange={(e) => handleChange('maxLoginAttempts', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Triggers account lockout after consecutive invalid authentication attempts.
              </p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Account Lock Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={formData.accountLockDurationMinutes}
                onChange={(e) => handleChange('accountLockDurationMinutes', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Password Expiry Cycle (Days)
              </label>
              <input
                type="number"
                min="30"
                max="180"
                value={formData.passwordExpiryDays}
                onChange={(e) => handleChange('passwordExpiryDays', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-semibold text-slate-800 block">
                  Device Registration Required
                </span>
                <span className="text-[11px] text-slate-400">
                  Only MAC/Hardware registered devices can access service modules.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.deviceRegistrationRequired}
                  onChange={(e) => handleChange('deviceRegistrationRequired', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 3. Notification Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-700">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Notification Configuration
              </h3>
              <p className="text-[11px] text-slate-500">Alert channels and dispatch pipelines</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Email Notifications</span>
                <span className="text-[11px] text-slate-400">
                  Dispatch critical security alerts to dealership admin corporate inboxes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailNotificationsEnabled}
                  onChange={(e) => handleChange('emailNotificationsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">SMS Gateway Notifications</span>
                <span className="text-[11px] text-slate-400">
                  Send OTP verification and urgent exception notices via SMS.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smsNotificationsEnabled}
                  onChange={(e) => handleChange('smsNotificationsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">In-App Live Toast Alerts</span>
                <span className="text-[11px] text-slate-400">
                  Display real-time banner alerts inside the Control Center UI.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.inAppNotificationsEnabled}
                  onChange={(e) => handleChange('inAppNotificationsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 4. Journey Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Journey Configuration
              </h3>
              <p className="text-[11px] text-slate-500">Cross-module retention and SLA timeouts</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Journey Event Log Retention (Days)
              </label>
              <input
                type="number"
                min="90"
                max="730"
                value={formData.journeyEventRetentionDays}
                onChange={(e) => handleChange('journeyEventRetentionDays', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Exception Escalation Threshold (Minutes)
              </label>
              <input
                type="number"
                min="10"
                max="120"
                value={formData.exceptionThresholdMinutes}
                onChange={(e) => handleChange('exceptionThresholdMinutes', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Alerts workshop floor managers if an exception remains unresolved after this period.
              </p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Stage SLA Timeout Warning (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={formData.stageTimeoutThresholdHours}
                onChange={(e) => handleChange('stageTimeoutThresholdHours', Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-semibold text-slate-800 block">
                  Auto-Escalate Journey Blockers
                </span>
                <span className="text-[11px] text-slate-400">
                  Notify Regional Service Manager when a vehicle is stuck &gt; 2 hours.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoEscalateExceptions}
                  onChange={(e) => handleChange('autoEscalateExceptions', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
