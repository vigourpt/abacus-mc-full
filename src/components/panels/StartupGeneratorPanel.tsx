'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';

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

export function StartupGeneratorPanel() {
  const { addTask } = useAppStore();
  const [idea, setIdea] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedProjectResponse | null>(null);
  const [step, setStep] = useState<'input' | 'generating' | 'success'>('input');

  const handleGenerate = async () => {
    if (!idea.trim() || idea.trim().length < 10) {
      setError('Please describe your startup idea (at least 10 characters)');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('generating');

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
      setStep('success');
      
      // Auto-create tasks from the generated project
      if (data.project.phases) {
        data.project.phases.forEach((phase: any, pIndex: number) => {
          if (phase.taskIds) {
            phase.taskIds.forEach((taskId: string, tIndex: number) => {
              addTask({
                id: taskId,
                title: `${phase.name} - Task ${tIndex + 1}`,
                description: `Generated from startup: ${data.project.name}`,
                status: 'backlog',
                priority: 'medium',
                tags: [data.project.slug, phase.name.toLowerCase().replace(/\s+/g, '-')],
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            });
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStep('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setIdea('');
    setProjectName('');
    setError(null);
    setResult(null);
    setStep('input');
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🚀</span>
          IDEA → STARTUP Generator
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Transform your idea into a complete startup project with automated task pipeline
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === 'input' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Idea Input */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                💡 Your Startup Idea
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your startup idea in detail. What problem does it solve? Who is it for? How does it work?"
                className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* Project Name (optional) */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                📛 Project Name (optional)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Startup"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate from your idea
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!idea.trim() || idea.trim().length < 10}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-lg transition-colors',
                idea.trim().length >= 10
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              )}
            >
              🚀 Generate Startup
            </button>
          </div>
        )}

        {step === 'generating' && (
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-6"></div>
            <h3 className="text-xl font-semibold text-white mb-2">Generating Your Startup...</h3>
            <p className="text-gray-400">This may take a few moments</p>
          </div>
        )}

        {step === 'success' && result && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-6 text-center">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-xl font-semibold text-white mb-2">Startup Generated!</h3>
              <p className="text-gray-400">Your project has been created and tasks added to the pipeline</p>
            </div>

            {/* Project Details */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-4">{result.name}</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Slug</div>
                  <div className="text-white font-mono text-sm">{result.slug}</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Total Tasks</div>
                  <div className="text-white font-semibold">{result.taskCount}</div>
                </div>
              </div>

              {/* Phases */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-400">Phases:</h5>
                {result.phases.map((phase, i) => (
                  <div key={phase.id} className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-2xl">
                      {i === 0 ? '📋' : i === 1 ? '⚙️' : i === 2 ? '🎯' : '🚀'}
                    </span>
                    <div className="flex-1">
                      <div className="text-white font-medium">{phase.name}</div>
                      <div className="text-xs text-gray-500">{phase.taskIds.length} tasks</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              🚀 Generate Another Startup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}