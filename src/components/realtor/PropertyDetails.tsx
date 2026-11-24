import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { InfoRow } from '../ui/InfoRow';
import { Screen } from '../ui/Screen';
import { Panel, palette } from '../vertical/VerticalUi';
import { Badge } from './RealtorCards';
import { Data, areaLine, formatPriceShort, humanize, locationLine, priceOf, statusMeta } from './realtorFormat';
import { formFromProperty } from './PropertyWizard';
import { realtorApi } from '../../lib/partnerVerticalApi';

type DetailRow = [string, unknown];

function display(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(item => humanize(String(item))).filter(Boolean).join(', ') || undefined;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.includes('_') ? humanize(value) : value;
  return undefined;
}

function DetailsSection({ title, rows }: { title: string; rows: DetailRow[] }) {
  const visible = rows.filter(([, value]) => display(value) !== undefined);
  if (!visible.length) return null;
  return <Panel>
    <Text style={s.sectionTitle}>{title}</Text>
    {visible.map(([label, value]) => <InfoRow key={label} label={label} value={display(value)} />)}
  </Panel>;
}

function PropertyPhotos({ propertyId }: { propertyId: string }) {
  const [photos, setPhotos] = useState<Data[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await realtorApi.media.list('property', propertyId);
      setPhotos(Array.isArray(response.media) ? response.media as Data[] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load property photos.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // Loading photos is an external synchronization; the effect must start the async request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  return <Panel>
    <Text style={s.sectionTitle}>Photos</Text>
    {loading ? <ActivityIndicator color={palette.green} /> : error ? <>
      <Text style={s.muted}>{error}</Text>
      <Pressable onPress={() => void load(true)} accessibilityRole="button" style={s.retryButton}>
        <Text style={s.retry}>Try again</Text>
      </Pressable>
    </> : photos.length ? <View style={s.photos}>
      {photos.map((photo, index) => {
        const uri = photo.variants?.medium || photo.variants?.original || photo.variants?.thumbnail;
        return typeof uri === 'string' && uri ? <Image key={String(photo._id || index)} source={{ uri }} style={s.photo} resizeMode="cover" accessibilityLabel={`Property photo ${index + 1}`} /> : null;
      })}
    </View> : <Text style={s.muted}>No photos are available for this property.</Text>}
  </Panel>;
}

export function PropertyDetails({ property, onBack }: { property: Data; onBack: () => void }) {
  const form = formFromProperty(property);
  const listing: Data = property.listing && typeof property.listing === 'object' ? property.listing : {};
  const status = statusMeta(listing.status || 'archived');
  const rows: { title: string; values: DetailRow[] }[] = [
    { title: 'Property details', values: [
      ['Property type', humanize(property.propertyType)],
      ['Listing purpose', humanize(property.listingPurpose)],
      ['Transaction type', humanize(property.transactionType)],
      ['Property age', humanize(form.propertyAge)],
      ['Possession status', humanize(form.possessionStatus)],
      ['Available from', form.availableFrom],
    ] },
    { title: 'Location', values: [
      ['Address', form.addressLine],
      ['Sub-locality', form.subLocality],
      ['Locality', form.locality || locationLine(property)],
      ['City', form.city],
      ['Pincode', form.pincode],
      ['Map pin', form.lat && form.lng ? `${form.lat}, ${form.lng}` : undefined],
    ] },
    { title: 'Layout & area', values: [
      ['BHK', form.bhk ? `${form.bhk} BHK` : undefined],
      ['Bedrooms', form.bedrooms],
      ['Bathrooms', form.bathrooms],
      ['Balconies', form.balconies],
      ['Carpet area', form.carpetArea ? `${Number(form.carpetArea).toLocaleString('en-IN')} sqft` : undefined],
      ['Built-up area', form.builtUpArea ? `${Number(form.builtUpArea).toLocaleString('en-IN')} sqft` : undefined],
      ['Super built-up area', form.superBuiltUpArea ? `${Number(form.superBuiltUpArea).toLocaleString('en-IN')} sqft` : undefined],
      ['Plot area', form.plotArea ? `${Number(form.plotArea).toLocaleString('en-IN')} sqft` : undefined],
      ['Plot dimensions', form.plotDimensions],
      ['Floor', form.floorNumber],
      ['Total floors', form.totalFloors],
      ['Facing', form.facing],
      ['Additional rooms', form.additionalRooms],
    ] },
    { title: 'Furnishing & parking', values: [
      ['Furnishing', form.furnishing],
      ['Included appliances', form.appliances],
      ['Wardrobes', form.wardrobesCount],
      ['Air conditioners', form.acCount],
      ['Beds', form.bedCount],
      ['Geysers', form.geyserCount],
      ['Fans', form.fansCount],
      ['Covered car spaces', form.coveredCars],
      ['Open car spaces', form.openCars],
      ['Two-wheeler parking', form.twoWheeler],
      ['EV charging', form.evCharging],
    ] },
    { title: 'Utilities & features', values: [
      ['Water source', form.waterSource],
      ['Power backup', form.powerBackup],
      ['Piped gas', form.pipedGas],
      ['Lifts', form.liftsCount],
      ['Overlooking', form.overlooking],
      ['Gated security', form.gatedSecurity],
      ['Corner plot', form.isCornerPlot],
    ] },
    { title: 'Pricing & terms', values: [
      ['Price', priceOf(property)],
      ['Ownership type', form.ownershipType],
      ['Khata type', form.khataType],
      ['Price negotiable', form.priceNegotiable],
      ['Bank approvals', form.bankApprovals],
      ['Monthly rent', form.monthlyRent ? `${formatPriceShort(form.monthlyRent)}/mo` : undefined],
      ['Security deposit', formatPriceShort(form.securityDeposit)],
      ['Maintenance', form.maintenance ? `${formatPriceShort(form.maintenance)}/mo` : undefined],
      ['Preferred tenants', form.preferredTenants],
      ['Pet friendly', form.petFriendly],
      ['Vegetarian only', form.vegOnly],
      ['Lock-in period (months)', form.lockInPeriodMonths],
      ['Notice period (months)', form.noticePeriodMonths],
    ] },
  ];
  const nearby: Data[] = Array.isArray(form.nearby) ? form.nearby : [];

  return <Screen standalone title="Property details" subtitle={listing.status === 'archived' ? 'Archived property · read only' : 'Read-only property details'} onBack={onBack}>
    <Panel>
      <View style={s.heading}>
        <Text style={s.title}>{String(property.title || 'Untitled property')}</Text>
        <Badge label={status.label} tone={status.tone} icon={status.icon} upper />
      </View>
      {property.societyName ? <Text style={s.society}>in {String(property.societyName)}</Text> : null}
      <InfoRow label="Location" value={locationLine(property)} />
      <InfoRow label="Area" value={areaLine(property)} />
      <InfoRow label="Price" value={priceOf(property)} />
    </Panel>
    {rows.map(section => <DetailsSection key={section.title} title={section.title} rows={section.values} />)}
    {property.description ? <Panel><Text style={s.sectionTitle}>Description</Text><Text style={s.description}>{String(property.description)}</Text></Panel> : null}
    {nearby.length ? <Panel>
      <Text style={s.sectionTitle}>Nearby places</Text>
      {nearby.map((item, index) => <View key={`${item.name || 'place'}-${index}`} style={s.nearby}>
        <Text style={s.nearbyName}>{String(item.name || `Place ${index + 1}`)}</Text>
        <InfoRow label="Category" value={display(item.category)} />
        <InfoRow label="Distance" value={item.distance ? `${item.distance} km` : undefined} />
        <InfoRow label="Travel time" value={display(item.travelTime)} />
      </View>)}
    </Panel> : null}
    <PropertyPhotos propertyId={String(property._id || property.id || '')} />
  </Screen>;
}

const s = StyleSheet.create({
  heading: { gap: 10 },
  title: { color: palette.ink, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  society: { color: palette.greenText, fontSize: 14.5, fontWeight: '700' },
  sectionTitle: { color: palette.ink, fontSize: 14.5, fontWeight: '800' },
  description: { color: palette.body, fontSize: 13.5, lineHeight: 20 },
  muted: { color: palette.muted, fontSize: 12.5, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 6 },
  retry: { color: palette.greenText, fontSize: 13.5, fontWeight: '800' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '48%', aspectRatio: 1.25, borderRadius: 12, backgroundColor: palette.line },
  nearby: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 8, gap: 2 },
  nearbyName: { color: palette.ink, fontSize: 13.5, fontWeight: '700' },
});
