'use client';

import { useState, useRef, DragEvent } from 'react';
import { useAppStore } from '@/store';
import { AgentDivision, Agent } from '@/types';
import { cn } from '@/lib/utils';

// Division metadata
const DIVISIONS: { id: AgentDivision; name: string; emoji: string; description: string }[] = [
  { id: 'executive', name: 'Executive', emoji: '👔', description: 'Strategic decisions & leadership' },
  { id: 'strategy', name: 'Strategy', emoji: '🎯', description: 'Planning & long-term vision' },
  { id: 'engineering', name: 'Engineering', emoji: '⚙️', description: 'Development & infrastructure' },
  { id: 'product', name: 'Product', emoji: '📦', description: 'Roadmap & feature planning' },
  { id: 'design', name: 'Design', emoji: '🎨', description: 'UI/UX & creative' },
  { id: 'marketing', name: 'Marketing', emoji: '📢', description: 'Content & campaigns' },
  { id: 'sales', name: 'Sales', emoji: '💰', description: 'Revenue & partnerships' },
  { id: 'paid-media', name: 'Paid Media', emoji: '📈', description: 'Ads & paid acquisition' },
  { id: 'operations', name: 'Operations', emoji: '🏭', description: 'Process & execution' },
  { id: 'support', name: 'Support', emoji: '🎧', description: 'Customer success' },
  { id: 'testing', name: 'Testing', emoji: '🧪', description: 'QA & testing' },
  { id: 'game-development', name: 'Game Dev', emoji: '🎮', description: 'Games & interactive' },
  { id: 'spatial-computing', name: 'Spatial', emoji: '🕶️', description: 'AR/VR & spatial' },
  { id: 'specialized', name: 'Specialized', emoji: '🔬', description: 'Niche expertise' },
  { id: 'project-management', name: 'PM', emoji: '📋', description: 'Project coordination' },
];

interface DragState {
  agentId: string;
  sourceDivision: AgentDivision;
}

export function OrgChartPanel() {
  const { agents, updateAgent } = useAppStore();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverDivision, setDragOverDivision] = useState<AgentDivision | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  // Group agents by division
  const agentsByDivision = DIVISIONS.reduce((acc, div) => {
    acc[div.id] = agents.filter(a => a.division === div.id);
    return acc;
  }, {} as Record<AgentDivision, Agent[]>);

  // Get unassigned agents (for any missing divisions)
  const assignedDivisions = new Set(agents.map(a => a.division));
  const allDivisions = [...DIVISIONS];

  function handleDragStart(e: DragEvent, agent: Agent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', agent.id);
    setDragState({ agentId: agent.id, sourceDivision: agent.division });
  }

  function handleDragOver(e: DragEvent, division: AgentDivision) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDivision(division);
  }

  function handleDragLeave() {
    setDragOverDivision(null);
  }

  function handleDrop(e: DragEvent, targetDivision: AgentDivision) {
    e.preventDefault();
    if (!dragState) return;
    
    const { agentId, sourceDivision } = dragState;
    if (sourceDivision === targetDivision) {
      // No-op if dropped on same division
      setDragState(null);
      setDragOverDivision(null);
      return;
    }

    // Update the agent's division
    updateAgent(agentId, { division: targetDivision });
    
    setDragState(null);
    setDragOverDivision(null);
  }

  function handleDragEnd() {
    setDragState(null);
    setDragOverDivision(null);
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-white">Org Chart</h2>
          <p className="text-xs text-gray-400">Drag agents between divisions</p>
        </div>
        <div className="text-xs text-gray-500">
          {agents.length} agents
        </div>
      </div>

      {/* Division Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allDivisions.map(div => {
            const divAgents = agentsByDivision[div.id] || [];
            const isDragOver = dragOverDivision === div.id;
            const isDraggingFrom = dragState?.sourceDivision === div.id;
            
            return (
              <div
                key={div.id}
                className={cn(
                  "rounded-lg border-2 transition-all duration-200 min-h-[200px]",
                  isDragOver 
                    ? "border-blue-500 bg-blue-500/10" 
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                )}
                onDragOver={(e) => handleDragOver(e, div.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, div.id)}
              >
                {/* Division Header */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 border-b border-gray-700 rounded-t-lg",
                  isDragOver ? "bg-blue-500/20" : "bg-gray-800"
                )}>
                  <span className="text-lg">{div.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{div.name}</div>
                    <div className="text-xs text-gray-400">{divAgents.length} agents</div>
                  </div>
                </div>

                {/* Agents in this division */}
                <div className="p-2 space-y-2">
                  {divAgents.length === 0 ? (
                    <div className={cn(
                      "text-xs text-gray-500 text-center py-4 border-2 border-dashed rounded-lg",
                      isDragOver && "border-blue-500/50 text-blue-400"
                    )}>
                      {isDragOver ? "Drop here" : "No agents"}
                    </div>
                  ) : (
                    divAgents.map(agent => (
                      <div
                        key={agent.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, agent)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-all",
                          "bg-gray-700/50 hover:bg-gray-700 border border-transparent",
                          selectedAgent === agent.id && "border-blue-500 bg-blue-500/20",
                          dragState?.agentId === agent.id && "opacity-50 scale-95"
                        )}
                      >
                        <span className="text-sm">{agent.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {agent.name}
                          </div>
                          {agent.specialization && (
                            <div className="text-xs text-gray-400 truncate">
                              {agent.specialization}
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          agent.status === 'active' && "bg-green-400",
                          agent.status === 'busy' && "bg-yellow-400",
                          agent.status === 'idle' && "bg-gray-500",
                          agent.status === 'sleeping' && "bg-blue-400"
                        )} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag Status Bar */}
      {dragState && (
        <div className="px-4 py-2 bg-blue-500/20 border-t border-blue-500/30">
          <div className="text-xs text-blue-400">
            Dragging agent to another division will update their division assignment.
          </div>
        </div>
      )}
    </div>
  );
}