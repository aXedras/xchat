
import { Message } from "../types/chat";

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Message event types for WebSocket communication
export interface MessageEvent {
  type: 'message' | 'typing' | 'read' | 'delivered';
  chatId: string;
  payload: any;
}

export class MessagingService {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number = 1000;
  private listeners: Map<string, Function[]> = new Map();
  private status: ConnectionStatus = 'disconnected';

  constructor(url: string) {
    this.url = url;
  }

  // Initialize connection to the WebSocket server
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.status = 'connecting';
        this.notifyListeners('status', this.status);
        
        // Close existing socket if any
        if (this.socket) {
          this.socket.close();
        }

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.notifyListeners('status', this.status);
          console.log('WebSocket connection established');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        };

        this.socket.onerror = (error) => {
          this.status = 'error';
          this.notifyListeners('status', this.status);
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.socket.onclose = (event) => {
          this.status = 'disconnected';
          this.notifyListeners('status', this.status);
          console.log('WebSocket connection closed:', event.code, event.reason);
          
          // Attempt to reconnect if not a clean close
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
          }
        };
      } catch (error) {
        this.status = 'error';
        this.notifyListeners('status', this.status);
        console.error('Error establishing WebSocket connection:', error);
        reject(error);
      }
    });
  }

  // Get current connection status
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  // Reconnect to the WebSocket server with exponential backoff
  private reconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(() => {
        console.log('Reconnection attempt failed');
      });
    }, delay);
  }

  // Close the WebSocket connection
  public disconnect(): void {
    if (this.socket) {
      this.socket.close(1000, 'User initiated disconnect');
      this.socket = null;
    }
  }

  // Send a message through the WebSocket
  public sendMessage(chatId: string, content: string): void {
    if (this.socket && this.status === 'connected') {
      const message = {
        type: 'message',
        chatId,
        payload: {
          content,
          timestamp: new Date().toISOString(),
        },
      };
      
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: WebSocket not connected');
      throw new Error('WebSocket not connected');
    }
  }

  // Send typing indicator
  public sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (this.socket && this.status === 'connected') {
      const message = {
        type: 'typing',
        chatId,
        payload: {
          isTyping,
        },
      };
      
      this.socket.send(JSON.stringify(message));
    }
  }

  // Mark message as read
  public markAsRead(chatId: string, messageId: string): void {
    if (this.socket && this.status === 'connected') {
      const message = {
        type: 'read',
        chatId,
        payload: {
          messageId,
        },
      };
      
      this.socket.send(JSON.stringify(message));
    }
  }

  // Handle incoming messages from WebSocket
  private handleIncomingMessage(data: MessageEvent): void {
    switch (data.type) {
      case 'message':
        this.notifyListeners('message', data.chatId, data.payload);
        break;
      case 'typing':
        this.notifyListeners('typing', data.chatId, data.payload.isTyping);
        break;
      case 'read':
        this.notifyListeners('read', data.chatId, data.payload.messageId);
        break;
      case 'delivered':
        this.notifyListeners('delivered', data.chatId, data.payload.messageId);
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  // Add event listener
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)?.push(callback);
  }

  // Remove event listener
  public off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event) || [];
      const index = callbacks.indexOf(callback);
      
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify all listeners of an event
  private notifyListeners(event: string, ...args: any[]): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event) || [];
      
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (e) {
          console.error('Error in event listener:', e);
        }
      });
    }
  }
}

// Create a singleton instance that can be used throughout the application
let messagingService: MessagingService | null = null;

export const getMessagingService = (url?: string): MessagingService => {
  if (!messagingService && url) {
    messagingService = new MessagingService(url);
  } else if (!messagingService) {
    throw new Error('Messaging service not initialized. Provide WebSocket URL.');
  }
  
  return messagingService;
};

// Reset the messaging service (useful for testing or changing endpoints)
export const resetMessagingService = (): void => {
  if (messagingService) {
    messagingService.disconnect();
    messagingService = null;
  }
};
