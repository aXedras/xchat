
import { useState, useEffect, useCallback } from "react";
import { ConnectionStatus, getMessagingService, IncomingMessagePayload } from "../services/messagingService";
import { toast } from "sonner";

interface UseMessagingServiceProps {
  chatId?: string;
  onMessage?: (chatId: string, message: IncomingMessagePayload) => void;
  onTyping?: (chatId: string, isTyping: boolean) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function useMessagingService({
  chatId,
  onMessage,
  onTyping,
  onStatusChange
}: UseMessagingServiceProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // Initialize connection to the messaging service
  const connect = useCallback(async (url: string) => {
    try {
      const service = getMessagingService(url);
      await service.connect();
      setIsConnected(true);
      return true;
    } catch (error) {
      console.error('Failed to connect to messaging service:', error);
      toast.error('Failed to connect to messaging service');
      return false;
    }
  }, []);

  // Disconnect from the messaging service
  const disconnect = useCallback(() => {
    try {
      const service = getMessagingService();
      service.disconnect();
      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting from messaging service:', error);
    }
  }, []);

  // Send a message via the messaging service
  const sendMessage = useCallback((chatId: string, content: string) => {
    if (!isConnected) {
      toast.error('Not connected to messaging service');
      return false;
    }
    
    try {
      const service = getMessagingService();
      service.sendMessage(chatId, content);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [isConnected]);

  // Send typing indicator via the messaging service
  const sendTypingIndicator = useCallback((chatId: string, isTyping: boolean) => {
    if (!isConnected) return;
    
    try {
      const service = getMessagingService();
      service.sendTypingIndicator(chatId, isTyping);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }, [isConnected]);

  // Mark message as read via the messaging service
  const markAsRead = useCallback((chatId: string, messageId: string) => {
    if (!isConnected) return;
    
    try {
      const service = getMessagingService();
      service.markAsRead(chatId, messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [isConnected]);

  // Set up event listeners for the messaging service
  useEffect(() => {
    if (!isConnected) return;
    
    const service = getMessagingService();
    
    // Status change listener
    const handleStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
      if (onStatusChange) {
        onStatusChange(status);
      }
    };

    // Message listener
    const handleMessage = (receivedChatId: string, message: IncomingMessagePayload) => {
      if (chatId && receivedChatId !== chatId) return;
      
      if (onMessage) {
        onMessage(receivedChatId, message);
      }
    };

    // Typing indicator listener
    const handleTyping = (receivedChatId: string, isTyping: boolean) => {
      if (chatId && receivedChatId !== chatId) return;
      
      if (onTyping) {
        onTyping(receivedChatId, isTyping);
      }
    };

    // Register event listeners
    service.on('status', handleStatusChange);
    service.on('message', handleMessage);
    service.on('typing', handleTyping);
    
    // Initial status
    setConnectionStatus(service.getStatus());

    // Clean up event listeners
    return () => {
      service.off('status', handleStatusChange);
      service.off('message', handleMessage);
      service.off('typing', handleTyping);
    };
  }, [isConnected, chatId, onMessage, onTyping, onStatusChange]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    sendTypingIndicator,
    markAsRead
  };
}
