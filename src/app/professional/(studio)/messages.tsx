import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import type { FlatListInstance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { partnerApi } from '../../../lib/partnerApi';
import { generatedFileName, normalizeMime, uploadStudioFile } from '../../../lib/professionalOnboarding';
import { getStudioSocket, joinStudioRoom } from '../../../lib/studioSocket';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { ProposalContext, ProposalSheet } from '../../../components/studio/leadSheets';
import { useStudio } from '../../../components/studio/StudioContext';

interface ChatMessage {
  id: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: string;
  attachment?: { name: string; size?: string; type: 'image' | 'file'; url: string };
}

interface Thread {
  id: string;
  projectId: string;
  clientName: string;
  clientAvatar?: string;
  projectTitle: string;
  location: string;
  budget: string;
  unreadCount: number;
  updatedAt: string;
  hasSubmittedProposal: boolean;
  isAwarded: boolean;
  proposalStatus: string | null;
  messages: ChatMessage[];
}

// Chat rooms carry no server-side read state, so unread is tracked per device: the time each
// conversation was last opened (same rule as desktop).
const SEEN_PREFIX = 'kraftnex_chat_seen_';
async function readSeen(studioId: string): Promise<Record<string, number>> {
  try { return JSON.parse((await AsyncStorage.getItem(SEEN_PREFIX + studioId)) || '{}') || {}; } catch { return {}; }
}
async function markSeen(studioId: string, roomId: string) {
  if (!studioId || !roomId) return;
  try {
    const seen = await readSeen(studioId);
    seen[roomId] = Date.now();
    await AsyncStorage.setItem(SEEN_PREFIX + studioId, JSON.stringify(seen));
  } catch { /* unread badges just reset next time */ }
}

function relative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const stamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

interface RawRoom {
  roomId: string;
  clientName?: string;
  customerId?: { name?: string; profileImage?: string; city?: string };
  projectTitle?: string;
  projectId?: { _id?: string; title?: string; location?: string; budgetRange?: string } | string;
  professionalId?: unknown;
  location?: string;
  budget?: string;
  isAwarded?: boolean;
  proposalStatus?: string;
  hasSubmittedProposal?: boolean;
  updatedAt?: string;
  messages?: ChatMessage[];
}

export default function MessagesScreen() {
  const { profile, studioName } = useStudio();
  const params = useLocalSearchParams<{ room?: string }>();
  const studioId = profile._id || '';
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');
  const openRef = useRef('');
  const [input, setInput] = useState('');
  const [attachError, setAttachError] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [proposal, setProposal] = useState<ProposalContext | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const listRef = useRef<FlatListInstance>(null);
  const requestedRoom = useRef(params.room || '');

  useEffect(() => { openRef.current = openId; }, [openId]);

  const loadThreads = useCallback(async () => {
    try {
      const raw = await partnerApi.studioChatRooms();
      const rooms = (Array.isArray(raw) ? raw : (raw as { rooms?: unknown[] }).rooms || []) as RawRoom[];
      const seen = await readSeen(studioId);
      const built: Thread[] = rooms.map(room => {
        const lastSeen = seen[room.roomId] || 0;
        const messages = room.messages || [];
        // The open conversation is being read right now, so it never shows a badge.
        const unread = room.roomId === openRef.current ? 0 : messages.filter(m => m.sender === 'client' && new Date(m.timestamp).getTime() > lastSeen).length;
        const project = typeof room.projectId === 'object' ? room.projectId : undefined;
        const awarded = Boolean(room.isAwarded || room.proposalStatus === 'Awarded' || room.proposalStatus === 'Won');
        return {
          id: room.roomId,
          projectId: String(project?._id || (typeof room.projectId === 'string' ? room.projectId : '')),
          clientName: room.clientName || room.customerId?.name || 'Client',
          clientAvatar: room.customerId?.profileImage,
          projectTitle: room.projectTitle || project?.title || 'Design Project',
          location: room.location || project?.location || room.customerId?.city || '',
          budget: room.budget || project?.budgetRange || '',
          unreadCount: unread,
          updatedAt: room.updatedAt || new Date().toISOString(),
          hasSubmittedProposal: Boolean(room.hasSubmittedProposal || room.proposalStatus === 'Submitted'),
          isAwarded: awarded,
          proposalStatus: room.proposalStatus || null,
          messages,
        };
      });
      setThreads(built);
      setError('');
      if (requestedRoom.current && built.some(thread => thread.id === requestedRoom.current)) {
        setOpenId(requestedRoom.current);
        requestedRoom.current = '';
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    const first = setTimeout(() => { void loadThreads(); }, 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void loadThreads(); }, 8000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [loadThreads]);

  // Live messages over the socket; the poll above is only a safety net.
  const roomKey = threads.map(thread => thread.id).join(',');
  useEffect(() => {
    const live = getStudioSocket();
    if (!live) return;
    roomKey.split(',').filter(Boolean).forEach(joinStudioRoom);
    const onReceive = ({ roomId, message }: { roomId: string; message: ChatMessage }) => {
      setThreads(previous => previous.map(thread => {
        if (thread.id !== roomId) return thread;
        if (thread.messages.some(m => m.id === message.id || (m.text === message.text && m.timestamp === message.timestamp && m.sender === message.sender))) return thread;
        const isOpen = thread.id === openRef.current;
        if (isOpen) void markSeen(studioId, thread.id);
        return { ...thread, unreadCount: !isOpen && message.sender === 'client' ? thread.unreadCount + 1 : thread.unreadCount, updatedAt: new Date().toISOString(), messages: [...thread.messages, message] };
      }));
    };
    live.on('receive_message', onReceive);
    return () => { live.off('receive_message', onReceive); };
  }, [roomKey, studioId]);

  const active = threads.find(thread => thread.id === openId) || null;

  useEffect(() => {
    if (!active) return;
    void markSeen(studioId, active.id);
  }, [active?.id, active?.messages.length, studioId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(message: ChatMessage, roomId: string) {
    setThreads(previous => previous.map(thread => (thread.id === roomId ? { ...thread, unreadCount: 0, updatedAt: new Date().toISOString(), messages: [...thread.messages, message] } : thread)));
    try {
      await partnerApi.sendChatMessage(roomId, message as unknown as Record<string, unknown>);
    } catch (e) {
      setThreads(previous => previous.map(thread => (thread.id === roomId ? { ...thread, messages: thread.messages.filter(m => m.id !== message.id) } : thread)));
      setAttachError(e instanceof Error ? e.message : 'Unable to send this message. Please try again.');
    }
  }

  function sendText() {
    const text = input.trim();
    if (!text || !active) return;
    setAttachError('');
    setInput('');
    void send({ id: `msg_prof_${Date.now()}`, sender: 'professional', senderName: studioName, text, timestamp: new Date().toISOString() }, active.id);
  }

  async function attach(file: { uri: string; name: string; mimeType: string; size?: number | null }) {
    if (!active) return;
    const isImage = file.mimeType.startsWith('image/');
    if (!isImage && file.mimeType !== 'application/pdf') {
      setAttachError('You can share images (JPEG, PNG, WebP, AVIF) or PDF documents.');
      return;
    }
    setAttachError('');
    setAttaching(true);
    try {
      // Through the moderated image pipeline, so the client can open it on their side too.
      const url = await uploadStudioFile({ uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size }, 'chatAttachment', active.id);
      const size = !file.size ? undefined : file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
      await send({
        id: `msg_prof_${Date.now()}`, sender: 'professional', senderName: studioName,
        text: isImage ? `Shared image: ${file.name}` : `Shared document: ${file.name}`,
        timestamp: new Date().toISOString(),
        attachment: { name: file.name, size, type: isImage ? 'image' : 'file', url },
      }, active.id);
    } catch (e) {
      setAttachError(e instanceof Error && e.message ? e.message : 'Unable to upload this file. Please try again.');
    } finally {
      setAttaching(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const name = asset.fileName || generatedFileName('chat');
    await attach({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name), size: asset.fileSize });
  }
  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    await attach({ uri: asset.uri, name: asset.name, mimeType: normalizeMime(asset.mimeType, asset.name), size: asset.size });
  }

  const totalUnread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const q = query.trim().toLowerCase();
  const filtered = threads.filter(thread => !q || thread.clientName.toLowerCase().includes(q) || thread.projectTitle.toLowerCase().includes(q) || thread.location.toLowerCase().includes(q));

  if (loading) return <View style={s.center}><ActivityIndicator color={c.green} size="large" /></View>;

  if (active) {
    const awarded = active.isAwarded || active.proposalStatus === 'Awarded' || active.proposalStatus === 'Won';
    const waiting = active.hasSubmittedProposal || active.proposalStatus === 'Submitted' || active.proposalStatus === 'Under Review';
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.threadHead}>
          <Pressable onPress={() => { setThreads(previous => previous.map(thread => (thread.id === active.id ? { ...thread, unreadCount: 0 } : thread))); setOpenId(''); }} hitSlop={10}><Text style={s.back}>←</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.threadName} numberOfLines={1}>{active.clientName}</Text>
            <Text style={s.threadSub} numberOfLines={1}>{[active.projectTitle, active.budget && active.budget !== '—' ? active.budget : ''].filter(Boolean).join(' • ')}</Text>
          </View>
          {awarded ? <View style={[s.status, { backgroundColor: c.green }]}><Text style={s.statusText}>Accepted ✓</Text></View>
            : waiting ? <View style={[s.status, { backgroundColor: c.amber }]}><Text style={s.statusText}>Waiting to Accept ⏳</Text></View>
            : <Pressable style={[s.status, { backgroundColor: c.green }]} onPress={() => setProposal({ projectId: active.projectId || active.id, clientName: active.clientName, projectTitle: active.projectTitle, location: active.location, budget: active.budget })}><Text style={s.statusText}>Request Proposal</Text></Pressable>}
        </View>

        <FlatList
          ref={listRef}
          data={active.messages}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={s.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={s.emptyCopy}>No messages yet. Say hello to {active.clientName}.</Text>}
          renderItem={({ item }) => {
            const mine = item.sender === 'professional';
            return (
              <View style={[s.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {!mine && !!item.senderName && <Text style={s.sender}>{item.senderName}</Text>}
                  {item.attachment?.type === 'image' ? (
                    <Pressable onPress={() => setLightbox({ url: item.attachment!.url, title: item.attachment!.name })}><Image source={{ uri: item.attachment.url }} style={s.attachImage} /></Pressable>
                  ) : item.attachment ? (
                    <Pressable onPress={() => void Linking.openURL(item.attachment!.url)}><Text style={[s.file, mine && { color: '#fff' }]}>📄 {item.attachment.name}{item.attachment.size ? ` · ${item.attachment.size}` : ''}</Text></Pressable>
                  ) : null}
                  {(!item.attachment || !/^Shared (image|document):/.test(item.text)) && <Text style={[s.text, mine && { color: '#fff' }]}>{item.text}</Text>}
                  <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>{stamp(item.timestamp)}</Text>
                </View>
              </View>
            );
          }}
        />

        {!!attachError && <View style={{ paddingHorizontal: 14 }}><ErrorText>{attachError}</ErrorText></View>}
        <View style={s.composer}>
          <Pressable style={s.attach} onPress={() => void pickImage()} disabled={attaching}>{attaching ? <ActivityIndicator color={c.green} /> : <Text style={s.attachText}>🖼</Text>}</Pressable>
          <Pressable style={s.attach} onPress={() => void pickPdf()} disabled={attaching}><Text style={s.attachText}>📎</Text></Pressable>
          <TextInput style={s.input} value={input} onChangeText={setInput} placeholder="Type a message…" placeholderTextColor="#98a59f" multiline onSubmitEditing={sendText} />
          <Pressable style={[s.send, !input.trim() && { opacity: 0.5 }]} disabled={!input.trim()} onPress={sendText}><Text style={s.sendText}>Send</Text></Pressable>
        </View>

        <ProposalSheet context={proposal} onClose={() => setProposal(null)} onSubmitted={() => void loadThreads()} />
        <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <Pressable style={s.lightbox} onPress={() => setLightbox(null)}>
            {!!lightbox && <Image source={{ uri: lightbox.url }} style={s.lightboxImage} resizeMode="contain" />}
            <Text style={s.lightboxTitle}>{lightbox?.title}</Text>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={s.flex}>
      <View style={s.listHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.title}>Messages</Text>
          {totalUnread > 0 && <View style={s.unreadPill}><Text style={s.unreadPillText}>{totalUnread} Unread</Text></View>}
        </View>
        <Text style={s.sub}>Real-time messages from clients who shortlisted you for their project.</Text>
        <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search conversations..." placeholderTextColor="#98a59f" />
        {!!error && <ErrorText>{error}</ErrorText>}
      </View>
      {threads.length === 0 && !error ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptyCopy}>When a client shortlists you for their project and starts a conversation, it will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}
          ListEmptyComponent={<Text style={s.emptyCopy}>No conversations match search</Text>}
          renderItem={({ item }) => {
            const last = item.messages[item.messages.length - 1];
            return (
              <Pressable style={s.thread} onPress={() => setOpenId(item.id)}>
                <View style={s.avatar}>{item.clientAvatar ? <Image source={{ uri: item.clientAvatar }} style={s.avatarImg} /> : <Text style={s.avatarText}>{item.clientName.slice(0, 2).toUpperCase()}</Text>}</View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.threadName} numberOfLines={1}>{item.clientName}</Text>
                    <Text style={s.time}>{relative(item.updatedAt)}</Text>
                  </View>
                  <Text style={s.chip} numberOfLines={1}>{[item.projectTitle, item.location].filter(Boolean).join(' • ')}</Text>
                  <Text style={s.preview} numberOfLines={1}>{last ? last.text : 'No messages yet.'}</Text>
                </View>
                {item.unreadCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{item.unreadCount}</Text></View>}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  listHead: { padding: 16, gap: 8 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5 },
  unreadPill: { backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  unreadPillText: { color: c.greenText, fontSize: 11, fontWeight: '800' },
  search: { height: 46, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14 },
  emptyTitle: { color: c.ink, fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingVertical: 14 },
  thread: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 13 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: c.green, fontSize: 14, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  threadName: { flex: 1, color: c.ink, fontSize: 15, fontWeight: '800' },
  time: { color: c.muted, fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  chip: { color: c.greenText, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  preview: { color: c.body, fontSize: 12.5, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  back: { color: c.ink, fontSize: 24 },
  threadSub: { color: c.body, fontSize: 11.5, marginTop: 1 },
  status: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  messages: { padding: 14, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 11, gap: 4 },
  mine: { backgroundColor: c.green, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 4 },
  sender: { color: c.greenText, fontSize: 10.5, fontWeight: '800' },
  text: { color: c.ink, fontSize: 14, lineHeight: 20 },
  file: { color: c.green, fontSize: 13, fontWeight: '800' },
  attachImage: { width: 200, height: 150, borderRadius: 10, backgroundColor: '#eef1ef' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  attach: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  attachText: { fontSize: 20 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderRadius: 14, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 12, paddingVertical: 10, color: c.ink, fontSize: 14.5 },
  send: { height: 44, borderRadius: 13, backgroundColor: c.green, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  lightboxImage: { width: '100%', height: '78%' },
  lightboxTitle: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
});
