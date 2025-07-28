// WebSocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext();

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [connectionParams, setConnectionParams] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastJsonMessage, setLastJsonMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = (username, uuid, room) => {
    console.log('Connecting to WebSocket with:', { username, uuid, room });
    setConnectionParams({ username, uuid, room });
  };

  const disconnect = () => {
    console.log('Disconnecting from WebSocket');
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnectionParams(null);
    setIsConnected(false);
  };

  const sendJsonMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  };

  // Create WebSocket connection when we have parameters
  useEffect(() => {
    if (!connectionParams) return;

    const { username, uuid, room } = connectionParams;
    const wsUrl = `ws://127.0.0.1:8000?username=${encodeURIComponent(username)}&uuid=${uuid}&room=${room}`;
    
    console.log('Creating WebSocket connection to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastJsonMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket Disconnected', event);
      setIsConnected(false);
      
      // Only try to reconnect if we still have connection params and it wasn't a clean close
      if (connectionParams && !event.wasClean) {
        console.log('Attempting to reconnect in 2 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          if (connectionParams) { // Double-check we still want to be connected
            console.log('Reconnecting...');
            // This will trigger the useEffect again
            setConnectionParams({...connectionParams});
          }
        }, 2000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [connectionParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value = {
    sendJsonMessage,
    lastJsonMessage,
    isConnected,
    connect,
    disconnect,
    connectionParams
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};