'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StartupGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (project: GeneratedProjectResponse) => void;
}

interface GeneratedProjectResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  phases: Array<{
    id: string;
    name: string;
    taskIds: string[];
  }>;
  taskCount: number;
}

export function StartupGeneratorModal({ isOpen, onClose, onSuccess }: StartupGeneratorModalProps) {
  const [idea, setIdea] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedProjectResponse | null>(null);

  const handleGenerate = async () => {
    if (!idea.trim() || idea.trim().length < 10) {
      setError('Please describe your startup idea (at least 10 characters)');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/startup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          projectName: projectName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate startup');
      }

      setResult(data.project);
      onSuccess?.(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setIdea('');
    setProjectName('');
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚀</span>
            <div>
              <h2 className="text-xl font-bold text-white">IDEA → STARTUP</h2>
              <p className="text-sm text-gray-400">Transform your idea into a complete startup project</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!result ? (
            <div className="space-y-6">
              {/* Idea Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  💡 Your Startup Idea *
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Describe your startup idea in detail... What problem does it solve? Who is it for?"
                  className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  disabled={isGenerating}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {idea.length}/500 characters (minimum 10)
                </p>
              </div>

              {/* Project Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  📝 Project Name (Optional)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>

              {/* Pipeline Preview */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 mb-3">📋 What will be generated:</h3>
                <div className="grid grid-cols-2 gap-3">
                  <PhaseCard
                    phase="1. Product Definition"
                    icon="🎯"
                    tasks={["Market Research", "Product Spec"]}
                  />
                  <PhaseCard
                    phase="2. Design"
                    icon="🎨"
                    tasks={["UX Design", "UI Design System"]}
                  />
                  <PhaseCard
                    phase="3. Build"
                    icon="🔧"
                    tasks={["Architecture", "Backend", "Frontend"]}
                  />
                  <PhaseCard
                    phase="4. Marketing"
                    icon="📣"
                    tasks={["Brand Copy", "SEO", "Growth Strategy"]}
                  />
                </div>
                <p className="mt-3 text-xs text-gray-500 text-center">
                  10 tasks across 4 phases • ~84 estimated hours
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                  ⚠️ {error}
                </div>
              )}
            </div>
          ) : (
            /* Success Result */
            <div className="space-y-6">
              <div className="text-center py-4">
                <span className="text-5xl">🎉</span>
                <h3 className="text-xl font-bold text-white mt-3">Startup Generated!</h3>
                <p className="text-gray-400 mt-1">{result.name}</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-cyan-400">{result.phases.length}</p>
                    <p className="text-xs text-gray-500">Phases</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{result.taskCount}</p>
                    <p className="text-xs text-gray-500">Tasks Created</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">Ready</p>
                    <p className="text-xs text-gray-500">Pipeline Status</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Created Phases:</h4>
                {result.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="flex items-center justify-between bg-gray-800 rounded px-3 py-2"
                  >
                    <span className="text-white">{phase.name}</span>
                    <span className="text-gray-500 text-sm">{phase.taskIds.length} tasks</span>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-400 text-center">
                View your tasks in the <span className="text-cyan-400">Pipeline Dashboard</span> to track progress!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800 bg-gray-900/50">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || idea.trim().length < 10}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
                  isGenerating || idea.trim().length < 10
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500'
                )}
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Generate Startup
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setResult(null);
                  setIdea('');
                  setProjectName('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Generate Another
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500"
              >
                View Pipeline
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, icon, tasks }: { phase: string; icon: string; tasks: string[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-medium text-white">{phase}</span>
      </div>
      <ul className="space-y-1">
        {tasks.map((task, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-center gap-1">
            <span className="text-gray-600">•</span> {task}
          </li>
        ))}
      </ul>
    </div>
  );
}
