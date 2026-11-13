import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { BooleanField, DataRow, Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { merchantApi } from '../../lib/partnerVerticalApi';

type Section = 'overview' | 'products' | 'leads' | 'orders' | 'returns' | 'offers' | 'reviews' | 'questions' | 'staff' | 'settings';
const sections: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Home', icon: '⌂' }, { key: 'products', label: 'Products', icon: '▦' },
  { key: 'leads', label: 'Enquiries', icon: '◎' }, { key: 'orders', label: 'Orders', icon: '▤' }, { key: 'settings', label: 'More', icon: '•••' },
];
const featureSections: { key: Section; label: string }[] = [
  { key: 'returns', label: 'Returns & refunds' }, { key: 'offers', label: 'Offers & promotions' }, { key: 'reviews', label: 'Reviews' }, { key: 'questions', label: 'Enquiry questions' }, { key: 'staff', label: 'Staff' }, { key: 'settings', label: 'Store settings' },
];
type Row = Record<string, any>;
const getRows = (data: any): Row[] => {
  if (Array.isArray(data)) return data.filter(v => v && typeof v === 'object');
  if (!data || typeof data !== 'object') return [];
  for (const key of ['products', 'leads', 'orders', 'returns', 'promoCodes', 'flashSales', 'reviews', 'items', 'data']) if (Array.isArray(data[key])) return data[key];
  return [];
};
const idOf = (x: Row) => String(x._id ?? x.id ?? '');
const display = (x: Row) => String(x.title || x.storeName || x.name || x.productName || x.customerName || x.orderNumber || x.code || x._id || 'Marketplace item');
const desc = (x: Row) => [x.sku, x.city, x.status, x.category, x.customer?.name, x.buyer?.name].filter(Boolean).join(' · ');
const human = (value: string) => value.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export default function StoreDashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [data, setData] = useState<any>(null);
  const [store, setStore] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      if (section === 'overview') {
        const [metrics, profile] = await Promise.all([merchantApi.metrics(), merchantApi.store()]);
        setData(metrics); setStore((profile.merchant || profile) as Row);
      } else if (section === 'settings') {
        const profile = await merchantApi.store(); setData(profile); setStore((profile.merchant || profile) as Row);
      } else if (section === 'questions') {
        setData(await merchantApi.enquiryQuestions());
      } else if (section === 'staff') {
        setData(await merchantApi.store());
      } else {
        const response = section === 'products' ? await merchantApi.products({ page: 1, limit: 50, status: 'all' })
          : section === 'leads' ? await merchantApi.leads({ page: 1, limit: 50 })
          : section === 'orders' ? await merchantApi.orders({ page: 1, limit: 50 })
          : section === 'returns' ? await merchantApi.returns({ page: 1, limit: 50 })
          : section === 'offers' ? await Promise.all([merchantApi.promoCodes(), merchantApi.flashSales(), merchantApi.storeOffers()])
          : await merchantApi.reviews({ page: 1, limit: 50 });
        setData(response);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this section.'); }
    finally { setLoading(false); }
  }, [section]);
  // Load the selected seller workspace section from the API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const items = useMemo(() => section === 'offers' && Array.isArray(data) ? data.flatMap(getRows) : getRows(data), [data, section]);
  const saveAction = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try { await action(); await load(); }
    catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'The server rejected this change.'); }
    finally { setBusyId(''); }
  };
  const title = section === 'overview' ? 'Marketplace' : human(section);
  const updateField = (key: string, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const chooseSection = (key: string) => { setError(''); setLoading(true); setSection(key as Section); };
  const renderItem = (item: Row, index: number) => {
    const id = idOf(item) || `${index}`;
    if (section === 'products') return <Panel key={id}>
      <DataRow title={display(item)} detail={`${item.category || ''}${item.sku ? ` · ${item.sku}` : ''}`} status={item.status || (item.inStock === false ? 'out_of_stock' : undefined)} />
      <Text style={{ color: palette.body, fontSize: 13 }}>₹{item.sellingPrice ?? '—'} · {item.stockQuantity ?? '—'} in stock</Text>
      <Field label="Available quantity" value={draft[`stock:${id}`] ?? String(item.stockQuantity ?? '')} onChangeText={v => updateField(`stock:${id}`, v)} keyboardType="numeric" />
      <View style={{ gap: 8 }}><PrimaryButton title="Edit product" onPress={() => router.push({ pathname: '/store/product/edit', params: { id } } as never)} /><PrimaryButton title={item.inStock === false ? 'Mark in stock' : 'Update stock'} onPress={() => {
        const value = draft[`stock:${id}`] || String(item.stockQuantity ?? '');
        if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) { Alert.alert('Quantity required', 'Enter a valid stock quantity first.'); return; }
        void saveAction(id, () => merchantApi.setStock(id, { stockQuantity: Number(value), inStock: Number(value) > 0 }));
      }} /><PrimaryButton title="Clone product" loading={busyId === id} onPress={() => void saveAction(id, () => merchantApi.cloneProduct(id))} /><PrimaryButton title="Archive product" onPress={() => Alert.alert('Archive product?', 'This removes the product from your active catalogue.', [{ text: 'Keep product', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void saveAction(id, () => merchantApi.removeProduct(id)) }])} /></View>
    </Panel>;
    if (section === 'orders') return <Panel key={id}><DataRow title={display(item)} detail={desc(item)} status={item.status} />
      {item.status === 'placed' && <PrimaryButton title="Accept order" loading={busyId === id} onPress={() => void saveAction(id, () => merchantApi.updateOrder(id, { status: 'accepted' }))} />}
      {item.status === 'accepted' && <PrimaryButton title="Start preparation" loading={busyId === id} onPress={() => void saveAction(id, () => merchantApi.updateOrder(id, { status: 'in_preparation' }))} />}
      {['accepted', 'in_preparation'].includes(String(item.status)) && <><Field label="Courier partner" value={draft[`courier:${id}`] || ''} onChangeText={v => updateField(`courier:${id}`, v)} /><Field label="Tracking / AWB number" value={draft[`awb:${id}`] || ''} onChangeText={v => updateField(`awb:${id}`, v)} /><PrimaryButton title="Mark shipped" loading={busyId === id} onPress={() => void saveAction(id, () => merchantApi.updateOrder(id, { status: 'shipped', courierPartner: draft[`courier:${id}`], trackingNumber: draft[`awb:${id}`] }))} /></>}
      {['shipped', 'in_transit'].includes(String(item.status)) && <PrimaryButton title="Mark delivered" onPress={() => void saveAction(id, () => merchantApi.updateOrder(id, { status: 'delivered' }))} />}
      {item.status === 'placed' && <><Field label="Cancellation reason" value={draft[`cancel:${id}`] || ''} onChangeText={v => updateField(`cancel:${id}`, v)} /><PrimaryButton title="Cancel order" onPress={() => void saveAction(id, () => merchantApi.updateOrder(id, { status: 'cancelled', cancellationReason: draft[`cancel:${id}`] }))} /></>}</Panel>;
    if (section === 'returns') return <Panel key={id}><DataRow title={display(item)} detail={desc(item)} status={item.status} />
      {item.status === 'requested' && <><Field label="Decision note" value={draft[`return:${id}`] || ''} onChangeText={v => updateField(`return:${id}`, v)} /><View style={{ gap: 8 }}><PrimaryButton title="Approve return" onPress={() => void saveAction(id, () => merchantApi.updateReturn(id, { status: 'approved' }))} /><PrimaryButton title="Reject return" onPress={() => void saveAction(id, () => merchantApi.updateReturn(id, { status: 'rejected', rejectionNote: draft[`return:${id}`] }))} /></View></>}
      {String(item.status) === 'approved' && <><Field label="Courier partner" value={draft[`returnCourier:${id}`] || ''} onChangeText={v => updateField(`returnCourier:${id}`, v)} /><Field label="AWB number" value={draft[`returnAwb:${id}`] || ''} onChangeText={v => updateField(`returnAwb:${id}`, v)} /><PrimaryButton title="Schedule pickup" onPress={() => void saveAction(id, () => merchantApi.updateReturn(id, { status: 'pickup_scheduled', courierPartner: draft[`returnCourier:${id}`], awbNumber: draft[`returnAwb:${id}`] }))} /></>}
      {item.status === 'picked_up' && <PrimaryButton title="Complete return" onPress={() => void saveAction(id, () => merchantApi.updateReturn(id, { status: 'completed' }))} />}
      {String(item.status).includes('received') && <PrimaryButton title="Process refund" onPress={() => void saveAction(id, () => merchantApi.updateReturn(id, { status: 'refunded' }))} />}</Panel>;
    if (section === 'leads') return <Panel key={id}><DataRow title={display(item)} detail={desc(item)} status={item.status} />
      <Field label="Reply / internal note" value={draft[`lead:${id}`] || ''} onChangeText={v => updateField(`lead:${id}`, v)} multiline />
      <PrimaryButton title="Mark responded" onPress={() => void saveAction(id, () => merchantApi.updateLead(id, { status: 'responded', notes: draft[`lead:${id}`] }))} />
      <Field label="Quotation total" value={draft[`quote:${id}`] || ''} onChangeText={v => updateField(`quote:${id}`, v)} keyboardType="decimal-pad" />
      <Field label="Quotation details" value={draft[`quoteNote:${id}`] || ''} onChangeText={v => updateField(`quoteNote:${id}`, v)} multiline />
      <PrimaryButton title="Send quotation" onPress={() => {
        const unitPrice = Number(draft[`quote:${id}`]);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) { Alert.alert('Quotation price required', 'Enter a valid unit price before sending a quotation.'); return; }
        void saveAction(id, () => merchantApi.sendQuotation(id, { unitPrice, quantity: Number(item.quantity) || null, totalAmount: Number(item.quantity) ? unitPrice * Number(item.quantity) : null, notes: draft[`quoteNote:${id}`] || '' }));
      }} />
    </Panel>;
    if (section === 'offers') return <Panel key={id}><DataRow title={display(item)} detail={desc(item)} status={item.status || (item.isActive ? 'active' : undefined)} />{item.code ? <Text style={{ color: palette.body }}>Code: {item.code} · {item.discountValue ?? ''}</Text> : null}</Panel>;
    return <Panel key={id}><DataRow title={display(item)} detail={desc(item)} status={item.status} />{item.rating ? <Text style={{ color: palette.body }}>Rating: {item.rating}/5</Text> : null}</Panel>;
  };
  return <VerticalFrame title={title} subtitle={store?.storeName || 'Partner marketplace'} tabs={sections} activeTab={section} onTab={chooseSection}>
    <PageHeading eyebrow="SELLER WORKSPACE" title={title} subtitle={section === 'overview' ? 'Manage your catalogue, enquiries and store activity.' : undefined} />
    {section === 'overview' && <>
      <Panel tint><Text style={{ color: palette.green, fontWeight: '800', fontSize: 15 }}>{store?.storeName || 'Your store'}</Text><Text style={{ color: palette.body }}>Approval: {String(store?.approvalStatus || '—')} · Role: {String(data?.storeRole || '—')}</Text></Panel>
      {data && typeof data === 'object' && Object.entries(data.kpis || data.metrics || {}).filter(([, value]) => typeof value === 'string' || typeof value === 'number').map(([key, value]) => <Panel key={key}><Text style={{ color: palette.muted, fontSize: 12 }}>{human(key)}</Text><Text style={{ color: palette.ink, fontWeight: '800', fontSize: 22 }}>{String(value)}</Text></Panel>)}
      {typeof data?.pipelineValue === 'number' ? <Panel><Text style={{ color: palette.muted, fontSize: 12 }}>Pipeline value</Text><Text style={{ color: palette.ink, fontWeight: '800', fontSize: 22 }}>₹{data.pipelineValue}</Text></Panel> : null}
      <PrimaryButton title="Add product" onPress={() => router.push('/store/product/new' as never)} />
      <PrimaryButton title="Open store settings" onPress={() => setSection('settings')} />
    </>}
    {section === 'products' && <><PrimaryButton title="Add product" onPress={() => router.push('/store/product/new' as never)} /><PrimaryButton title="Bulk add or import CSV" onPress={() => router.push('/store/bulk' as never)} /></>}
    {section === 'settings' && <>
      <Panel><Text style={{ color: palette.ink, fontSize: 16, fontWeight: '800' }}>Store profile</Text>
        {['storeName', 'description', 'phone', 'whatsappNumber', 'email', 'streetAddress', 'locality', 'city', 'state', 'pinCode'].map(key => <Field key={key} label={human(key)} value={draft[key] ?? String(key === 'streetAddress' ? store?.address?.streetAddress || '' : key === 'city' ? store?.address?.city || '' : store?.[key] || '')} onChangeText={value => updateField(key, value)} multiline={key === 'description'} />)}
        <PrimaryButton title="Save store profile" onPress={() => void saveAction('store', () => merchantApi.saveStore({ ...Object.fromEntries(['storeName', 'description', 'phone', 'whatsappNumber', 'email'].map(k => [k, draft[k] ?? store?.[k]])), address: { ...store?.address, ...Object.fromEntries(['streetAddress', 'locality', 'city', 'state', 'pinCode'].map(k => [k, draft[k] ?? store?.address?.[k]])) } }))} />
      </Panel>
      <Panel><Text style={{ color: palette.ink, fontWeight: '800' }}>Alerts & opening hours</Text>
        <BooleanField label="Enquiry alerts by email" value={draft.alertEmail !== undefined ? draft.alertEmail === 'true' : store?.leadAlerts?.email !== false} onChange={v => updateField('alertEmail', String(v))} />
        <BooleanField label="Enquiry alerts by SMS" value={draft.alertSms !== undefined ? draft.alertSms === 'true' : store?.leadAlerts?.sms !== false} onChange={v => updateField('alertSms', String(v))} />
        <Field label="Opening time (HH:MM)" value={draft.openTime ?? store?.operatingHours?.openTime ?? ''} onChangeText={v => updateField('openTime', v)} />
        <Field label="Closing time (HH:MM)" value={draft.closeTime ?? store?.operatingHours?.closeTime ?? ''} onChangeText={v => updateField('closeTime', v)} />
        <BooleanField label="Open Sundays" value={draft.openSunday !== undefined ? draft.openSunday === 'true' : store?.operatingHours?.isOpenSundays === true} onChange={v => updateField('openSunday', String(v))} />
        <PrimaryButton title="Save alerts & hours" onPress={() => void saveAction('store-alerts', () => merchantApi.saveStore({ leadAlerts: { email: draft.alertEmail !== undefined ? draft.alertEmail === 'true' : store?.leadAlerts?.email !== false, sms: draft.alertSms !== undefined ? draft.alertSms === 'true' : store?.leadAlerts?.sms !== false }, operatingHours: { openTime: draft.openTime ?? store?.operatingHours?.openTime, closeTime: draft.closeTime ?? store?.operatingHours?.closeTime, isOpenSundays: draft.openSunday !== undefined ? draft.openSunday === 'true' : store?.operatingHours?.isOpenSundays === true } }))} />
      </Panel>
      <Panel><Text style={{ color: palette.ink, fontWeight: '800' }}>Business profile & payout</Text><Text style={{ color: palette.body }}>Bank details are managed by the store owner through the secure payout form.</Text><Field label="Account number" value={draft.accountNumber || ''} onChangeText={v => updateField('accountNumber', v)} secureTextEntry keyboardType="numeric" /><Field label="IFSC" value={draft.ifscCode || ''} onChangeText={v => updateField('ifscCode', v)} /><Field label="Beneficiary" value={draft.beneficiaryName || ''} onChangeText={v => updateField('beneficiaryName', v)} /><Field label="Bank" value={draft.bankName || ''} onChangeText={v => updateField('bankName', v)} /><PrimaryButton title="Save payout details" onPress={() => void saveAction('bank', () => merchantApi.saveBank({ accountNumber: draft.accountNumber, ifscCode: draft.ifscCode, beneficiaryName: draft.beneficiaryName, bankName: draft.bankName }))} /></Panel>
      {featureSections.map(item => item.key !== 'settings' && <PrimaryButton key={item.key} title={item.label} onPress={() => chooseSection(item.key)} />)}
      <PrimaryButton title="Sign out of store" onPress={() => void saveAction('logout', async () => { await merchantApi.signOut(); router.replace('/' as never); })} />
    </>}
    {featureSections.filter(item => item.key !== 'settings').map(item => item.key === section && <Panel key={item.key}><Text style={{ color: palette.ink, fontWeight: '800' }}>{item.label}</Text>
      {item.key === 'offers' && <>
        <Field label="Promo code" value={draft.code || ''} onChangeText={v => updateField('code', v.toUpperCase())} />
        <SelectChips label="Discount type" values={['percent', 'flat', 'free_shipping']} selected={draft.discountType || 'percent'} onChange={v => updateField('discountType', String(v))} />
        <Field label="Discount value" value={draft.discountValue || ''} onChangeText={v => updateField('discountValue', v)} keyboardType="decimal-pad" />
        <Field label="Minimum order value" value={draft.minOrderValue || '0'} onChangeText={v => updateField('minOrderValue', v)} keyboardType="decimal-pad" />
        <Field label="Expires at (ISO date/time)" value={draft.expiresAt || ''} onChangeText={v => updateField('expiresAt', v)} placeholder="2026-12-31T23:59:00Z" />
        <PrimaryButton title="Create promo code" onPress={() => void saveAction('promo', () => merchantApi.savePromo({ code: draft.code, discountType: draft.discountType || 'percent', discountValue: Number(draft.discountValue || 0), minOrderValue: Number(draft.minOrderValue || 0), expiresAt: draft.expiresAt || null, perUserLimit: 1, isPublic: true, isActive: true }))} />
        <Field label="Flash sale name" value={draft.saleName || ''} onChangeText={v => updateField('saleName', v)} />
        <Field label="Minimum discount (%)" value={draft.minimumDiscount || ''} onChangeText={v => updateField('minimumDiscount', v)} keyboardType="numeric" />
        <Field label="Start date/time (ISO)" value={draft.startDate || ''} onChangeText={v => updateField('startDate', v)} placeholder="2026-11-12T09:00:00Z" />
        <Field label="End date/time (ISO)" value={draft.endDate || ''} onChangeText={v => updateField('endDate', v)} placeholder="2026-11-15T18:00:00Z" />
        <PrimaryButton title="Create flash sale" onPress={() => void saveAction('sale', () => merchantApi.saveFlashSale({ name: draft.saleName, minimumDiscount: Number(draft.minimumDiscount), startDate: draft.startDate, endDate: draft.endDate }))} />
        <Field label="Showcase offer title" value={draft.offerTitle || ''} onChangeText={v => updateField('offerTitle', v)} />
        <Field label="Offer description" value={draft.offerDescription || ''} onChangeText={v => updateField('offerDescription', v)} multiline />
        <Field label="Banner image URL" value={draft.bannerImage || ''} onChangeText={v => updateField('bannerImage', v)} />
        <PrimaryButton title="Request marketplace showcase" onPress={() => void saveAction('offer', () => merchantApi.saveStoreOffer({ title: draft.offerTitle, description: draft.offerDescription, bannerImage: draft.bannerImage, displayOnMarketplace: true, discountType: 'percent', discountValue: Number(draft.discountValue || 0) }))} />
      </>}
      {item.key === 'questions' && <>
        <Text style={{ color: palette.body }}>These questions appear on your buyer enquiry form.</Text>
        {(data?.questions || []).map((question: Row, index: number) => <Field key={question._id || index} label={`Question ${index + 1}`} value={draft[`question:${index}`] ?? question.label ?? ''} onChangeText={v => updateField(`question:${index}`, v)} />)}
        <Field label="Add a question" value={draft.newQuestion || ''} onChangeText={v => updateField('newQuestion', v)} />
        <PrimaryButton title="Save enquiry form" onPress={() => {
          const questions = (data?.questions || []).map((q: Row, index: number) => ({ ...q, label: draft[`question:${index}`] ?? q.label })).filter((q: Row) => q.label?.trim());
          if (draft.newQuestion?.trim()) questions.push({ label: draft.newQuestion.trim(), type: 'text', required: false });
          void saveAction('questions', () => merchantApi.saveEnquiryQuestions(questions));
        }} />
      </>}
      {item.key === 'staff' && <>
        <Field label="Staff member name" value={draft.staffName || ''} onChangeText={v => updateField('staffName', v)} />
        <Field label="Verified Kraftnex mobile" value={draft.staffPhone || ''} onChangeText={v => updateField('staffPhone', v)} keyboardType="phone-pad" />
        <Field label="Email (optional)" value={draft.staffEmail || ''} onChangeText={v => updateField('staffEmail', v)} keyboardType="email-address" />
        <SelectChips label="Store role" values={['manager', 'inventory', 'fulfillment']} selected={draft.staffRole || 'manager'} onChange={v => updateField('staffRole', String(v))} />
        <PrimaryButton title="Invite staff" onPress={() => void saveAction('staff', () => merchantApi.inviteStaff({ fullName: draft.staffName, phone: draft.staffPhone, email: draft.staffEmail || undefined, role: draft.staffRole || 'manager' }))} />
        {(data?.staff || []).map((member: Row) => <Panel key={member.id || member._id}><DataRow title={member.fullName || member.name} detail={`${member.phone || ''} · ${member.role || ''}`} status={member.status} />
          <SelectChips label="Staff role" values={['manager', 'inventory', 'fulfillment']} selected={draft[`role:${member.id}`] || member.role || 'manager'} onChange={v => updateField(`role:${member.id}`, String(v))} />
          <View style={{ gap: 8 }}><PrimaryButton title="Save role" onPress={() => void saveAction(String(member.id), () => merchantApi.updateStaff(String(member.id), { role: draft[`role:${member.id}`] || member.role }))} />
            {member.status === 'suspended' ? <PrimaryButton title="Reactivate staff" onPress={() => void saveAction(String(member.id), () => merchantApi.updateStaff(String(member.id), { status: 'active' }))} /> : <PrimaryButton title="Suspend staff" onPress={() => void saveAction(String(member.id), () => merchantApi.updateStaff(String(member.id), { status: 'suspended' }))} />}
            <PrimaryButton title="Remove staff" onPress={() => void saveAction(String(member.id), () => merchantApi.removeStaff(String(member.id)))} /></View>
        </Panel>)}
      </>}
      {item.key === 'reviews' && <Text style={{ color: palette.body }}>Customer ratings and review content are loaded from your store account.</Text>}
      {item.key === 'returns' && <Text style={{ color: palette.body }}>Approve return requests, schedule pickups and process refunds from each request below.</Text>}
    </Panel>)}
    {error ? <StatePanel title="Marketplace data unavailable" message={error} retry={() => void load()} /> : loading ? <Panel><Text style={{ color: palette.body }}>Loading from the marketplace…</Text></Panel> : null}
    {!loading && !error && section !== 'overview' && section !== 'settings' && items.length === 0 && <StatePanel title="No records yet" message="The marketplace has no records for this section." />}
    {!loading && items.map(renderItem)}
  </VerticalFrame>;
}
