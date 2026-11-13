import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { BooleanField, Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { merchantApi } from '../../lib/partnerVerticalApi';
import { partnerApi } from '../../lib/partnerApi';

const tabs = [{ key: 'overview', label: 'Home', icon: '⌂' }, { key: 'products', label: 'Products', icon: '▦' }, { key: 'leads', label: 'Enquiries', icon: '◎' }, { key: 'orders', label: 'Orders', icon: '▤' }, { key: 'settings', label: 'More', icon: '•••' }];
const businessTypes = ['manufacturer', 'distributor', 'wholesaler', 'dealer', 'retailer', 'fabricator', 'importer', 'service_provider'];
const legalStatuses = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'huf', 'other'];
const employeeRanges = ['1-10', '11-50', '51-200', '201-500', '500+'];
const fulfilledRanges = ['Under 100', '100–500', '500–2,000', '2,000–10,000', '10,000+'];
const capabilities = ['bulk_supply', 'custom_orders', 'installation', 'pan_india_delivery', 'export', 'samples', 'credit_terms'];
const blank = { storeName: '', businessName: '', businessId: '', businessType: 'manufacturer', legalStatus: 'proprietorship', yearEstablished: '', employeeCount: '1-10', ordersFulfilled: 'Under 100', description: '', phone: '', whatsappNumber: '', email: '', streetAddress: '', locality: '', city: '', state: '', pinCode: '', openTime: '09:00', closeTime: '18:00', isOpenSundays: false, accountNumber: '', ifscCode: '', beneficiaryName: '', bankName: '', serviceAreas: '', certifications: '', capabilities: [] as string[] };

