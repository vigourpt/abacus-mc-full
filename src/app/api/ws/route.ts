import { WebSocketServer, WebSocket } from 'ws';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let wss: WebSocketServer | null = null;

function getWSS() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    
    wss.on('connection', (ws) => {
      console.log('[Chat WS] Client connected');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[Chat WS] Received:', message);
          
          // Echo back to sender and broadcast to other clients
          wss?.clients.forEach((client) => {
            if (client !== ws || message.broadcast !== false) {
              client.send(JSON.stringify({
                ...message,
                timestamp: new Date().toISOString(),
              }));
            }
          });
        } catch (err) {
          console.error('[Chat WS] Failed to parse message:', err);
        }
      });

      ws.on('close', () => {
        console.log('[Chat WS] Client disconnected');
      });
    });
  }
  return wss;
}

export async function GET() {
  // This is a placeholder - the actual WebSocket is handled separately
  return NextResponse.json({ 
    message: 'WebSocket endpoint - connect via ws://host/api/ws',
    clients: 0 
  });
}

export { getWSS };
