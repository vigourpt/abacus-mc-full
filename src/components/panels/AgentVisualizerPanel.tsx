'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Agent, AgentDivision, Task } from '@/types';
import { cn } from '@/lib/utils';

// Division colors for visual grouping
const DIVISION_COLORS: Record<AgentDivision, { primary: string; secondary: string; skin: string }> = {
  'executive': { primary: '#FFD700', secondary: '#B8860B', skin: '#FFDAB9' },
  'engineering': { primary: '#00CED1', secondary: '#008B8B', skin: '#F5DEB3' },
  'marketing': { primary: '#FF69B4', secondary: '#DB7093', skin: '#FFE4C4' },
  'sales': { primary: '#32CD32', secondary: '#228B22', skin: '#FFDAB9' },
  'operations': { primary: '#FF8C00', secondary: '#D2691E', skin: '#DEB887' },
  'design': { primary: '#9370DB', secondary: '#6A5ACD', skin: '#FFE4C4' },
  'product': { primary: '#4169E1', secondary: '#27408B', skin: '#F5DEB3' },
  'testing': { primary: '#DC143C', secondary: '#8B0000', skin: '#FFDAB9' },
  'support': { primary: '#20B2AA', secondary: '#2F4F4F', skin: '#DEB887' },
  'paid-media': { primary: '#FF4500', secondary: '#CD3700', skin: '#FFE4C4' },
  'project-management': { primary: '#8B4513', secondary: '#5D2E0C', skin: '#F5DEB3' },
  'spatial-computing': { primary: '#00BFFF', secondary: '#0080FF', skin: '#FFDAB9' },
  'specialized': { primary: '#7B68EE', secondary: '#5A4FCF', skin: '#DEB887' },
  'game-development': { primary: '#9ACD32', secondary: '#6B8E23', skin: '#FFE4C4' },
  'strategy': { primary: '#DDA0DD', secondary: '#BA55D3', skin: '#F5DEB3' },
};

// Character accessories by division
const DIVISION_ACCESSORIES: Record<AgentDivision, { head?: string; hand?: string }> = {
  'executive': { head: 'tie', hand: 'briefcase' },
  'engineering': { head: 'headphones', hand: 'laptop' },
  'marketing': { hand: 'megaphone' },
  'sales': { head: 'headset', hand: 'phone' },
  'operations': { hand: 'clipboard' },
  'design': { hand: 'palette' },
  'product': { hand: 'tablet' },
  'testing': { head: 'glasses', hand: 'magnifier' },
  'support': { head: 'headset', hand: 'coffee' },
  'paid-media': { hand: 'chart' },
  'project-management': { hand: 'clipboard' },
  'spatial-computing': { head: 'vr', hand: 'controller' },
  'specialized': { head: 'glasses', hand: 'laptop' },
  'game-development': { head: 'headphones', hand: 'controller' },
  'strategy': { head: 'glasses', hand: 'tablet' },
};

// Agent visual states
type AgentState = 'idle' | 'working' | 'thinking' | 'completed' | 'sleeping' | 'walking';

interface PixelAgent {
  id: string;
  name: string;
  emoji: string;
  division: AgentDivision;
  status: AgentState;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  currentTask?: string;
  frame: number;
  speechBubble?: string;
  speechTimer: number;
  hairStyle: number;
  facingLeft: boolean;
}

interface FloorConfig {
  name: string;
  divisions: AgentDivision[];
  color: string;
  bgPattern: string;
}

const FLOORS: FloorConfig[] = [
  { name: 'Executive Suite', divisions: ['executive', 'strategy'], color: '#1a1025', bgPattern: 'executive' },
  { name: 'Product & Design', divisions: ['product', 'design', 'spatial-computing'], color: '#101a25', bgPattern: 'creative' },
  { name: 'Engineering Hub', divisions: ['engineering', 'game-development', 'testing'], color: '#0a1a15', bgPattern: 'tech' },
  { name: 'Growth Floor', divisions: ['marketing', 'sales', 'paid-media'], color: '#1a0a15', bgPattern: 'growth' },
  { name: 'Operations Center', divisions: ['operations', 'project-management', 'support', 'specialized'], color: '#151a0a', bgPattern: 'ops' },
];

