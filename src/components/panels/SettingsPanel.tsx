'use client';

import { useState, useEffect } from 'react';

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'input';
  value: string | boolean;
  options?: string[];
}

interface SettingGroup {
  id: string;
  title: string;
  icon: string;
  settings: Setting[];
}

const DEFAULT_SETTINGS: SettingGroup[] = [
  {
    id: 'general',
    title: 'General',
    icon: '⚙️',
    settings: [
      { id: 'theme', label: 'Theme', description: 'UI color scheme', type: 'select', value: 'dark', options: ['dark', 'light', 'system'] },
      { id: 'language', label: 'Language', description: 'Interface language', type: 'select', value: 'en', options: ['en', 'es', 'fr', 'de'] },
      { id: 'sidebar', label: 'Sidebar Expanded', description: 'Keep sidebar expanded by default', type: 'toggle', value: true },
    ],
  },
  {
    id: 'agents',
    title: 'Agents',
    icon: '🤖',
    settings: [
      { id: 'auto-assign', label: 'Auto-assign Tasks', description: 'Automatically assign new tasks to available agents', type: 'toggle', value: true },
      { id: 'hiring-approval', label: 'Require Hiring Approval', description: 'Manual approval for new agent creation', type: 'toggle', value: true },
      { id: 'max-concurrent', label: 'Max Concurrent Tasks', description: 'Maximum tasks per agent', type: 'input', value: '5' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: '🔔',
    settings: [
      { id: 'email-alerts', label: 'Email Alerts', description: 'Send critical alerts via email', type: 'toggle', value: false },
      { id: 'slack-updates', label: 'Slack Updates', description: 'Post task updates to Slack', type: 'toggle', value: true },
      { id: 'digest', label: 'Daily Digest', description: 'Send daily summary email', type: 'toggle', value: true },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    icon: '🔒',
    settings: [
      { id: 'two-factor', label: '2FA Required', description: 'Require two-factor authentication', type: 'toggle', value: false },
      { id: 'session-timeout', label: 'Session Timeout', description: 'Auto-logout after inactivity (minutes)', type: 'input', value: '30' },
      { id: 'api-key-rotation', label: 'API Key Rotation', description: 'Auto-rotate API keys', type: 'select', value: 'monthly', options: ['weekly', 'monthly', 'quarterly', 'never'] },
    ],
  },
];

const STORAGE_KEY = 'mc_settings';

export function SettingsPanel() {
  const [settingGroups, setSettingGroups] = useState<SettingGroup[]>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all settings exist
        const merged = DEFAULT_SETTINGS.map(group => ({
          ...group,
          settings: group.settings.map(setting => {
            const storedSetting = parsed[setting.id];
            return storedSetting !== undefined ? { ...setting, value: storedSetting } : setting;
          }),
        }));
        setSettingGroups(merged);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settingsObj: Record<string, any> = {};
    settingGroups.forEach(group => {
      group.settings.forEach(setting => {
        settingsObj[setting.id] = setting.value;
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsObj));
    
    // Show saved indicator
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [settingGroups]);

  const updateSetting = (groupId: string, settingId: string, value: string | boolean) => {
    setSettingGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              settings: group.settings.map(s =>
                s.id === settingId ? { ...s, value } : s
              ),
            }
          : group
      )
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>⚙️</span>
              Settings
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Configure Mission Control preferences
            </p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>✓</span>
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {settingGroups.map((group) => (
          <div key={group.id} className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="font-medium text-white flex items-center gap-2">
                <span>{group.icon}</span>
                {group.title}
              </h3>
            </div>
            <div className="divide-y divide-gray-700">
              {group.settings.map((setting) => (
                <div key={setting.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="text-sm font-medium text-white">{setting.label}</div>
                    <div className="text-xs text-gray-500">{setting.description}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {setting.type === 'toggle' && (
                      <button
                        onClick={() => updateSetting(group.id, setting.id, !setting.value)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          setting.value ? 'bg-cyan-600' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            setting.value ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    )}
                    {setting.type === 'select' && (
                      <select
                        value={setting.value as string}
                        onChange={(e) => updateSetting(group.id, setting.id, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        {setting.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {setting.type === 'input' && (
                      <input
                        type="text"
                        value={setting.value as string}
                        onChange={(e) => updateSetting(group.id, setting.id, e.target.value)}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-cyan-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Reset Button */}
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setSettingGroups(DEFAULT_SETTINGS);
          }}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}