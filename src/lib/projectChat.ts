import { router } from 'expo-router';
import { partnerApi } from './partnerApi';

// Opens the conversation with the client of one project, inside the Messages screen (not just the
// list of all conversations). Creates the room first when this studio has not talked to them yet.
// Throws with a readable message when the room cannot be opened (for example the studio is not
// approved yet), so the caller can show it.
export async function openProjectChat(projectId: string): Promise<void> {
  if (!projectId) throw new Error('This project has no conversation yet.');
  const result = await partnerApi.openProfessionalChatRoom(projectId);
  const roomId = result.room?.roomId;
  router.navigate({ pathname: '/professional/messages', params: roomId ? { room: roomId } : {} } as never);
}
