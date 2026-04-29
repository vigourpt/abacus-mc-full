'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';

interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  installed: boolean;
  agentCount: number;
}

export function SkillsPanel() {
  const { agents } = useAppStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const deriveSkills = useCallback(() => {
    // Derive skills from agent capabilities
    const skillMap = new Map<string, { count: number; divisions: Set<string> }>();

    agents.forEach(agent => {
      const caps = agent.capabilities || [];
      const techs = agent.technicalSkills || [];
      [...caps, ...techs].forEach(skill => {
        const name = String(skill).trim().toLowerCase();
        if (name && name.length > 1) {
          const existing = skillMap.get(name) || { count: 0, divisions: new Set<string>() };
          existing.count++;
          existing.divisions.add(agent.division);
          skillMap.set(name, existing);
        }
      });
    });

    const derived: Skill[] = Array.from(skillMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([name, data], i) => ({
        id: String(i),
        name,
        description: `Used by ${data.count} agent(s) across ${data.divisions.size} division(s)`,
        version: '1.0.0',
        author: Array.from(data.divisions).join(', '),
        category: Array.from(data.divisions)[0] || 'general',
        installed: true,
        agentCount: data.count,
      }));

    setSkills(derived);
    setLoading(false);
  }, [agents]);

  useEffect(() => {
    deriveSkills();
  }, [deriveSkills]);

  const filteredSkills = skills.filter((skill) => {
    if (filter === 'installed') return skill.installed;
    if (filter === 'available') return !skill.installed;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Skills & Capabilities</h2>
          <p className="text-sm text-gray-400 mt-1">Derived from {agents.length} agents</p>
        </div>
        <div className="flex gap-2">
          {['all', 'installed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                filter === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filteredSkills.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📚</span>
          <h3 className="text-lg font-medium text-white mb-2">No Skills Found</h3>
          <p className="text-gray-400 text-sm">
            Skills are derived from agent capabilities. Add agents to see their skills.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-white">{skill.name}</h3>
                  <p className="text-xs text-gray-500">{skill.author}</p>
                </div>
                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                  {skill.agentCount} agents
                </span>
              </div>
              <p className="text-sm text-gray-400">{skill.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
