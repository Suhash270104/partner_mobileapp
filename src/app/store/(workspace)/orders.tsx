import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CourierSheet } from '../../../components/marketplace/fulfilment/CourierSheet';
import { FulfilmentCard } from '../../../components/marketplace/fulfilment/FulfilmentCard';
import { ReasonSheet } from '../../../components/marketplace/fulfilment/ReasonSheet';
import { EmptyState, FilterChips, Screen } from '../../../components/ui';
import { useAction } from '../../../hooks/useAction';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { merchantApi } from '../../../lib/marketplace/api';
import { LIMITS, ORDER_TABS } from '../../../lib/marketplace/constants';
import { FulfilmentStep, ORDER_STEPS, RETURN_STEPS } from '../../../lib/marketplace/fulfilment';
import { formatDateTime, formatMoney, humanize } from '../../../lib/marketplace/format';
import type { Order, ReturnRequest } from '../../../lib/marketplace/types';

type Pending = { kind: 'order' | 'return'; id: string; step: FulfilmentStep } | null;

/** Earlier orders and their returns. Checkout is retired, so no new orders arrive; existing ones can still be fulfilled (hand-off §10). */
export default function OrdersScreen() {
  const { run, isBusy } = useAction();
  const [section, setSection] = useState<'orders' | 'returns'>('orders');
  const [tab, setTab] = useState('ALL');
  const [pending, setPending] = useState<Pending>(null);

  const orders = useAsyncData(() => merchantApi.orders({ tab, limit: LIMITS.listMaxPageSize }), [tab], { refetchOnFocus: true });
  const returns = useAsyncData(() => merchantApi.returns({ limit: LIMITS.listMaxPageSize }), [], { refetchOnFocus: true });
  const current = section === 'orders' ? orders : returns;

  const apply = async (kind: 'order' | 'return', id: string, input: Record<string, unknown>) => {
    await (kind === 'order' ? merchantApi.updateOrder(id, input) : merchantApi.updateReturn(id, input));
    await (kind === 'order' ? orders.refresh() : returns.refresh());
  };

  const start = (kind: 'order' | 'return', id: string, step: FulfilmentStep) => {
    if (step.needs) { setPending({ kind, id, step }); return; }
    void run(`${kind}:${id}`, () => apply(kind, id, { status: step.to }));
  };

  const reasonKey = (kind: 'order' | 'return') => (kind === 'order' ? 'cancellationReason' : 'rejectionNote');

  return <Screen title="Orders & fulfilment" subtitle="Earlier orders and their returns" onBack={() => router.back()} refreshing={current.refreshing} onRefresh={() => void current.refresh()}
    loading={current.loading && !current.data} error={current.error && !current.data ? current.error : ''} onRetry={() => void current.reload()}>
    <FilterChips options={[{ value: 'orders', label: 'Orders' }, { value: 'returns', label: 'Returns' }]} value={section} onChange={value => setSection(value as 'orders' | 'returns')} />
    {section === 'orders' ? <>
      <FilterChips options={ORDER_TABS.map(value => ({ value, label: value === 'ALL' ? 'All' : humanize(value) }))} value={tab} onChange={setTab} />
      {orders.data?.items.length ? <View style={{ gap: 12 }}>{orders.data.items.map((order: Order) => <FulfilmentCard key={order._id} title={order.orderNumber ?? 'Order'} subtitle={formatDateTime(order.createdAt)} status={order.status}
        rows={[{ label: 'Total', value: formatMoney(order.pricing?.grandTotal) }, { label: 'Ship to', value: [order.shippingAddress?.fullName, order.shippingAddress?.city].filter(Boolean).join(', ') }]}
        steps={ORDER_STEPS[order.status] ?? []} busy={isBusy(`order:${order._id}`)} onStep={step => start('order', order._id, step)} />)}</View>
        : <EmptyState icon="clipboard" title="No orders" message="This store has no orders in this view. The marketplace now works on enquiries." />}
    </> : returns.data?.items.length ? <View style={{ gap: 12 }}>{returns.data.items.map((item: ReturnRequest) => <FulfilmentCard key={item._id} title={item.orderNumber ?? 'Return request'} subtitle={humanize(item.reason)} status={item.status}
      rows={[{ label: 'Note', value: item.reasonNote }]} steps={RETURN_STEPS[item.status] ?? []} busy={isBusy(`return:${item._id}`)} onStep={step => start('return', item._id, step)} />)}</View>
      : <EmptyState icon="inbox" title="No returns" message="Return requests appear here." />}

    <CourierSheet visible={pending?.step.needs === 'courier'} title={pending?.step.label ?? ''} confirmLabel={pending?.step.label ?? 'Confirm'} onClose={() => setPending(null)}
      onConfirm={input => apply(pending!.kind, pending!.id, { status: pending!.step.to, ...input })} />
    <ReasonSheet visible={pending?.step.needs === 'reason'} title={pending?.step.label ?? ''} confirmLabel={pending?.step.label ?? 'Confirm'} onClose={() => setPending(null)}
      onConfirm={reason => apply(pending!.kind, pending!.id, { status: pending!.step.to, [reasonKey(pending!.kind)]: reason })} />
  </Screen>;
}