// Character sprite drawing functions
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colors: { primary: string; secondary: string; skin: string },
  state: AgentState,
  frame: number,
  accessories: { head?: string; hand?: string },
  hairStyle: number,
  facingLeft: boolean
) {
  const scale = 1;
  const w = 32 * scale;
  const h = 48 * scale;
  
  // Animation offsets
  const breatheOffset = Math.sin(frame * 0.15) * 1;
  const workingBounce = state === 'working' ? Math.abs(Math.sin(frame * 0.3)) * 3 : 0;
  const armSwing = state === 'working' ? Math.sin(frame * 0.4) * 15 : 0;
  
  ctx.save();
  if (facingLeft) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h - 2, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Legs
  const legY = y + 32 - workingBounce;
  const legOffset = state === 'working' ? Math.sin(frame * 0.5) * 3 : 0;
  
  // Left leg
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(x + 10, legY, 5, 14 + legOffset);
  // Foot
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 8, legY + 12 + legOffset, 7, 4);
  
  // Right leg
  ctx.fillRect(x + 17, legY, 5, 14 - legOffset);
  // Foot
  ctx.fillRect(x + 17, legY + 12 - legOffset, 7, 4);
  
  // Body (torso)
  ctx.fillStyle = colors.primary;
  const bodyY = y + 18 - workingBounce + breatheOffset;
  
  // Main torso
  ctx.beginPath();
  ctx.roundRect(x + 8, bodyY, 16, 16, 2);
  ctx.fill();
  
  // Collar/neck area
  ctx.fillStyle = colors.skin;
  ctx.fillRect(x + 13, bodyY - 2, 6, 4);
  
  // Arms
  ctx.fillStyle = colors.primary;
  
  // Left arm
  ctx.save();
  ctx.translate(x + 8, bodyY + 2);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.fillRect(-3, 0, 5, 12);
  // Hand
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(0, 14, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Right arm
  ctx.save();
  ctx.translate(x + 24, bodyY + 2);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.fillStyle = colors.primary;
  ctx.fillRect(-2, 0, 5, 12);
  // Hand
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(0, 14, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Hand accessory
  if (accessories.hand && state !== 'sleeping') {
    drawHandAccessory(ctx, accessories.hand, 0, 14, frame);
  }
  ctx.restore();
  
  // Head
  const headY = y + 2 - workingBounce + breatheOffset;
  
  // Head shape (rounded)
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.roundRect(x + 8, headY, 16, 16, 6);
  ctx.fill();
  
  // Hair based on style
  ctx.fillStyle = getHairColor(hairStyle);
  drawHair(ctx, x + 8, headY, 16, hairStyle);
  
  // Eyes
  const eyeY = headY + 8;
  const blinkFrame = frame % 120 < 5;
  
  if (state === 'sleeping') {
    // Closed eyes (sleeping)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 11, eyeY);
    ctx.lineTo(x + 14, eyeY);
    ctx.moveTo(x + 18, eyeY);
    ctx.lineTo(x + 21, eyeY);
    ctx.stroke();
    
    // Zzz
    ctx.fillStyle = '#88f';
    ctx.font = '8px monospace';
    ctx.fillText('z', x + 26, headY - 2);
    ctx.fillText('z', x + 30, headY - 6);
  } else if (blinkFrame) {
    // Blinking
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 11, eyeY);
    ctx.lineTo(x + 14, eyeY);
    ctx.moveTo(x + 18, eyeY);
    ctx.lineTo(x + 21, eyeY);
    ctx.stroke();
  } else {
    // Open eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x + 12, eyeY, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 20, eyeY, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils (looking direction based on state)
    ctx.fillStyle = '#333';
    const pupilOffset = state === 'thinking' ? 1 : 0;
    ctx.beginPath();
    ctx.arc(x + 12 + pupilOffset, eyeY, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 20 + pupilOffset, eyeY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 13, eyeY - 1, 0.5, 0, Math.PI * 2);
    ctx.arc(x + 21, eyeY - 1, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Mouth based on state
  ctx.fillStyle = '#333';
  const mouthY = headY + 12;
  
  if (state === 'working') {
    // Focused expression
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 14, mouthY);
    ctx.lineTo(x + 18, mouthY);
    ctx.stroke();
  } else if (state === 'thinking') {
    // Thinking expression (small o)
    ctx.beginPath();
    ctx.arc(x + 16, mouthY, 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Thought bubble
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x + 30, headY - 5, 3, 0, Math.PI * 2);
    ctx.arc(x + 35, headY - 10, 4, 0, Math.PI * 2);
    ctx.arc(x + 42, headY - 14, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#666';
    ctx.font = '6px monospace';
    ctx.fillText('?', x + 40, headY - 12);
  } else if (state === 'completed') {
    // Happy smile
    ctx.beginPath();
    ctx.arc(x + 16, mouthY - 1, 3, 0, Math.PI);
    ctx.stroke();
  } else if (state === 'sleeping') {
    // Sleeping expression
    ctx.beginPath();
    ctx.arc(x + 16, mouthY, 2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else {
    // Neutral
    ctx.beginPath();
    ctx.arc(x + 16, mouthY, 2, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();
  }
  
  // Head accessory
  if (accessories.head) {
    drawHeadAccessory(ctx, accessories.head, x, headY, colors.primary);
  }
  
  ctx.restore();
}

function getHairColor(style: number): string {
  const colors = ['#2c1810', '#4a3c2a', '#1a1a1a', '#8B4513', '#DAA520', '#A0522D', '#696969', '#D2691E'];
  return colors[style % colors.length];
}

function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, style: number) {
  const hairType = style % 6;
  
  switch (hairType) {
    case 0: // Short hair
      ctx.fillRect(x, y - 2, width, 6);
      ctx.fillRect(x - 1, y + 2, width + 2, 3);
      break;
    case 1: // Spiky
      ctx.fillRect(x, y, width, 5);
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 2 + i * 3, y - 3 - (i % 2) * 2, 3, 5);
      }
      break;
    case 2: // Side part
      ctx.fillRect(x, y - 1, width, 6);
      ctx.fillRect(x - 2, y + 2, 4, 6);
      break;
    case 3: // Afro/curly
      ctx.beginPath();
      ctx.arc(x + width/2, y + 4, 10, Math.PI, 2 * Math.PI);
      ctx.fill();
      break;
    case 4: // Long/ponytail
      ctx.fillRect(x, y - 1, width, 5);
      ctx.fillRect(x + width - 3, y + 5, 5, 12);
      break;
    case 5: // Bald/minimal
      ctx.fillRect(x + 2, y, width - 4, 2);
      break;
  }
}

function drawHeadAccessory(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, color: string) {
  ctx.save();
  switch (type) {
    case 'headphones':
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + 16, y + 2, 12, Math.PI, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#444';
      ctx.fillRect(x + 2, y + 4, 6, 8);
      ctx.fillRect(x + 24, y + 4, 6, 8);
      break;
    case 'headset':
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 16, y + 2, 11, Math.PI, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.fillRect(x + 4, y + 6, 4, 6);
      ctx.fillRect(x + 24, y + 6, 4, 6);
      // Microphone
      ctx.fillStyle = '#666';
      ctx.fillRect(x + 2, y + 10, 8, 2);
      ctx.beginPath();
      ctx.arc(x, y + 14, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'glasses':
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 8, y + 6, 6, 5);
      ctx.strokeRect(x + 18, y + 6, 6, 5);
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 8);
      ctx.lineTo(x + 18, y + 8);
      ctx.stroke();
      break;
    case 'vr':
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 4, 22, 10, 3);
      ctx.fill();
      ctx.fillStyle = '#00ffff';
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x + 8, y + 6, 7, 6);
      ctx.fillRect(x + 17, y + 6, 7, 6);
      ctx.globalAlpha = 1;
      break;
    case 'tie':
      // Tie is drawn on body, not head
      break;
  }
  ctx.restore();
}

