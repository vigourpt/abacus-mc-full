// =====================================================
// Chat WebSocket Client
// Client-side WebSocket for real-time chat with agents
// =====================================================

import { createChildLogger } from './logger';

const logger = createChildLogger('chat-websocket');

export type ChatEventHandler = (message: ChatMessage) => void;

export interface ChatMessage {
  id: string;
  channelId: string;
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  content: string;
  timestamp: string;
  sender: 'user' | 'agent' | 'system';
  format?: 'text' | 'markdown';
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private handlers: Set<ChatEventHandler> = new Set();
  private messageQueue: ChatMessage[] = [];
  private isConnected = false;

  constructor(url?: string) {
    // Use relative WebSocket URL based on current location
    const protocol = typeof window !== 'undefined' 
      ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:')
      : 'ws:';
    const host = typeof window !== 'undefined' 
      ? window.location.host 
      : 'localhost:3000';
    this.url = url || `${protocol}//${host}/api/ws`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.info({ url: this.url }, 'Connecting to chat WebSocket');
        
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          logger.info('Chat WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send any queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) this.send(msg);
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            logger.debug({ data }, 'Received chat message');
            
            const message: ChatMessage = {
              id: data.id || Date.now().toString(),
              channelId: data.channelId || 'default',
              agentId: data.agentId,
              agentName: data.agentName || 'Agent',
              agentEmoji: data.agentEmoji || '🤖',
              content: data.content || data.message || '',
              timestamp: data.timestamp || new Date().toISOString(),
              sender: data.sender || 'agent',
              format: data.format || 'text',
            };
            
            this.handlers.forEach(handler => handler(message));
          } catch (err) {
            logger.error({ error: err }, 'Failed to parse chat message');
          }
        };

        this.ws.onclose = (event) => {
          logger.info({ code: event.code }, 'Chat WebSocket closed');
          this.isConnected = false;
          
          // Attempt reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logger.info({ attempt: this.reconnectAttempts }, 'Reconnecting to chat WebSocket');
            setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
          }
        };

        this.ws.onerror = (error) => {
          logger.error({ error }, 'Chat WebSocket error');
          reject(error);
        };

        // Timeout for connection
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        logger.error({ error }, 'Failed to create WebSocket');
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  send(message: Partial<ChatMessage>): void {
    const fullMessage: ChatMessage = {
      id: message.id || Date.now().toString(),
      channelId: message.channelId || 'mission-control-test',
      content: message.content || '',
      timestamp: new Date().toISOString(),
      sender: 'user',
      ...message,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(fullMessage);
    }
  }

  onMessage(handler: ChatEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let chatWsInstance: ChatWebSocket | null = null;

export function getChatWebSocket(): ChatWebSocket {
  if (!chatWsInstance) {
    chatWsInstance = new ChatWebSocket();
  }
  return chatWsInstance;
}
