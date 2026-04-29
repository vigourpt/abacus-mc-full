'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface KnowledgeEntry {
  id: string;
  agentId: string;
  agentName: string;
  type: 'fact' | 'preference' | 'context' | 'learning' | 'capability';
  key: string;
  value: string;
  confidence: number;
  source: 'interaction' | 'task' | 'memory' | 'manual';
  accessCount: number;
  lastAccessed: string;
  createdAt: string;
}

interface AgentKnowledgeProfile {
  agentId: string;
  agentName: string;
  emoji: string;
  entryCount: number;
  lastUpdated: string;
}

export function KnowledgeSystemPanel() {
  const { agents } = useAppStore();
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    // Simulated knowledge entries per agent
    setKnowledge([
      {
        id: '1',
        agentId: 'ceo',
        agentName: 'CEO Agent',
        type: 'fact',
        key: 'company_mission',
        value: 'Build autonomous AI systems that empower businesses to scale operations',
        confidence: 0.95,
        source: 'interaction',
        accessCount: 45,
        lastAccessed: new Date().toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
      {
        id: '2',
        agentId: 'developer',
        agentName: 'Developer Agent',
        type: 'preference',
        key: 'coding_standards',
        value: 'TypeScript strict mode, functional patterns, comprehensive testing required',
        confidence: 0.88,
        source: 'task',
        accessCount: 128,
        lastAccessed: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      },
      {
        id: '3',
        agentId: 'marketing',
        agentName: 'Marketing Agent',
        type: 'learning',
        key: 'audience_insight',
        value: 'Tech startup founders respond best to ROI-focused messaging with concrete metrics',
        confidence: 0.72,
        source: 'interaction',
        accessCount: 23,
        lastAccessed: new Date(Date.now() - 7200000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: '4',
        agentId: 'sales',
        agentName: 'Sales Agent',
        type: 'capability',
        key: 'pitch_framework',
        value: 'AIDA framework: Attention → Interest → Desire → Action with social proof',
        confidence: 0.91,
        source: 'manual',
        accessCount: 67,
        lastAccessed: new Date(Date.now() - 1800000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
      {
        id: '5',
        agentId: 'developer',
        agentName: 'Developer Agent',
        type: 'context',
        key: 'current_project',
        value: 'Building mission control dashboard with Next.js 14 App Router',
        confidence: 0.85,
        source: 'task',
        accessCount: 34,
        lastAccessed: new Date(Date.now() - 600000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: '6',
        agentId: 'analyst',
        agentName: 'Data Analyst Agent',
        type: 'fact',
        key: 'key_metrics',
        value: 'Primary KPIs: user engagement (+15%), conversion rate (3.2%), retention (78%)',
        confidence: 0.93,
        source: 'task',
        accessCount: 89,
        lastAccessed: new Date(Date.now() - 900000).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ]);
  }, [agents]);

  const filteredKnowledge = knowledge.filter(entry => {
    if (selectedAgent && entry.agentId !== selectedAgent) return false;
    if (filterType !== 'all' && entry.type !== filterType) return false;
    if (searchQuery && !entry.value.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !entry.key.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const agentProfiles: AgentKnowledgeProfile[] = agents.slice(0, 6).map(agent => ({
    agentId: agent.id,
    agentName: agent.name,
    emoji: agent.emoji,
    entryCount: knowledge.filter(k => k.agentId === agent.id).length,
    lastUpdated: knowledge
      .filter(k => k.agentId === agent.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || '',
  }));

  const types = [
    { id: 'all', label: 'All Types' },
    { id: 'fact', label: 'Facts', icon: '📚', color: 'text-blue-400' },
    { id: 'preference', label: 'Preferences', icon: '⚙️', color: 'text-purple-400' },
    { id: 'context', label: 'Context', icon: '🎯', color: 'text-cyan-400' },
    { id: 'learning', label: 'Learnings', icon: '🧠', color: 'text-green-400' },
    { id: 'capability', label: 'Capabilities', icon: '💪', color: 'text-orange-400' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🧠</span>
          Agent Knowledge System
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Per-agent memory, learned facts, preferences, and capabilities
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar */}
        <div className="w-56 border-r border-gray-800 flex-shrink-0 overflow-y-auto p-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase px-2 mb-2">Agents</h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedAgent(null)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg transition-colors text-sm',
                !selectedAgent
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              All Agents
            </button>
            {agentProfiles.map(profile => (
              <button
                key={profile.agentId}
                onClick={() => setSelectedAgent(profile.agentId)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg transition-colors text-sm',
                  selectedAgent === profile.agentId
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{profile.emoji}</span>
                  <span className="truncate">{profile.agentName}</span>
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  {profile.entryCount} entries
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Filters */}
          <div className="flex-shrink-0 p-4 border-b border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                placeholder="Search knowledge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'px-3 py-2 rounded text-sm',
                    viewMode === 'cards' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
                  )}
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-3 py-2 rounded text-sm',
                    viewMode === 'list' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'
                  )}
                >
                  List
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {types.map(type => (
                <button
                  key={type.id}
                  onClick={() => setFilterType(type.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs transition-colors',
                    filterType === type.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  )}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Entries */}
          <div className="flex-1 overflow-y-auto p-4">
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredKnowledge.map(entry => (
                  <KnowledgeCard key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredKnowledge.map(entry => (
                  <KnowledgeRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
            
            {filteredKnowledge.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <span className="text-4xl">🧠</span>
                <p className="mt-2">No knowledge entries found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeCard({ entry }: { entry: KnowledgeEntry }) {
  const typeColors: Record<string, string> = {
    fact: 'border-l-blue-500',
    preference: 'border-l-purple-500',
    context: 'border-l-cyan-500',
    learning: 'border-l-green-500',
    capability: 'border-l-orange-500',
  };

  return (
    <div className={cn(
      'bg-gray-800 rounded-lg p-4 border-l-4',
      typeColors[entry.type]
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs text-gray-500 uppercase">{entry.type}</span>
          <div className="text-sm font-medium text-white">{entry.key.replace(/_/g, ' ')}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Confidence</div>
          <div className="text-sm font-bold text-cyan-400">{Math.round(entry.confidence * 100)}%</div>
        </div>
      </div>
      
      <p className="text-sm text-gray-300 mb-3 line-clamp-3">{entry.value}</p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{entry.agentName}</span>
        <span>{entry.accessCount} accesses</span>
      </div>
    </div>
  );
}

function KnowledgeRow({ entry }: { entry: KnowledgeEntry }) {
  const typeIcons: Record<string, string> = {
    fact: '📚',
    preference: '⚙️',
    context: '🎯',
    learning: '🧠',
    capability: '💪',
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
      <span className="text-lg">{typeIcons[entry.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white">{entry.key.replace(/_/g, ' ')}</span>
          <span className="text-xs text-gray-500">{entry.agentName}</span>
        </div>
        <p className="text-sm text-gray-300 truncate">{entry.value}</p>
      </div>
      <div className="text-right text-xs">
        <div className="text-cyan-400 font-medium">{Math.round(entry.confidence * 100)}%</div>
        <div className="text-gray-500">{entry.accessCount}×</div>
      </div>
    </div>
  );
}