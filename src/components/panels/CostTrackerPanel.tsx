'use client';

import { useState, useEffect, useCallback } from 'react';

interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requests: number;
}

export function CostTrackerPanel() {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/system');
      if (res.ok) {
        const data = await res.json();
        if (data.data?.tokenUsage) {
          setTokenUsage(data.data.tokenUsage);
          setTotalCost(data.data.tokenUsage.reduce((sum: number, t: TokenUsage) => sum + t.cost, 0));
        }
      }
    } catch (err) {
      console.error('Failed to fetch cost data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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
        <h2 className="text-xl font-semibold text-white">Cost Tracker</h2>
        <button
          onClick={fetchUsage}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">${totalCost.toFixed(2)}</p>
          <p className="text-sm text-gray-400 mt-1">Total Cost</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">
            {tokenUsage.reduce((sum, t) => sum + t.requests, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">Total Requests</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">{tokenUsage.length}</p>
          <p className="text-sm text-gray-400 mt-1">Models Used</p>
        </div>
      </div>

      {/* Usage by Model */}
      {tokenUsage.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">💰</span>
          <h3 className="text-lg font-medium text-white mb-2">No Usage Data Yet</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Token usage and costs will be tracked here as agents make API calls to AI models.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-medium text-white mb-3">Usage by Model</h3>
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-gray-400">Model</th>
                  <th className="text-right p-3 text-gray-400">Input Tokens</th>
                  <th className="text-right p-3 text-gray-400">Output Tokens</th>
                  <th className="text-right p-3 text-gray-400">Requests</th>
                  <th className="text-right p-3 text-gray-400">Cost</th>
                </tr>
              </thead>
              <tbody>
                {tokenUsage.map((usage, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-3 text-white font-medium">{usage.model}</td>
                    <td className="p-3 text-right text-gray-300">{usage.inputTokens.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-300">{usage.outputTokens.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-300">{usage.requests.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-400">${usage.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
