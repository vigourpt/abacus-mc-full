'use client';

import { useState, useEffect } from 'react';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  openPRs: number;
  openIssues: number;
  stars: number;
  lastPush: string;
}

interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  status: 'open' | 'merged' | 'closed';
  createdAt: string;
  labels: string[];
}

export function GitHubPanel() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [prs, setPRs] = useState<PullRequest[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Simulated GitHub data
    setConnected(true);
    setRepos([
      {
        id: '1',
        name: 'autonomous-ai-startup',
        fullName: 'vigourpt/The-Autonomous-AI-Startup-Architecture',
        description: 'The Autonomous AI Startup Architecture - Mission Control',
        defaultBranch: 'main',
        openPRs: 3,
        openIssues: 12,
        stars: 156,
        lastPush: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);
    setPRs([
      {
        id: '1',
        number: 42,
        title: 'feat: Add OpenClaw gateway integration',
        author: 'developer-agent',
        status: 'open',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        labels: ['enhancement', 'priority-high'],
      },
      {
        id: '2',
        number: 41,
        title: 'fix: Memory leak in websocket handler',
        author: 'qa-agent',
        status: 'merged',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        labels: ['bug', 'critical'],
      },
      {
        id: '3',
        number: 40,
        title: 'docs: Update API reference',
        author: 'documentation-agent',
        status: 'open',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        labels: ['documentation'],
      },
    ]);
  }, []);

  const statusColors: Record<string, string> = {
    open: 'text-green-400 bg-green-400/10',
    merged: 'text-purple-400 bg-purple-400/10',
    closed: 'text-red-400 bg-red-400/10',
  };

  if (!connected) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">GitHub Integration</h2>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
          <span className="text-4xl mb-4 block">🐙</span>
          <h3 className="text-lg font-medium text-white mb-2">Connect GitHub</h3>
          <p className="text-gray-400 mb-4">
            Link your GitHub account to manage repositories and PRs
          </p>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
            Connect with GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">GitHub</h2>
        <div className="flex items-center gap-2 text-sm text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          Connected
        </div>
      </div>

      {/* Repositories */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Repositories</h3>
        {repos.map((repo) => (
          <div
            key={repo.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>📒</span>
                <span className="font-medium text-cyan-400">{repo.fullName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>⭐ {repo.stars}</span>
                <span>branch: {repo.defaultBranch}</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">{repo.description}</p>
            <div className="flex gap-4 text-sm">
              <span className="text-green-400">{repo.openPRs} open PRs</span>
              <span className="text-yellow-400">{repo.openIssues} open issues</span>
              <span className="text-gray-500">Last push: {new Date(repo.lastPush).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pull Requests */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Recent Pull Requests</h3>
        <div className="space-y-2">
          {prs.map((pr) => (
            <div
              key={pr.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[pr.status]}`}>
                    {pr.status}
                  </span>
                  <span className="text-gray-500 text-sm">#{pr.number}</span>
                  <span className="text-white font-medium">{pr.title}</span>
                </div>
                <span className="text-sm text-gray-500">by {pr.author}</span>
              </div>
              <div className="flex gap-2 mt-2">
                {pr.labels.map((label) => (
                  <span
                    key={label}
                    className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
