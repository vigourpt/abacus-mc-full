// =====================================================
// Autonomous AI Startup - Type Definitions (Phase 2)
// =====================================================

export type AgentStatus = 'idle' | 'active' | 'busy' | 'sleeping' | 'retired';
export type TaskStatus = 'inbox' | 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type AgentDivision = 
  | 'executive' 
  | 'engineering' 
  | 'marketing' 
  | 'sales' 
  | 'operations' 
  | 'design' 
  | 'product' 
  | 'testing' 
  | 'support'
  | 'paid-media'
  | 'project-management'
  | 'spatial-computing'
  | 'specialized'
  | 'game-development'
  | 'strategy';

export type AgentSource = 'local' | 'agency-agents' | 'openclaw' | 'custom';
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
export type CollaborationStatus = 'pending' | 'active' | 'completed' | 'cancelled';

// Agent Definition (expanded for Phase 2)
export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  color: string;
  division: AgentDivision;
  specialization?: string;
  source: AgentSource;
  sourceUrl?: string;
  status: AgentStatus;
  capabilities: string[];
  technicalSkills: string[];
  personalityTraits: string[];
  systemPrompt: string;
  workspacePath?: string;
  model: {
    primary: string;
    fallbacks: string[];
  };
  metrics: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
  };
  dependencies: string[];
  collaborationStyle?: string;
  lastHeartbeat?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Task Definition (expanded for Phase 2)
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  createdBy?: string;
  parentTaskId?: string;
  subtasks: string[];
  dependencies: string[];
  context: Record<string, unknown>;
  expectedOutput?: string;
  actualOutput?: string;
  qualityScore?: number;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message between agents
export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  type: 'request' | 'response' | 'notification' | 'delegation' | 'collaboration';
  taskId?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// Agent Capability for hiring logic
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  taskTypes: string[];
  requiredSkills: string[];
  complexity: 'low' | 'medium' | 'high';
  division?: AgentDivision;
}

// Task-Agent Match Result
export interface TaskAgentMatch {
  agentId: string;
  agentName: string;
  matchScore: number;
  matchedCapabilities: string[];
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

// Hiring Request for dynamic agent creation
export interface HiringRequest {
  id: string;
  taskId: string;
  requiredCapabilities: string[];
  suggestedRole: string;
  suggestedDivision?: AgentDivision;
  priority: TaskPriority;
  justification?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAgentId?: string;
  approvedBy?: string;
  createdAt: Date;
}

// OpenClaw Gateway Connection
export interface GatewayConnection {
  id: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: Date;
  deviceIdentity?: DeviceIdentity;
}

// Ed25519 Device Identity
export interface DeviceIdentity {
  publicKey: string;
  privateKey: string;
  deviceId: string;
  createdAt: Date;
}

// Real-time Event
export interface RealtimeEvent {
  type: 'task_update' | 'agent_status' | 'message' | 'system' | 'collaboration' | 'project_created';
  payload: unknown;
  timestamp: Date;
}

// Task Dependency (Phase 2)
export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DependencyType;
  createdAt: Date;
}

// Agent Collaboration (Phase 2)
export interface AgentCollaboration {
  id: string;
  taskId: string;
  leadAgentId: string;
  collaboratorIds: string[];
  status: CollaborationStatus;
  createdAt: Date;
  completedAt?: Date;
}

// Import History (Phase 2)
export interface ImportHistory {
  id: string;
  source: string;
  sourceUrl?: string;
  agentsImported: number;
  agentsUpdated: number;
  division?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Parsed Agent from External Source
export interface ParsedAgent {
  name: string;
  slug: string;
  description: string;
  emoji: string;
  color: string;
  division: AgentDivision;
  specialization?: string;
  capabilities: string[];
  technicalSkills: string[];
  personalityTraits: string[];
  systemPrompt: string;
  source: AgentSource;
  sourceUrl?: string;
  dependencies?: string[];
  collaborationStyle?: string;
}

// Database Row Types
export interface AgentRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  color: string;
  division: string;
  specialization: string | null;
  source: string;
  source_url: string | null;
  status: string;
  capabilities: string;
  technical_skills: string;
  personality_traits: string;
  system_prompt: string;
  workspace_path: string | null;
  model_config: string;
  metrics: string;
  dependencies: string;
  collaboration_style: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  parent_task_id: string | null;
  subtasks: string;
  dependencies: string;
  context: string;
  expected_output: string | null;
  actual_output: string | null;
  quality_score: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tags: string;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HiringRequestRow {
  id: string;
  task_id: string;
  required_capabilities: string;
  suggested_role: string;
  suggested_division: string | null;
  priority: string;
  justification: string | null;
  status: string;
  created_agent_id: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface TaskDependencyRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  created_at: string;
}

export interface AgentCollaborationRow {
  id: string;
  task_id: string;
  lead_agent_id: string;
  collaborator_ids: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ImportHistoryRow {
  id: string;
  source: string;
  source_url: string | null;
  agents_imported: number;
  agents_updated: number;
  division: string | null;
  metadata: string;
  created_at: string;
}
