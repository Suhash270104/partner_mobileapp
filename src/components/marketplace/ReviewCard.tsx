import { StyleSheet, View } from 'react-native';
import { Icon, Text, palette } from '../ui';
import { formatDate } from '../../lib/marketplace/format';
import type { Review } from '../../lib/marketplace/types';

export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map(n => <Icon key={n} name="star" size={size} color={n <= Math.round(rating) ? '#e0a82e' : '#d5dcd8'} />)}
  </View>;
}

export function ReviewCard({ review }: { review: Review }) {
  return <View style={s.card}>
    <View style={s.top}><StarRow rating={Number(review.rating) || 0} /><Text style={s.date}>{formatDate(review.createdAt)}</Text></View>
    {review.comment ? <Text style={s.comment}>{review.comment}</Text> : null}
    <Text style={s.meta} numberOfLines={1}>{[review.buyerName, review.productId?.title].filter(Boolean).join(' · ')}</Text>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, date: { color: palette.muted, fontSize: 12 },
  comment: { color: palette.ink, fontSize: 14, lineHeight: 21 }, meta: { color: palette.muted, fontSize: 12 },
});
