import { Badge } from '../ui';
import { humanize, toneForStatus } from '../../lib/marketplace/format';

/** Status text with a colour chosen from its meaning (new = amber, quoted = blue, won = green, lost = red). */
export function StatusBadge({ status, label }: { status: unknown; label?: string }) {
  return <Badge label={label ?? humanize(status)} tone={toneForStatus(status)} />;
}
