'use client';

import { useState } from 'react';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  lastRun: string;
  status: 'active' | 'paused' | 'error';
  taskTemplate: string;
  assignedAgent: string;
  runsCompleted: number;
}

export function CronPanel() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    paused: 'text-yellow-400 bg-yellow-400/10',
    error: 'text-red-400 bg-red-400/10',
  };

  const toggleStatus = (id: string) => {
    setCronJobs(cronJobs.map(job =>
      job.id === id
        ? { ...job, status: job.status === 'active' ? 'paused' : 'active' }
        : job
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Scheduled Tasks (Cron)</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-white">Create Scheduled Task</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                type="text"
                placeholder="Daily Report"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Schedule (cron syntax)</label>
              <input
                type="text"
                placeholder="0 9 * * *"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Task Template</label>
            <input
              type="text"
              placeholder="Generate daily performance report"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            Cron scheduling will be available once the scheduler service is running.
          </p>
        </div>
      )}

      {cronJobs.length === 0 && !showCreateForm ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">⏰</span>
          <h3 className="text-lg font-medium text-white mb-2">No Scheduled Tasks</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Set up recurring tasks that run on a schedule.
            Perfect for daily reports, weekly analytics, automated backups, and more.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm transition-colors"
          >
            + Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cronJobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <h3 className="font-medium text-white">{job.name}</h3>
                    <code className="text-xs text-cyan-400 bg-gray-900 px-2 py-0.5 rounded">
                      {job.schedule}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[job.status]}`}>
                    {job.status}
                  </span>
                  <button
                    onClick={() => toggleStatus(job.id)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {job.status === 'active' ? '⏸️' : '▶️'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Next Run</p>
                  <p className="text-white">{new Date(job.nextRun).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Last Run</p>
                  <p className="text-white">{new Date(job.lastRun).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Assigned Agent</p>
                  <p className="text-cyan-400">{job.assignedAgent}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Runs</p>
                  <p className="text-white">{job.runsCompleted}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
