'use client';

import { useState } from 'react';

interface SettingGroup {
  id: string;
  title: string;
  icon: string;
  settings: Setting[];
}

interface Setting {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'input';
  value: string | boolean;
  options?: string[];
}

export function SettingsPanel() {
  const [settingGroups, setSettingGroups] = useState<SettingGroup[]>([
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
  ]);

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
    <div className="space-y-6">
      {/* Help Instructions */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚙️</span>
          <div>
            <h3 className="font-medium text-white mb-1">Settings</h3>
            <p className="text-gray-400 mb-2">
              Configure Mission Control preferences. Changes are saved automatically.
            </p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>• <strong>General:</strong> Theme, language, and UI preferences</li>
              <li>• <strong>Agents:</strong> Task assignment and hiring settings</li>
              <li>• <strong>OpenClaw:</strong> Gateway connection and sync settings</li>
              <li>• <strong>Security:</strong> API keys and authentication</li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-white">Settings</h2>

      <div className="space-y-6">
        {settingGroups.map((group) => (
          <div
            key={group.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg"
          >
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="font-medium text-white flex items-center gap-2">
                <span>{group.icon}</span>
                {group.title}
              </h3>
            </div>
            <div className="divide-y divide-gray-700">
              {group.settings.map((setting) => (
                <div
                  key={setting.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{setting.label}</p>
                    <p className="text-gray-500 text-xs">{setting.description}</p>
                  </div>
                  <div>
                    {setting.type === 'toggle' && (
                      <button
                        onClick={() => updateSetting(group.id, setting.id, !setting.value)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          setting.value ? 'bg-cyan-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            setting.value ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    )}
                    {setting.type === 'select' && (
                      <select
                        value={setting.value as string}
                        onChange={(e) => updateSetting(group.id, setting.id, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-white"
                      >
                        {setting.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {setting.type === 'input' && (
                      <input
                        type="text"
                        value={setting.value as string}
                        onChange={(e) => updateSetting(group.id, setting.id, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-white w-20 text-center"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
          Reset to Defaults
        </button>
        <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
}
