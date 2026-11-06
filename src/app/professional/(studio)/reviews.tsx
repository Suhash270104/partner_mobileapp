import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';

interface Review {
  _id?: string;
  id?: string;
  clientName?: string;
  isVerified?: boolean;
  projectTitle?: string;
  projectType?: string;
  rating: number;
  createdAt?: string;
  comment?: string;
  tags?: string[];
  studioResponse?: string;
}

interface ReviewList { reviews?: Review[]; avgRating?: number | null }

const stars = (rating: number) => '★'.repeat(Math.floor(rating)) + '☆'.repeat(Math.max(0, 5 - Math.floor(rating)));

export default function ReviewsScreen() {
  const { profile, studioName } = useStudio();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState('');
  const [postingId, setPostingId] = useState('');
  const studioId = profile._id || '';

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      let result: ReviewList | null = null;
      // Same order as desktop: the studio's public reviews first, then the authenticated list.
      if (studioId) {
        try {
          const pub = await partnerApi.call<ReviewList>(`/reviews/designer/${studioId}`);
          if (pub.reviews?.length) result = pub;
        } catch { /* fall through to the authenticated list */ }
      }
      if (!result) {
        try {
          const mine = await partnerApi.call<ReviewList>('/reviews/my');
          if (mine.reviews?.length) result = mine;
        } catch { /* nothing more to try */ }
      }
      if (result?.reviews?.length) {
        setReviews(result.reviews);
        setAvg(result.avgRating != null ? result.avgRating : result.reviews[0].rating);
      } else {
        setReviews([]);
        setAvg(null);
      }
    } catch (e) {
      setReviews([]);
      setError(e instanceof Error ? e.message : 'Could not load your reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studioId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function respond(reviewId: string) {
    const text = (replies[reviewId] || '').trim();
    if (!text) return;
    setPostingId(reviewId);
    setError('');
    try {
      await partnerApi.call(`/reviews/${reviewId}/respond`, 'PUT', { response: text });
      setReviews(previous => previous.map(review => ((review._id || review.id) === reviewId ? { ...review, studioResponse: text } : review)));
      setReplyingId('');
      setReplies(previous => ({ ...previous, [reviewId]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post your response.');
    } finally {
      setPostingId('');
    }
  }

  const rating = avg ?? (reviews.length ? reviews[0].rating : 0);
  const breakdown = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(review => Math.round(review.rating) === star).length;
    return { star, count, pct: reviews.length ? Math.round((count / reviews.length) * 100) : 0 };
  });

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Reviews</Text>
      <Text style={s.sub}>{reviews.length} verified client review{reviews.length === 1 ? '' : 's'} for {studioName || 'your studio'}</Text>
      {!!error && <ErrorText>{error}</ErrorText>}
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />}

      {reviews.length > 0 && (
        <View style={s.summary}>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.score}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
            <Text style={s.stars}>{stars(Math.round(rating))}</Text>
            <Text style={s.meta}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {breakdown.map(row => (
              <View key={row.star} style={s.breakRow}>
                <Text style={s.breakStar}>{row.star}</Text>
                <View style={s.track}><View style={[s.fill, { width: `${row.pct}%` }]} /></View>
                <Text style={s.breakCount}>{row.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!loading && reviews.length === 0 && !error && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No Client Reviews Yet</Text>
          <Text style={s.emptyCopy}>Reviews from clients you have worked with will appear here.</Text>
        </View>
      )}

      {reviews.map(review => {
        const id = String(review._id || review.id);
        return (
          <View key={id} style={s.card}>
            <View style={s.head}>
              <View style={s.avatar}><Text style={s.avatarText}>{(review.clientName || 'C')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{review.clientName || 'Homeowner'}{review.isVerified ? '  ✓ Verified' : ''}</Text>
                <Text style={s.meta} numberOfLines={1}>{[review.projectTitle, review.projectType].filter(Boolean).join(' • ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.stars}>{stars(review.rating)}</Text>
                <Text style={s.meta}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</Text>
              </View>
            </View>
            {!!review.comment && <Text style={s.comment}>“{review.comment}”</Text>}
            {!!review.tags?.length && <View style={s.tags}>{review.tags.map(tag => <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>)}</View>}

            {review.studioResponse ? (
              <View style={s.response}>
                <Text style={s.responseLabel}>STUDIO RESPONSE — {studioName}</Text>
                <Text style={s.responseText}>{review.studioResponse}</Text>
              </View>
            ) : replyingId === id ? (
              <View style={{ gap: 8 }}>
                <TextInput style={s.reply} value={replies[id] || ''} onChangeText={value => setReplies(previous => ({ ...previous, [id]: value }))} placeholder="Write your professional response..." placeholderTextColor="#98a59f" multiline />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable style={s.outline} onPress={() => setReplyingId('')} disabled={postingId === id}><Text style={s.outlineText}>Cancel</Text></Pressable>
                  <Pressable style={[s.solid, (!(replies[id] || '').trim() || postingId === id) && { opacity: 0.5 }]} disabled={!(replies[id] || '').trim() || postingId === id} onPress={() => void respond(id)}>
                    <Text style={s.solidText}>{postingId === id ? 'Posting...' : 'Post Response'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={s.outline} onPress={() => setReplyingId(id)}><Text style={s.outlineText}>Respond to this Review</Text></Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13 },
  summary: { flexDirection: 'row', gap: 18, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16, alignItems: 'center' },
  score: { color: c.ink, fontSize: 38, fontWeight: '800' },
  stars: { color: '#c79a2c', fontSize: 14, letterSpacing: 1 },
  meta: { color: c.muted, fontSize: 11.5 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakStar: { color: c.body, fontSize: 12, width: 12 },
  breakCount: { color: c.muted, fontSize: 12, width: 22, textAlign: 'right' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e6ebe8', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#c79a2c' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  name: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  comment: { color: c.ink, fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: c.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: c.greenText, fontSize: 11, fontWeight: '700' },
  response: { backgroundColor: '#f1f5f3', borderRadius: 13, padding: 12, gap: 4 },
  responseLabel: { color: c.greenText, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  responseText: { color: c.body, fontSize: 13, lineHeight: 19 },
  reply: { minHeight: 90, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, padding: 12, color: c.ink, fontSize: 14, textAlignVertical: 'top' },
  solid: { flex: 1.4, height: 44, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  outline: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 13.5, fontWeight: '800' },
});
