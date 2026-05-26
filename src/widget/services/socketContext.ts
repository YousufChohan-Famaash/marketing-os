import { createContext, useContext } from 'react';
import type { ConversationSocket } from '../types/protocol';

export const SocketContext = createContext<ConversationSocket | null>(null);

/**
 * Read the current ConversationSocket. Returns null if no socket is mounted
 * (e.g. in unit tests). Components should guard against null.
 */
export function useSocket(): ConversationSocket | null {
  return useContext(SocketContext);
}