function drawHandAccessory(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, frame: number) {
  ctx.save();
  switch (type) {
    case 'laptop':
      ctx.fillStyle = '#555';
      ctx.fillRect(x - 8, y - 2, 12, 8);
      ctx.fillStyle = '#88f';
      ctx.fillRect(x - 7, y - 1, 10, 5);
      break;
    case 'briefcase':
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x - 4, y, 10, 7);
      ctx.fillStyle = '#DAA520';
      ctx.fillRect(x - 1, y - 1, 4, 2);
      break;
    case 'megaphone':
      ctx.fillStyle = '#FF6347';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y - 4);
      ctx.lineTo(x + 10, y + 6);
      ctx.closePath();
      ctx.fill();
      break;
    case 'phone':
      ctx.fillStyle = '#333';
      ctx.fillRect(x - 2, y - 4, 5, 10);
      ctx.fillStyle = '#4af';
      ctx.fillRect(x - 1, y - 3, 3, 6);
      break;
    case 'clipboard':
      ctx.fillStyle = '#D2691E';
      ctx.fillRect(x - 3, y - 6, 8, 12);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 4, 6, 8);
      break;
    case 'palette':
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const colors = ['#f00', '#ff0', '#0f0', '#00f', '#f0f'];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + (i % 3) * 4 - 2, y + Math.floor(i / 3) * 3, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case 'tablet':
      ctx.fillStyle = '#333';
      ctx.fillRect(x - 4, y - 4, 10, 12);
      ctx.fillStyle = '#4af';
      ctx.fillRect(x - 3, y - 3, 8, 9);
      break;
    case 'magnifier':
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 4, y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x - 4, y + 8);
      ctx.stroke();
      break;
    case 'coffee':
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 2, 6, 8);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x - 1, y - 1, 4, 4);
      // Steam
      if (frame % 30 < 15) {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 1, y - 4);
        ctx.quadraticCurveTo(x + 3, y - 7, x + 1, y - 10);
        ctx.stroke();
      }
      break;
    case 'chart':
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 4, y - 4, 10, 10);
      ctx.fillStyle = '#4a4';
      ctx.fillRect(x - 3, y + 3, 2, 2);
      ctx.fillRect(x - 0, y + 1, 2, 4);
      ctx.fillRect(x + 3, y - 2, 2, 7);
      break;
    case 'controller':
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 2, 14, 6, 2);
      ctx.fill();
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      ctx.arc(x - 3, y + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(x + 5, y + 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, hasComputer: boolean) {
  // Desk surface
  ctx.fillStyle = '#5D4E37';
  ctx.beginPath();
  ctx.roundRect(x, y, 60, 8, 2);
  ctx.fill();
  
  // Desk front panel
  ctx.fillStyle = '#4A3F2F';
  ctx.fillRect(x + 2, y + 8, 56, 20);
  
  // Desk legs
  ctx.fillStyle = '#3D3426';
  ctx.fillRect(x + 5, y + 28, 6, 12);
  ctx.fillRect(x + 49, y + 28, 6, 12);
  
  if (hasComputer) {
    // Monitor
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 20, y - 20, 24, 18);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 22, y - 18, 20, 14);
    // Monitor stand
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 29, y - 2, 6, 3);
    ctx.fillRect(x + 26, y, 12, 2);
    
    // Keyboard
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 18, y + 2, 20, 4);
  }
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  // Chair back
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 24, 20, 4);
  ctx.fill();
  
  // Chair seat
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 2, y + 18, 28, 8, 2);
  ctx.fill();
  
  // Chair base/stand
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 10, y + 26, 4, 8);
  
  // Chair wheels
  ctx.fillStyle = '#222';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + 4 + i * 8, y + 36, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function AgentVisualizerPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { agents, tasks } = useAppStore();
  const [pixelAgents, setPixelAgents] = useState<PixelAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<PixelAgent | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'office' | 'grid' | 'flow'>('office');
  const [showLabels, setShowLabels] = useState(true);
  const [autoAnimate, setAutoAnimate] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  // Filter agents based on status filter
  const filteredAgents = agents.filter(agent => {
    if (statusFilter === 'all') return true;
    // Active = has in-progress task assigned to them
    const hasActiveTask = tasks.some(t => t.assignedTo === agent.id && t.status === 'in_progress');
    if (statusFilter === 'active') return hasActiveTask;
    if (statusFilter === 'inactive') return !hasActiveTask;
    return true;
  });

  // Convert real agents to pixel agents with positions
  useEffect(() => {
    const newPixelAgents: PixelAgent[] = filteredAgents.map((agent, index) => {
      const divisionIndex = FLOORS.findIndex(f => f.divisions.includes(agent.division));
      const floor = divisionIndex >= 0 ? divisionIndex : 4;
      const floorAgents = filteredAgents.filter(a => 
        FLOORS[floor].divisions.includes(a.division)
      );
      const posInFloor = floorAgents.findIndex(a => a.id === agent.id);
      
      // Better spacing - 6 agents per row with more space
      const col = posInFloor % 6;
      const row = Math.floor(posInFloor / 6);
      const baseX = 120 + col * 120;
      const baseY = 130 + floor * 180 + row * 80;
      
      const agentTasks = tasks.filter(t => t.assignedTo === agent.id && t.status === 'in_progress');
      const currentTask = agentTasks[0]?.title;
      
      let status: AgentState = 'idle';
      // Show as working if they have an in-progress task, regardless of agent status
      if (agentTasks.length > 0) {
        status = 'working';
      } else if (agent.status === 'active' || agent.status === 'busy') {
        status = 'thinking';
      } else if (agent.status === 'sleeping') {
        status = 'sleeping';
      }
      
      return {
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        division: agent.division,
        status,
        x: baseX,
        y: baseY,
        targetX: baseX + (Math.random() * 10 - 5),
        targetY: baseY + (Math.random() * 6 - 3),
        currentTask,
        frame: Math.floor(Math.random() * 60),
        speechBubble: currentTask ? `Working on: ${currentTask.slice(0, 20)}...` : undefined,
        speechTimer: 0,
        hairStyle: Math.floor(Math.random() * 8),
        facingLeft: Math.random() > 0.5,
      };
    });
    setPixelAgents(newPixelAgents);
  }, [filteredAgents, tasks, statusFilter]);

  // Animation loop
  useEffect(() => {
    if (!autoAnimate) return;
    
    const animate = () => {
      frameCountRef.current += 1;
      
      setPixelAgents(prev => prev.map(agent => {
        let newAgent = { ...agent };
        newAgent.frame = agent.frame + 1;
        
        // Move towards target smoothly
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          newAgent.x += dx * 0.03;
          newAgent.y += dy * 0.03;
        } else if (frameCountRef.current % 180 === 0) {
          // Set new random target occasionally - subtle movement
          const divisionIndex = FLOORS.findIndex(f => f.divisions.includes(agent.division));
          const floor = divisionIndex >= 0 ? divisionIndex : 4;
          const floorAgents = agents.filter(a => FLOORS[floor].divisions.includes(a.division));
          const posInFloor = floorAgents.findIndex(a => a.id === agent.id);
          const col = posInFloor % 6;
          const row = Math.floor(posInFloor / 6);
          const baseX = 120 + col * 120;
          const baseY = 130 + floor * 180 + row * 80;
          
          newAgent.targetX = baseX + (Math.random() * 16 - 8);
          newAgent.targetY = baseY + (Math.random() * 10 - 5);
        }
        
        // Update speech timer
        if (agent.speechTimer > 0) {
          newAgent.speechTimer = agent.speechTimer - 1;
        } else if (agent.currentTask && frameCountRef.current % 300 === 0) {
          newAgent.speechTimer = 150;
        }
        
        return newAgent;
      }));
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [autoAnimate, agents]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      
      // Draw floors with better styling - scale based on canvas size
      const canvas = canvasRef.current;
      const floorWidth = canvas ? canvas.width / (window.devicePixelRatio || 1) - 100 : 800;
      
      FLOORS.forEach((floor, floorIndex) => {
        const floorY = 80 + floorIndex * 180;
        const floorHeight = 160;
        
        // Floor background with gradient
        const gradient = ctx.createLinearGradient(50, floorY, 50, floorY + floorHeight);
        gradient.addColorStop(0, floor.color);
        gradient.addColorStop(1, adjustColor(floor.color, -20));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(50, floorY, Math.max(800, floorWidth), floorHeight, 8);
        ctx.fill();
        
        // Floor border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Floor label with background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect(60, floorY + 8, 140, 28, 4);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(floor.name, 70, floorY + 26);
        
        // Division pills
        let pillX = 70;
        floor.divisions.forEach(div => {
          const color = DIVISION_COLORS[div]?.primary || '#888';
          ctx.fillStyle = color + '40';
          const pillWidth = ctx.measureText(div).width + 12;
          ctx.beginPath();
          ctx.roundRect(pillX, floorY + 40, pillWidth, 16, 8);
          ctx.fill();
          ctx.fillStyle = color;
          ctx.font = '9px system-ui, sans-serif';
          ctx.fillText(div, pillX + 6, floorY + 52);
          pillX += pillWidth + 6;
        });
        
        // Draw desks and chairs for each position
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 6; col++) {
            const deskX = 95 + col * 120;
            const deskY = floorY + 75 + row * 80;
            
            // Only draw if there might be an agent here
            const agentIndex = row * 6 + col;
            const floorAgents = pixelAgents.filter(a => 
              floor.divisions.includes(a.division)
            );
            
            if (agentIndex < floorAgents.length) {
              drawDesk(ctx, deskX, deskY, true);
              const chairColor = DIVISION_COLORS[floorAgents[agentIndex].division]?.primary + '80' || '#666';
              drawChair(ctx, deskX + 18, deskY + 15, chairColor);
            }
          }
        }
      });
      
      // Draw agents (sorted by Y for proper layering)
      const sortedAgents = [...pixelAgents].sort((a, b) => a.y - b.y);
      
      sortedAgents.forEach(agent => {
        const isSelected = selectedAgent?.id === agent.id;
        const colors = DIVISION_COLORS[agent.division] || { primary: '#888', secondary: '#666', skin: '#FFDAB9' };
        const accessories = DIVISION_ACCESSORIES[agent.division] || {};
        
        // Draw the character
        drawCharacter(
          ctx,
          agent.x,
          agent.y,
          colors,
          agent.status,
          agent.frame,
          accessories,
          agent.hairStyle,
          agent.facingLeft
        );
        
        // Status indicator glow for working agents
        if (agent.status === 'working') {
          const pulse = Math.sin(agent.frame * 0.1) * 0.3 + 0.7;
          ctx.strokeStyle = `rgba(0, 255, 100, ${pulse * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(agent.x + 16, agent.y + 24, 24 + pulse * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Selection highlight
        if (isSelected) {
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(agent.x - 6, agent.y - 6, 44, 60);
          ctx.setLineDash([]);
        }
        
        // Name label
        if (showLabels) {
          const labelY = agent.y + 54;
          const name = agent.name.length > 14 ? agent.name.slice(0, 12) + '..' : agent.name;
          const labelWidth = ctx.measureText(name).width + 8;
          
          // Label background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.roundRect(agent.x + 16 - labelWidth/2, labelY - 2, labelWidth, 14, 3);
          ctx.fill();
          
          ctx.fillStyle = '#fff';
          ctx.font = '9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(name, agent.x + 16, labelY + 8);
          ctx.textAlign = 'left';
        }
        
        // Speech bubble with better styling
        if (agent.speechTimer > 0 && agent.currentTask) {
          const bubbleX = agent.x + 40;
          const bubbleY = agent.y - 30;
          const text = agent.currentTask.slice(0, 28);
          const textWidth = Math.min(text.length * 5.5 + 16, 180);
          
          // Bubble shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.roundRect(bubbleX + 2, bubbleY + 2, textWidth, 24, 8);
          ctx.fill();
          
          // Bubble background
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, textWidth, 24, 8);
          ctx.fill();
          
          // Bubble pointer
          ctx.beginPath();
          ctx.moveTo(bubbleX + 8, bubbleY + 24);
          ctx.lineTo(bubbleX - 4, bubbleY + 32);
          ctx.lineTo(bubbleX + 18, bubbleY + 24);
          ctx.fill();
          
          // Text
          ctx.fillStyle = '#333';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(text, bubbleX + 8, bubbleY + 15);
        }
      });
      
      ctx.restore();
      requestAnimationFrame(render);
    };
    
    render();
  }, [pixelAgents, selectedAgent, zoom, pan, showLabels]);

  // Helper function to adjust color brightness
  function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Handle canvas resize - use device pixel ratio for sharp rendering on high-DPI displays
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };
    
    resizeCanvas();
    
    // Use ResizeObserver for more reliable size tracking
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    
    window.addEventListener('resize', resizeCanvas);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Mouse handlers for panning and selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else {
      // Check for agent selection
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      
      const clicked = pixelAgents.find(
        agent => x >= agent.x - 5 && x <= agent.x + 37 && y >= agent.y - 5 && y <= agent.y + 55
      );
      setSelectedAgent(clicked || null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - lastMousePos.x),
        y: pan.y + (e.clientY - lastMousePos.y),
      });
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  };

  // Stats calculations
  const statusCounts = pixelAgents.reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const divisionCounts = pixelAgents.reduce((acc, agent) => {
    acc[agent.division] = (acc[agent.division] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Loading state check
  const isLoading = agents.length === 0;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Control Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎮</span> Agent World
            <span className="ml-2 px-2.5 py-0.5 bg-cyan-600/20 text-cyan-400 text-sm font-semibold rounded-full">
              {filteredAgents.length} agents
            </span>
          </h2>
          
          {/* View Mode Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['office', 'grid', 'flow'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['all', 'active', 'inactive'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                  statusFilter === filter
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status Legend */}
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5 text-gray-300">
                <span className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  status === 'working' && 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]',
                  status === 'thinking' && 'bg-yellow-400',
                  status === 'idle' && 'bg-gray-500',
                  status === 'sleeping' && 'bg-blue-400',
                  status === 'completed' && 'bg-cyan-400',
                )} />
                <span className="capitalize">{status}</span>
                <span className="text-gray-500">({count})</span>
              </span>
            ))}
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-all',
                showLabels ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              )}
            >
              Labels
            </button>
            <button
              onClick={() => setAutoAnimate(!autoAnimate)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-all',
                autoAnimate ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              )}
            >
              {autoAnimate ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition-all"
            >
              Reset View
            </button>
            <span className="text-xs text-gray-500 min-w-[40px] text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Different views based on viewMode */}
        {viewMode === 'office' && (
          /* Canvas Area - Office View */
          <div 
            ref={containerRef}
            className="flex-1 min-h-[400px] h-full relative overflow-hidden cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={e => e.preventDefault()}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%)' }}
            />
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p className="text-gray-400 text-lg">Loading agents...</p>
                <p className="text-gray-500 text-sm mt-1">Fetching data from the database</p>
              </div>
            </div>
          )}
          
          {/* Instructions */}
          <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-black/30 px-3 py-2 rounded-lg">
            🖱️ Scroll to zoom • Right-click drag to pan • Click agent to select
          </div>
        </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {pixelAgents.map(agent => (
                <div
                  key={agent.id}
                  className={cn(
                    'bg-gray-800 rounded-lg p-4 text-center cursor-pointer hover:ring-2 hover:ring-cyan-500 transition-all',
                    agent.status === 'working' && 'ring-2 ring-green-500'
                  )}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <div className="text-4xl mb-2">{agent.emoji}</div>
                  <div className="text-white text-sm font-medium truncate">{agent.name}</div>
                  <div className={cn(
                    'text-xs mt-1 capitalize',
                    agent.status === 'working' && 'text-green-400',
                    agent.status === 'thinking' && 'text-yellow-400',
                    agent.status === 'idle' && 'text-gray-500',
                    agent.status === 'sleeping' && 'text-blue-400'
                  )}>
                    {agent.status}
                  </div>
                  {agent.currentTask && (
                    <div className="text-xs text-gray-400 mt-2 truncate">
                      {agent.currentTask}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flow View - Activity Timeline */}
        {viewMode === 'flow' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              {['working', 'thinking', 'idle', 'sleeping'].map(status => {
                const statusAgents = pixelAgents.filter(a => a.status === status);
                if (statusAgents.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn(
                        'w-3 h-3 rounded-full',
                        status === 'working' && 'bg-green-400',
                        status === 'thinking' && 'bg-yellow-400',
                        status === 'idle' && 'bg-gray-500',
                        status === 'sleeping' && 'bg-blue-400'
                      )} />
                      <span className="text-white font-medium capitalize">{status}</span>
                      <span className="text-gray-500 text-sm">({statusAgents.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statusAgents.map(agent => (
                        <div
                          key={agent.id}
                          className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-1 cursor-pointer hover:bg-gray-700"
                          onClick={() => setSelectedAgent(agent)}
                        >
                          <span className="text-lg">{agent.emoji}</span>
                          <span className="text-white text-sm">{agent.name}</span>
                          {agent.currentTask && (
                            <span className="text-gray-400 text-xs truncate max-w-[100px]">
                              {agent.currentTask}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Side Panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
          {selectedAgent ? (
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                  style={{ 
                    backgroundColor: DIVISION_COLORS[selectedAgent.division]?.primary + '30',
                    border: `2px solid ${DIVISION_COLORS[selectedAgent.division]?.primary}40`
                  }}
                >
                  {selectedAgent.emoji}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedAgent.name}</h3>
                  <p 
                    className="text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{ 
                      backgroundColor: DIVISION_COLORS[selectedAgent.division]?.primary + '30',
                      color: DIVISION_COLORS[selectedAgent.division]?.primary
                    }}
                  >
                    {selectedAgent.division}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      'w-3 h-3 rounded-full',
                      selectedAgent.status === 'working' && 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]',
                      selectedAgent.status === 'thinking' && 'bg-yellow-400',
                      selectedAgent.status === 'idle' && 'bg-gray-500',
                      selectedAgent.status === 'sleeping' && 'bg-blue-400',
                    )} />
                    <span className="text-white capitalize font-medium">{selectedAgent.status}</span>
                  </div>
                </div>
                
                {selectedAgent.currentTask && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Current Task</span>
                    <p className="text-sm text-white mt-2 leading-relaxed">{selectedAgent.currentTask}</p>
                  </div>
                )}
                
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Position</span>
                  <p className="text-sm text-gray-300 mt-2 font-mono">
                    X: {Math.round(selectedAgent.x)} • Y: {Math.round(selectedAgent.y)}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedAgent(null)}
                className="w-full mt-4 py-2.5 bg-gray-800 text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-700 hover:text-white transition-all"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="p-4">
              <h3 className="font-bold text-white mb-4 text-lg">🏢 Office Overview</h3>
              <div className="space-y-3">
                {FLOORS.map(floor => (
                  <div 
                    key={floor.name} 
                    className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">{floor.name}</span>
                      <span className="text-xs text-cyan-400 font-medium bg-cyan-400/10 px-2 py-0.5 rounded-full">
                        {floor.divisions.reduce((sum, div) => sum + (divisionCounts[div] || 0), 0)} agents
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {floor.divisions.map(div => (
                        <span
                          key={div}
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: DIVISION_COLORS[div]?.primary + '20',
                            color: DIVISION_COLORS[div]?.primary,
                            border: `1px solid ${DIVISION_COLORS[div]?.primary}30`
                          }}
                        >
                          {div} ({divisionCounts[div] || 0})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6">
                <h3 className="font-bold text-white mb-4 text-lg">📊 Quick Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 rounded-xl p-4 text-center border border-cyan-800/30">
                    <span className="text-3xl font-bold text-cyan-400">{pixelAgents.length}</span>
                    <p className="text-xs text-gray-400 mt-1">Total Agents</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-xl p-4 text-center border border-green-800/30">
                    <span className="text-3xl font-bold text-green-400">{statusCounts.working || 0}</span>
                    <p className="text-xs text-gray-400 mt-1">Working</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 rounded-xl p-4 text-center border border-yellow-800/30">
                    <span className="text-3xl font-bold text-yellow-400">{statusCounts.thinking || 0}</span>
                    <p className="text-xs text-gray-400 mt-1">Thinking</p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-800/20 rounded-xl p-4 text-center border border-gray-700/30">
                    <span className="text-3xl font-bold text-gray-400">{statusCounts.idle || 0}</span>
                    <p className="text-xs text-gray-400 mt-1">Idle</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
