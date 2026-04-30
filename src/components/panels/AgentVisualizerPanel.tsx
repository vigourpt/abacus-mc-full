// Commit: -8740560

import { useState } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type { AgentDivision } from '@/types';

const DIVISIONS: AgentDivision[] = [
  'executive', 'engineering', 'marketing', 'sales', 'operations',
  'design', 'product', 'testing', 'support', 'paid-media',
  'project-management', 'spatial-computing', 'specialized', 'game-development', 'strategy'
];

const EMOJIS = ['🤖', '🦾', '⚙️', '🔧', '💻', '🎨', '📊', '📈', '🎯', '💡', '🚀', '⭐', '🔥', '💫', '🌟'];

const DEMO_AGENTS = [
  { name: 'Jarvis', division: 'executive', emoji: '🤖', specialization: 'Operations & AI Systems', capabilities: ['system-integration', 'automation', 'coordination'] },
  { name: 'Thor', division: 'engineering', emoji: '🔧', specialization: 'Infrastructure & DevOps', capabilities: ['docker', 'networking', 'monitoring'] },
  { name: 'DataBot', division: 'engineering', emoji: '🤖', specialization: 'Data Analysis', capabilities: ['analytics', 'python', 'machine-learning'] },
  { name: 'MarketBot', division: 'marketing', emoji: '📈', specialization: 'Growth Marketing', capabilities: ['seo', 'content', 'social-media'] },
  { name: 'SalesBot', division: 'sales', emoji: '💰', specialization: 'Lead Generation', capabilities: ['outreach', 'crm', 'closing'] },
  { name: 'DesignBot', division: 'design', emoji: '🎨', specialization: 'UI/UX Design', capabilities: ['figma', 'branding', 'prototyping'] },
  { name: 'DevOps Bot', division: 'operations', emoji: '⚙️', specialization: 'CI/CD & Deployment', capabilities: ['github-actions', 'docker', 'kubernetes'] },
  { name: 'ContentBot', division: 'marketing', emoji: '✍️', specialization: 'Content Creation', capabilities: ['writing', 'seo', 'copywriting'] },
  { name: 'SupportBot', division: 'support', emoji: '💬', specialization: 'Customer Support', capabilities: ['tickets', 'chat', 'faq'] },
  { name: 'AnalystBot', division: 'product', emoji: '📊', specialization: 'Product Analytics', capabilities: ['metrics', 'user-research', 'a-b-testing'] },
  { name: 'CopyBot', division: 'marketing', emoji: '✍️', specialization: 'Copywriting & Ads', capabilities: ['google-ads', 'facebook-ads', 'copywriting'] },
  { name: 'CodeBot', division: 'engineering', emoji: '💻', specialization: 'Full-Stack Development', capabilities: ['react', 'nodejs', 'python'] },
];

export function AgentVisualizerPanel() {
  const { agents, setAgents, addAgent } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function seedAgents() {
    setLoading(true);
    setMessage('');
    
    try {
      // Check if agents already exist
      const existing = await fetch('/api/agents');
      const existingData = await existing.json();
      
      if (existingData.length > 0) {
        setMessage(`✅ Already have ${existingData.length} agents in the system`);
        setLoading(false);
        return;
      }

      // Create demo agents via API
      const results = [];
      for (const demo of DEMO_AGENTS) {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: demo.name,
            division: demo.division,
            emoji: demo.emoji,
            specialization: demo.specialization,
            capabilities: demo.capabilities,
            status: 'active',
            description: `${demo.name} - ${demo.specialization}`,
            systemPrompt: `You are ${demo.name}, a ${demo.specialization} specialist.`,
            technicalSkills: demo.capabilities,
            personalityTraits: ['helpful', 'efficient', 'detail-oriented'],
            model: { primary: 'claude-3-haiku', fallbacks: [] },
          }),
        });
        
        if (res.ok) {
          const agent = await res.json();
          results.push(agent);
        }
      }

      if (results.length > 0) {
        // Refresh agents from store
        const refreshRes = await fetch('/api/agents');
        const refreshData = await refreshRes.json();
        setAgents(refreshData);
        
        setMessage(`✅ Seeded ${results.length} demo agents! Click "Agent World" to see them walk around.`);
      }
    } catch (err) {
      setMessage('❌ Error seeding agents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🎮</span>
          Agent World
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Watch your agents walk around their virtual office in real-time
        </p>
      </div>

      {/* No Agents State */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🤖🤖🤖</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Agents Yet</h3>
          <p className="text-gray-400 mb-6">
            Your startup has no AI agents. Seed the database with demo agents to see the Agent World come alive!
          </p>
          
          <button
            onClick={seedAgents}
            disabled={loading}
            className={cn(
              'px-6 py-3 rounded-lg font-medium transition-colors',
              loading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                Seeding...
              </span>
            ) : (
              '🚀 Seed Demo Agents'
            )}
          </button>
          
          {message && (
            <p className="mt-4 text-sm text-cyan-400">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}