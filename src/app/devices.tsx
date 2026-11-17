import { router } from 'expo-router';
import { Badge, EmptyState, PillButton, Screen, SectionCard, Text, palette } from '../components/ui';
import { confirmAction, useAction } from '../hooks/useAction';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDateTime } from '../lib/marketplace/format';
import { PartnerDevice, partnerApi } from '../lib/partnerApi';
import { getDeviceId } from '../lib/sessionTokens';

/** Where the person is signed in. Any device can be signed out remotely; "sign out everywhere" ends every session. */
export default function DevicesScreen() {
  const { run, isBusy } = useAction();
  const { data, loading, error, reload, refresh, refreshing } = useAsyncData(async () => {
    const [{ sessions }, thisDevice] = await Promise.all([partnerApi.devices(), getDeviceId()]);
    return { sessions, thisDevice };
  }, [], { refetchOnFocus: true });

  const label = (device: PartnerDevice) => (device.userAgent ? device.userAgent.split(/[;)]/)[0].replace(/^Mozilla\/5\.0 \(?/, '') : 'Unknown device');

  const revoke = async (device: PartnerDevice) => {
    if (!(await confirmAction('Sign out this device?', 'It will need to sign in again.', 'Sign out'))) return;
    void run(`d:${device.sessionId}`, async () => { await partnerApi.revokeDevice(device.sessionId); await refresh(); });
  };
  const everywhere = async () => {
    if (!(await confirmAction('Sign out everywhere?', 'Every device, including this one, will be signed out.', 'Sign out everywhere'))) return;
    void run('all', async () => { await partnerApi.logoutEverywhere(); router.replace('/' as never); });
  };

  return <Screen standalone title="Signed-in devices" subtitle="You stay signed in for up to 30 days without opening the app, and at most 90 days in total." onBack={() => router.back()}
    loading={loading && !data} error={error && !data ? error : ''} onRetry={() => void reload()} refreshing={refreshing} onRefresh={() => void refresh()}>
    <SectionCard title={`Devices · ${data?.sessions.length ?? 0}`}>
      {data?.sessions.length ? data.sessions.map(device => {
        const mine = !!data.thisDevice && device.deviceId === data.thisDevice;
        return <SectionDevice key={device.sessionId} title={label(device)} mine={mine} detail={`Last active ${formatDateTime(device.lastUsedAt)} · expires ${formatDateTime(device.expiresAt)}`}
          action={!mine ? <PillButton compact variant="danger" title="Sign out" loading={isBusy(`d:${device.sessionId}`)} onPress={() => void revoke(device)} /> : undefined} />;
      }) : <EmptyState icon="phone" title="No other sessions" />}
    </SectionCard>
    <PillButton variant="danger" icon="logOut" title="Sign out everywhere" loading={isBusy('all')} onPress={() => void everywhere()} />
  </Screen>;
}

function SectionDevice({ title, detail, mine, action }: { title: string; detail: string; mine: boolean; action?: React.ReactNode }) {
  return <>
    <Text style={{ color: palette.ink, fontSize: 14.5, fontWeight: '800', marginTop: 10 }} numberOfLines={2}>{title}</Text>
    <Text style={{ color: palette.muted, fontSize: 11.5, lineHeight: 16, marginBottom: 6 }}>{detail}</Text>
    {mine ? <Badge label="This device" tone="green" /> : action}
  </>;
}
