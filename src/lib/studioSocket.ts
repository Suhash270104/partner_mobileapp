import { io, Socket } from 'socket.io-client';

// Real-time chat, same server and events as the desktop partner app (lib/socket.ts). The session cookie is
// sent with the handshake. Messages themselves are never sent over the socket: POST /chat/message
// validates and saves them, then the server broadcasts the saved copy to the room (receive_message).
const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') || '';
const socketUrl = apiBase.replace(/\/api$/, '');

let socket: Socket | null = null;

export function getStudioSocket(): Socket | null {
  if (!socketUrl) return null;
  if (!socket) {
    socket = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }
  return socket;
}

export function joinStudioRoom(roomId: string) {
  const live = getStudioSocket();
  if (!live || !roomId) return;
  const join = () => live.emit('join_room', { roomId });
  if (live.connected) join();
  else live.once('connect', join);
}

export function leaveStudioRoom(roomId: string) {
  if (roomId) getStudioSocket()?.emit('leave_room', { roomId });
}
