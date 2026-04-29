// Multi-Gateway Agent Registry
// Routes agent queries to multiple OpenClaw gateways

import { NextResponse } from 'next/server';

interface GatewayConfig {
  name: string;
  url: string;
  token: string;
}

const GATEWAYS: GatewayConfig[] = [
  {
    name: 'jarvis',
    url: process.env.JARVIS_GATEWAY_URL || 'ws://localhost:45397',
    token: process.env.JARVIS_GATEWAY_TOKEN || '',
  },
  {
    name: 'thor',
    url: process.env.THOR_GATEWAY_URL || 'ws://187.124.114.207:45397',
    token: process.env.THOR_GATEWAY_TOKEN || '',
  },
];

interface Agent {
  id: string;
  name: string;
  gateway: string;
  status: string;
  division?: string;
  capabilities?: string[];
}

async function fetchAgentsFromGateway(gateway: GatewayConfig): Promise<Agent[]> {
  try {
    // Try to fetch agents via HTTP REST API first
    const response = await fetch(`${gateway.url.replace('ws://', 'http://').replace('wss://', 'https://')}/api/agents`, {
      headers: {
        'Authorization': `Bearer ${gateway.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Gateway ${gateway.name}: HTTP fetch failed`, response.status);
      return [];
    }

    const agents = await response.json();
    return (Array.isArray(agents) ? agents : []).map((agent: any) => ({
      ...agent,
      gateway: gateway.name,
    }));
  } catch (error) {
    console.error(`Gateway ${gateway.name}: Failed to fetch`, error);
    return [];
  }
}

export async function GET() {
  try {
    // Fetch agents from all gateways in parallel
    const results = await Promise.allSettled(
      GATEWAYS.map(gateway => fetchAgentsFromGateway(gateway))
    );

    const allAgents: Agent[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allAgents.push(...result.value);
      } else {
        console.error(`Gateway ${GATEWAYS[index].name} failed:`, result.reason);
      }
    });

    return NextResponse.json({
      success: true,
      agents: allAgents,
      gateways: GATEWAYS.map(g => ({
        name: g.name,
        connected: allAgents.some(a => a.gateway === g.name),
        agentCount: allAgents.filter(a => a.gateway === g.name).length,
      })),
    });
  } catch (error) {
    console.error('Multi-gateway fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from gateways', success: false },
      { status: 500 }
    );
  }
}

// POST: Send command to specific gateway
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gateway, action, agentId, payload } = body;

    const targetGateway = GATEWAYS.find(g => g.name === gateway);
    if (!targetGateway) {
      return NextResponse.json({ error: 'Unknown gateway' }, { status: 400 });
    }

    const baseUrl = targetGateway.url.replace('ws://', 'http://').replace('wss://', 'https://');
    
    // Route action to appropriate endpoint
    const endpoint = action === 'sendMessage' ? '/api/chat' : 
                     action === 'runTask' ? '/api/tasks/run' : 
                     `/api/agents/${agentId || ''}`;

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${targetGateway.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      gateway: targetGateway.name,
      result,
    });
  } catch (error) {
    console.error('Gateway command failed:', error);
    return NextResponse.json(
      { error: 'Command failed', success: false },
      { status: 500 }
    );
  }
}