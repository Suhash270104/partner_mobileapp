import { useState } from 'react';
import { View } from 'react-native';
import { RatingBreakdown } from '../../../components/marketplace/RatingBreakdown';
import { ReviewCard } from '../../../components/marketplace/ReviewCard';
import { EmptyState, FilterChips, LoadMoreButton, Screen } from '../../../components/ui';
import { usePagedList } from '../../../hooks/usePagedList';
import { merchantApi } from '../../../lib/marketplace/api';
import { LIMITS } from '../../../lib/marketplace/constants';
import type { ListResponse, Review } from '../../../lib/marketplace/types';

const FILTERS = [{ value: '', label: 'All' }, ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} ★` }))];

export default function ReviewsScreen() {
  const [rating, setRating] = useState('');
  const list = usePagedList<Review, ListResponse<Review> & { stats?: { average?: number; count?: number; breakdown?: Record<string, number> } }>(
    page => merchantApi.reviews({ rating: rating || undefined, page, limit: LIMITS.listPageSize }), review => String(review._id ?? ''), [rating]);

  const stats = list.data?.stats;
  return <Screen title="Ratings & reviews" subtitle="What buyers say about your store" refreshing={list.refreshing} onRefresh={() => void list.refresh()}
    loading={list.loading && !list.data} error={list.error && !list.data ? list.error : ''} onRetry={() => void list.reload()}>
    <RatingBreakdown average={stats?.average} count={stats?.count} breakdown={stats?.breakdown} />
    <FilterChips options={FILTERS} value={rating} onChange={setRating} />
    {list.items.length ? <View style={{ gap: 12 }}>
      {list.items.map((review, index) => <ReviewCard key={review._id ?? index} review={review} />)}
      <LoadMoreButton shown={list.items.length} total={list.total} loading={list.loadingMore} onPress={() => void list.loadMore()} />
    </View> : <EmptyState icon="star" title={rating ? `No ${rating}-star reviews` : 'No reviews yet'} message="Reviews from buyers appear here after they work with you." />}
  </Screen>;
}
