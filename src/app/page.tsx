'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { NavRail } from '@/components/layout/NavRail';
import { HeaderBar } from '@/components/layout/HeaderBar';

export default function Home() {
  const { setAgents, setTasks, setLoading, setGatewayConnection } = useAppStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      try {
        // Fetch agents
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agents = await agentsRes.json();
          setAgents(agents);
        }

        // Fetch tasks
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          setTasks(tasks);
        }

        // Check gateway connection status and auto-connect if needed
        const statusRes = await fetch('/api/openclaw/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.success && status.connection) {
            setGatewayConnection(status.connection);
          }
        }

        // Auto-connect to gateways if not connected
        const gatewaysRes = await fetch('/api/gateways');
        if (gatewaysRes.ok) {
          const gateways = await gatewaysRes.json();
          if (gateways.length > 0) {
            try {
              const connectRes = await fetch('/api/gateways/auto-connect', { method: 'POST' });
              if (connectRes.ok) {
                const connectResult = await connectRes.json();
                if (connectResult.success && connectResult.connection) {
                  setGatewayConnection(connectResult.connection);
                }
              }
            } catch (e) {
              console.log('Auto-connect skipped - will try on gateway panel visit');
            }
          }
        }

        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [setAgents, setTasks, setLoading, setGatewayConnection]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Initializing Autonomous AI Startup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh md:h-screen bg-gray-900 overflow-hidden">
      <NavRail />
      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        <HeaderBar />
        <main className="flex-1 overflow-auto md:overflow-auto">
          <Dashboard />
        </main>
      </div>
    </div>
  );
}
