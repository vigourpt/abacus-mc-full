// =====================================================
// Zustand State Management
// =====================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Agent, Task, AgentMessage, GatewayConnection, RealtimeEvent } from '@/types';

interface AppState {
  // Agents
  agents: Agent[];
  selectedAgentId: string | null;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;

  // Tasks
  tasks: Task[];
  selectedTaskId: string | null;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  selectTask: (id: string | null) => void;

  // Messages
  messages: AgentMessage[];
  addMessage: (message: AgentMessage) => void;
  markMessageRead: (id: string) => void;

  // Gateway
  gatewayConnection: GatewayConnection | null;
  setGatewayConnection: (connection: GatewayConnection | null) => void;

  // Real-time events
  events: RealtimeEvent[];
  addEvent: (event: RealtimeEvent) => void;
  clearEvents: () => void;

  // UI State
  sidebarOpen: boolean;
  activePanel: string;
  toggleSidebar: () => void;
  setActivePanel: (panel: string) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    // Agents
    agents: [],
    selectedAgentId: null,
    setAgents: (agents) => set({ agents }),
    addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
    updateAgent: (id, updates) =>
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      })),
    removeAgent: (id) => set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),
    selectAgent: (id) => set({ selectedAgentId: id }),

    // Tasks
    tasks: [],
    selectedTaskId: null,
    setTasks: (tasks) => set({ tasks }),
    addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
    updateTask: (id, updates) =>
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      })),
    removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
    selectTask: (id) => set({ selectedTaskId: id }),

    // Messages
    messages: [],
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    markMessageRead: (id) =>
      set((state) => ({
        messages: state.messages.map((m) => (m.id === id ? { ...m, read: true } : m)),
      })),

    // Gateway
    gatewayConnection: null,
    setGatewayConnection: (connection) => set({ gatewayConnection: connection }),

    // Events
    events: [],
    addEvent: (event) =>
      set((state) => ({
        events: [...state.events.slice(-99), event], // Keep last 100 events
      })),
    clearEvents: () => set({ events: [] }),

    // UI
    sidebarOpen: true,
    activePanel: 'dashboard',
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setActivePanel: (panel) => set({ activePanel: panel }),

    // Loading
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),
  }))
);

// Selectors
export const selectAgentById = (id: string) => (state: AppState) =>
  state.agents.find((a) => a.id === id);

export const selectTaskById = (id: string) => (state: AppState) =>
  state.tasks.find((t) => t.id === id);

export const selectTasksByStatus = (status: string) => (state: AppState) =>
  state.tasks.filter((t) => t.status === status);

export const selectAgentsByDivision = (division: string) => (state: AppState) =>
  state.agents.filter((a) => a.division === division);

export const selectUnreadMessages = (agentId: string) => (state: AppState) =>
  state.messages.filter((m) => m.toAgentId === agentId && !m.read);
