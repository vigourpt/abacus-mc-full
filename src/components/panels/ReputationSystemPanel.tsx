'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface AgentReputation {
  agentId: string;
  agentName: string;
  emoji: string;
  division: string;
  score: number;
  rank: number;
  metrics: {
    taskCompletion: number;
    quality: number;
    collaboration: number;
    reliability: number;
    growth: number;
  };
  badges: Badge[];
  level: string;
  totalTasks: number;
  successfulTasks: number;
  avgRating: number;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earnedAt: string;
}

const LEVEL_THRESHOLDS = [
  { name: 'Novice', min: 0, max: 499 },
  { name: 'Apprentice', min: 500, max: 999 },
  { name: 'Journeyman', min: 1000, max: 1999 },
  { name: 'Expert', min: 2000, max: 3499 },
  { name: 'Master', min: 3500, max: 4999 },
  { name: 'Grandmaster', min: 5000, max: Infinity },
];

const BADGE_DEFINITIONS = [
  { id: 'first-task', name: 'First Task', icon: '🎯', tier: 'bronze' as const },
  { id: 'quick-learner', name: 'Quick Learner', icon: '⚡', tier: 'silver' as const },
  { id: 'team-player', name: 'Team Player', icon: '🤝', tier: 'silver' as const },
  { id: 'quality-assured', name: 'Quality Assured', icon: '✅', tier: 'gold' as const },
  { id: 'reliable', name: 'Reliable', icon: '💪', tier: 'gold' as const },
  { id: 'top-performer', name: 'Top Performer', icon: '🏆', tier: 'platinum' as const },
  { id: 'growth-master', name: 'Growth Master', icon: '📈', tier: 'platinum' as const },
];

export function ReputationSystemPanel() {
  const { agents } = useAppStore();
  const [reputations, setReputations] = useState<AgentReputation[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'tasks' | 'rating'>('score');

  useEffect(() => {
    // Simulated reputation data
    const mockReputations: AgentReputation[] = agents.slice(0, 8).map((agent, index) => {
      const score = Math.floor(Math.random() * 4000) + 500;
      const level = LEVEL_THRESHOLDS.find(l => score >= l.min && score <= l.max);
      const totalTasks = Math.floor(Math.random() * 200) + 20;
      const successRate = 0.75 + Math.random() * 0.24;
      
      return {
        agentId: agent.id,
        agentName: agent.name,
        emoji: agent.emoji,
        division: agent.division,
        score,
        rank: index + 1,
        metrics: {
          taskCompletion: Math.round((0.7 + Math.random() * 0.3) * 100),
          quality: Math.round((0.65 + Math.random() * 0.35) * 100),
          collaboration: Math.round((0.6 + Math.random() * 0.4) * 100),
          reliability: Math.round((0.75 + Math.random() * 0.25) * 100),
          growth: Math.round((0.5 + Math.random() * 0.5) * 100),
        },
        badges: BADGE_DEFINITIONS.filter((_, i) => Math.random() > 0.5).slice(0, 3),
        level: level?.name || 'Unknown',
        totalTasks,
        successfulTasks: Math.round(totalTasks * successRate),
        avgRating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      };
    });

    // Sort by score descending and reassign ranks
    mockReputations.sort((a, b) => b.score - a.score);
    mockReputations.forEach((rep, i) => rep.rank = i + 1);
    
    setReputations(mockReputations);
  }, [agents]);

  const sortedReputations = [...reputations].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score;
    if (sortBy === 'tasks') return b.totalTasks - a.totalTasks;
    return b.avgRating - a.avgRating;
  });

  const selectedRep = selectedAgent 
    ? reputations.find(r => r.agentId === selectedAgent) 
    : null;

  const tierColors = {
    bronze: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    silver: { bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/30' },
    gold: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    platinum: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>⭐</span>
          Agent Reputation System
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Track agent performance, scores, badges, and rankings
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Leaderboard */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800">
          {/* Sort Controls */}
          <div className="flex-shrink-0 p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sort by:</span>
              {(['score', 'tasks', 'rating'] as const).map(sort => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors',
                    sortBy === sort
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  )}
                >
                  {sort === 'score' && '🏆 Score'}
                  {sort === 'tasks' && '📋 Tasks'}
                  {sort === 'rating' && '⭐ Rating'}
                </button>
              ))}
            </div>
          </div>

          {/* Rankings */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sortedReputations.map(rep => (
              <div
                key={rep.agentId}
                onClick={() => setSelectedAgent(rep.agentId)}
                className={cn(
                  'bg-gray-800 rounded-lg p-3 cursor-pointer transition-all border',
                  selectedAgent === rep.agentId
                    ? 'border-cyan-500 ring-1 ring-cyan-500'
                    : 'border-gray-700 hover:border-gray-600'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                    rep.rank === 1 && 'bg-yellow-500/20 text-yellow-400',
                    rep.rank === 2 && 'bg-gray-400/20 text-gray-300',
                    rep.rank === 3 && 'bg-orange-500/20 text-orange-400',
                    rep.rank > 3 && 'bg-gray-700 text-gray-400'
                  )}>
                    {rep.rank}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{rep.emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-white truncate">{rep.agentName}</div>
                        <div className="text-xs text-gray-500">{rep.division}</div>
                      </div>
                    </div>
                  </div>

                  {/* Score & Level */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan-400">{rep.score.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{rep.level}</div>
                  </div>

                  {/* Badges Preview */}
                  <div className="flex gap-1">
                    {rep.badges.slice(0, 2).map(badge => (
                      <span key={badge.id} title={badge.name}>
                        {badge.icon}
                      </span>
                    ))}
                    {rep.badges.length > 2 && (
                      <span className="text-xs text-gray-500">+{rep.badges.length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="w-96 flex-shrink-0 overflow-y-auto">
          {selectedRep ? (
            <div className="p-4 space-y-4">
              {/* Agent Header */}
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center text-3xl mb-2">
                  {selectedRep.emoji}
                </div>
                <h3 className="text-lg font-bold text-white">{selectedRep.agentName}</h3>
                <p className="text-sm text-gray-400">{selectedRep.division}</p>
                <div className={cn(
                  'inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium',
                  tierColors[selectedRep.badges[0]?.tier || 'bronze'].bg,
                  tierColors[selectedRep.badges[0]?.tier || 'bronze'].text
                )}>
                  {selectedRep.level}
                </div>
              </div>

              {/* Overall Score */}
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold text-cyan-400">{selectedRep.score.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">Total Reputation Score</div>
              </div>

              {/* Metrics */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Performance Metrics</h4>
                <div className="space-y-3">
                  {Object.entries(selectedRep.metrics).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-white font-medium">{value}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-white">{selectedRep.totalTasks}</div>
                  <div className="text-xs text-gray-500">Total Tasks</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{selectedRep.avgRating}</div>
                  <div className="text-xs text-gray-500">Avg Rating</div>
                </div>
              </div>

              {/* Badges */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Earned Badges</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRep.badges.length > 0 ? (
                    selectedRep.badges.map(badge => (
                      <div
                        key={badge.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border',
                          tierColors[badge.tier].bg,
                          tierColors[badge.tier].border
                        )}
                      >
                        <span className="text-lg">{badge.icon}</span>
                        <div>
                          <div className={cn('text-sm font-medium', tierColors[badge.tier].text)}>
                            {badge.name}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">{badge.tier}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No badges earned yet</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <span className="text-4xl">👆</span>
                <p className="mt-2 text-sm">Select an agent to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}