export default function StoreRegister() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const set = (key: keyof typeof blank) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  useEffect(() => {
    let alive = true;
    Promise.all([merchantApi.status(), partnerApi.call<Record<string, any>>('/marketplace/shop/home')]).then(([status, home]) => {
      if (!alive) return;
      if (status.canAccessDashboard) { router.replace('/store/dashboard' as never); return; }
      if (status.isMerchant) {
        setBlocked(true);
        const merchant = status.merchant as Record<string, unknown> | null;
        setError(merchant?.approvalStatus === 'pending' ? 'Your store application is awaiting Kraftnex review.' : merchant?.approvalStatus === 'suspended' ? 'Your store is suspended. Contact Kraftnex support if you need help.' : String(status.accessBlockedReason || 'Your current store account cannot register another store.'));
      } else if (!status.phoneVerified) {
        setBlocked(true);
        setError('Verify your Kraftnex phone number before opening a store. Sign in or create an account with a verified mobile number.');
      }
      const list = home.categories || home.data?.categories || [];
      setCategories(list.map((category: any) => String(category.name || category.category || '')).filter(Boolean));
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not check store eligibility.'); });
    return () => { alive = false; };
  }, []);
  const submit = async () => {
    const numericYear = Number(form.yearEstablished);
    if (form.storeName.trim().length < 2 || form.businessName.trim().length < 2 || !form.businessId.trim() || !selected.length || !form.phone.trim() || !form.streetAddress.trim() || !form.city.trim() || !form.state.trim() || !/^\d{6}$/.test(form.pinCode) || !/^\d{9,18}$/.test(form.accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifscCode) || !form.beneficiaryName.trim() || !form.bankName.trim() || numericYear < 1900 || numericYear > new Date().getFullYear()) {
      setError('Complete the required business, contact, address and payout fields before creating your store.'); return;
    }
    setBusy(true); setError('');
    try {
      await merchantApi.register({
        storeName: form.storeName.trim(), businessName: form.businessName.trim(), businessId: form.businessId.trim().toUpperCase(), businessType: form.businessType,
        legalStatus: form.legalStatus, yearEstablished: numericYear, employeeCount: form.employeeCount, ordersFulfilled: form.ordersFulfilled,
        description: form.description.trim(), phone: form.phone.trim(), whatsappNumber: (form.whatsappNumber || form.phone).trim(), email: form.email.trim() || undefined,
        address: { streetAddress: form.streetAddress.trim(), locality: form.locality.trim(), city: form.city.trim(), state: form.state.trim(), pinCode: form.pinCode, country: 'India' },
        businessCategories: selected, capabilities: form.capabilities, serviceAreas: form.serviceAreas.split(',').map(v => v.trim()).filter(Boolean), certifications: form.certifications.split(',').map(v => v.trim()).filter(Boolean),
        operatingHours: { openTime: form.openTime, closeTime: form.closeTime, isOpenSundays: form.isOpenSundays },
        bankDetails: { accountNumber: form.accountNumber, ifscCode: form.ifscCode.toUpperCase(), beneficiaryName: form.beneficiaryName.trim(), bankName: form.bankName.trim() },
      });
      router.replace('/store/dashboard' as never);
    } catch (e) { setError(e instanceof Error ? e.message : 'The server could not create the store.'); }
    finally { setBusy(false); }
  };
  return <VerticalFrame title="Open your store" subtitle={`Step ${step + 1} of 4`} tabs={tabs} activeTab="settings" onTab={() => {}} onBack={step > 0 ? () => setStep(step - 1) : undefined}>
    <PageHeading eyebrow="MARKETPLACE SELLER" title={['Store & business', 'Address & contact', 'Categories & operations', 'Bank & payout'][step]} subtitle="Store setup uses your verified Kraftnex account and marketplace catalogue." />
    {error && blocked ? <><StatePanel title={error.includes('awaiting') ? 'Store under review' : 'Store setup unavailable'} message={error} />{error.includes('Verify') ? <PrimaryButton title="Sign in or verify mobile" onPress={() => router.push('/signup' as never)} /> : null}</> : error ? <StatePanel title="Store setup" message={error} /> : null}
    {!blocked ? <>
    {step === 0 && <Panel>
      <Field label="Store name" value={form.storeName} onChangeText={set('storeName')} />
      <Field label="Registered business name" value={form.businessName} onChangeText={set('businessName')} />
      <Field label="GSTIN, business PAN or trade license" value={form.businessId} onChangeText={set('businessId')} />
      <Field label="About your store" value={form.description} onChangeText={set('description')} multiline />
      <SelectChips label="Business type" values={businessTypes} selected={form.businessType} onChange={v => set('businessType')(String(v))} />
      <SelectChips label="Legal status" values={legalStatuses} selected={form.legalStatus} onChange={v => set('legalStatus')(String(v))} />
      <Field label="Year established" value={form.yearEstablished} onChangeText={set('yearEstablished')} keyboardType="numeric" />
      <SelectChips label="Team size" values={employeeRanges} selected={form.employeeCount} onChange={v => set('employeeCount')(String(v))} />
      <SelectChips label="Orders fulfilled to date" values={fulfilledRanges} selected={form.ordersFulfilled} onChange={v => set('ordersFulfilled')(String(v))} />
    </Panel>}
    {step === 1 && <Panel>
      <Field label="Business phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="WhatsApp number (optional)" value={form.whatsappNumber} onChangeText={set('whatsappNumber')} keyboardType="phone-pad" />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
      <Field label="Street address" value={form.streetAddress} onChangeText={set('streetAddress')} />
      <Field label="Locality" value={form.locality} onChangeText={set('locality')} />
      <Field label="City" value={form.city} onChangeText={set('city')} />
      <Field label="State" value={form.state} onChangeText={set('state')} />
      <Field label="PIN code" value={form.pinCode} onChangeText={set('pinCode')} keyboardType="numeric" />
    </Panel>}
    {step === 2 && <Panel>
      {categories.length ? <SelectChips label="Categories you supply" values={categories} selected={selected} multi onChange={value => setSelected(value as string[])} /> : <Text style={{ color: '#b3392f' }}>Marketplace categories could not be loaded. Retry after reconnecting.</Text>}
      <SelectChips label="Capabilities" values={capabilities} selected={form.capabilities} multi onChange={value => setForm(prev => ({ ...prev, capabilities: value as string[] }))} />
      <Field label="Service areas (comma separated)" value={form.serviceAreas} onChangeText={set('serviceAreas')} />
      <Field label="Certifications (comma separated)" value={form.certifications} onChangeText={set('certifications')} />
      <Field label="Opening time (HH:MM)" value={form.openTime} onChangeText={set('openTime')} />
      <Field label="Closing time (HH:MM)" value={form.closeTime} onChangeText={set('closeTime')} />
      <BooleanField label="Open Sundays" value={form.isOpenSundays} onChange={value => setForm(prev => ({ ...prev, isOpenSundays: value }))} />
    </Panel>}
    {step === 3 && <Panel>
      <Field label="Bank account number" value={form.accountNumber} onChangeText={set('accountNumber')} secureTextEntry keyboardType="numeric" />
      <Field label="IFSC" value={form.ifscCode} onChangeText={set('ifscCode')} />
      <Field label="Beneficiary name" value={form.beneficiaryName} onChangeText={set('beneficiaryName')} />
      <Field label="Bank name" value={form.bankName} onChangeText={set('bankName')} />
      <Text style={{ color: '#7b8a83', fontSize: 12 }}>Your payout information is submitted directly to the store registration endpoint.</Text>
    </Panel>}
    {step < 3 ? <PrimaryButton title="Continue" onPress={() => { setError(''); setStep(step + 1); }} /> : <PrimaryButton title="Create store" loading={busy} onPress={() => void submit()} />}
    {step > 0 ? <PrimaryButton title="Previous step" onPress={() => setStep(step - 1)} /> : null}
    </> : null}
  </VerticalFrame>;
}
