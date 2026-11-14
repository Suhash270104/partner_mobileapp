import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { palette } from '../../../components/vertical/VerticalUi';
import { PillButton } from '../../../components/realtor/RealtorControls';
import { EmptyState } from '../../../components/realtor/RealtorUi';
import { ListingCreditsSheet } from '../../../components/realtor/ListingCreditsSheet';
import { PropertyWizard } from '../../../components/realtor/PropertyWizard';
import { realtorApi } from '../../../lib/partnerVerticalApi';

// Posting a property costs one listing credit, so the wizard only opens once the account has credits.
export default function NewRealtorPropertyScreen() {
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [creditsOpen, setCreditsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await realtorApi.profile();
      const realtor = (response.realtor && typeof response.realtor === 'object' ? response.realtor : response) as Record<string, unknown>;
      setCredits(Number(realtor.listingQuota ?? 0)); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check your listing credits.'); }
  }, []);
  // Check the credit balance on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const leave = () => router.canGoBack() ? router.back() : router.replace('/realtor/dashboard?tab=properties' as never);
  if (credits != null && credits > 0) return <>
    <PropertyWizard mode="create" onNeedCredits={() => { setCreditsOpen(true); }} />
    <ListingCreditsSheet visible={creditsOpen} reason="You need a listing credit to post a new property." onClose={() => setCreditsOpen(false)} onPurchased={() => void load()} />
  </>;
  return <SafeAreaView style={s.safe}>
    <View style={s.body}>
      {error ? <EmptyState icon="shield" title="Couldn’t check your credits" message={error} actionLabel="Try again" onAction={() => void load()} />
        : credits == null ? <Text style={s.loading}>Checking your listing credits…</Text>
          : <EmptyState icon="coins" title="0 Listing Credits Available" message="Each property or project you post uses one listing credit. Buy a pack to continue." actionLabel="Buy Listing Credits" onAction={() => setCreditsOpen(true)} />}
      <PillButton title="Back to properties" variant="ghost" onPress={leave} />
    </View>
    <ListingCreditsSheet visible={creditsOpen} reason="You need a listing credit to post a new property." onClose={() => setCreditsOpen(false)} onPurchased={() => void load()} />
  </SafeAreaView>;
}

const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.bg }, body: { flex: 1, padding: 18, justifyContent: 'center', gap: 14 }, loading: { color: palette.body, textAlign: 'center', fontSize: 15 } });
