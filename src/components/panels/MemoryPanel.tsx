'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';

interface MemoryEntry {
  id: string;
  agentId: string;
  agentName: string;
  type: 'fact' | 'preference' | 'context' | 'learning';
  key: string;
  value: string;
  confidence: number;
  createdAt: string;
  accessCount: number;
}

export function MemoryPanel() {
  const { agents } = useAppStore();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    // Simulated memory entries
    setMemories([
      {
        id: '1',
        agentId: 'ceo',
        agentName: 'CEO Agent',
        type: 'fact',
        key: 'company_mission',
        value: 'Build autonomous AI systems that empower businesses',
        confidence: 0.95,
        createdAt: new Date().toISOString(),
        accessCount: 45,
      },
      {
        id: '2',
        agentId: 'developer',
        agentName: 'Developer Agent',
        type: 'preference',
        key: 'coding_style',
        value: 'TypeScript with strict mode, functional patterns preferred',
        confidence: 0.88,
        createdAt: new Date().toISOString(),
        accessCount: 128,
      },
      {
        id: '3',
        agentId: 'marketing',
        agentName: 'Marketing Agent',
        type: 'learning',
        key: 'audience_insight',
        value: 'Tech startup founders respond best to ROI-focused messaging',
        confidence: 0.72,
        createdAt: new Date().toISOString(),
        accessCount: 23,
      },
    ]);
  }, []);

  const typeColors: Record<string, string> = {
    fact: 'bg-blue-500/20 text-blue-400',
    preference: 'bg-purple-500/20 text-purple-400',
    context: 'bg-yellow-500/20 text-yellow-400',
    learning: 'bg-green-500/20 text-green-400',
  };

  const filteredMemories = memories.filter((m) => {
    if (selectedAgent && m.agentId !== selectedAgent) return false;
    if (selectedType && m.type !== selectedType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Agent Memory</h2>
        <div className="flex gap-2">
          <select
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.emoji} {agent.name}
              </option>
            ))}
          </select>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">All Types</option>
            <option value="fact">Facts</option>
            <option value="preference">Preferences</option>
            <option value="context">Context</option>
            <option value="learning">Learnings</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredMemories.map((memory) => (
          <div
            key={memory.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs capitalize ${typeColors[memory.type]}`}>
                  {memory.type}
                </span>
                <span className="text-sm text-gray-500">{memory.agentName}</span>
              </div>
              <div className="text-xs text-gray-500">
                Confidence: {Math.round(memory.confidence * 100)}%
              </div>
            </div>

            <h3 className="font-mono text-cyan-400 text-sm mb-1">{memory.key}</h3>
            <p className="text-gray-300 text-sm">{memory.value}</p>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Accessed {memory.accessCount} times</span>
              <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
