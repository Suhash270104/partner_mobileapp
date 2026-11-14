import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '../../../components/AppText';
import { palette } from '../../../components/vertical/VerticalUi';
import { PillButton } from '../../../components/realtor/RealtorControls';
import { EmptyState } from '../../../components/realtor/RealtorUi';
import { PropertyWizard } from '../../../components/realtor/PropertyWizard';
import { realtorApi } from '../../../lib/partnerVerticalApi';

type Data = Record<string, any>;

export default function EditRealtorPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await realtorApi.properties('GET', undefined, String(id));
      setProperty((response.property && typeof response.property === 'object' ? response.property : response) as Data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this property.'); }
  }, [id]);
  // Pre-fill the form from the server on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (property) return <PropertyWizard mode="edit" propertyId={String(id)} initial={property} />;
  return <SafeAreaView style={s.safe}><View style={s.body}>
    {error ? <EmptyState icon="shield" title="Couldn’t load this property" message={error} actionLabel="Try again" onAction={() => void load()} /> : <Text style={s.loading}>Loading property…</Text>}
    <PillButton title="Back" variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/realtor/dashboard?tab=properties' as never)} />
  </View></SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.bg }, body: { flex: 1, padding: 18, justifyContent: 'center', gap: 14 }, loading: { color: palette.body, textAlign: 'center', fontSize: 15 } });
