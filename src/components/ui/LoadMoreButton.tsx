import { PillButton } from '../realtor/RealtorControls';

/** "Load more (20 of 64)" footer for paginated lists; renders nothing once everything is loaded. */
export function LoadMoreButton({ shown, total, loading, onPress }: { shown: number; total: number; loading: boolean; onPress: () => void }) {
  if (shown >= total) return null;
  return <PillButton title={`Load more (${shown} of ${total})`} variant="soft" loading={loading} onPress={onPress} />;
}
