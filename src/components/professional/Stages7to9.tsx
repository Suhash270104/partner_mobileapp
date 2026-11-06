import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { computeKaiScore, documentTypes, generatedFileName, joinOrNone, normalizeMime, uploadStudioFile } from '../../lib/professionalOnboarding';
import { c, Card, ErrorText, KaiCard, Pill, Question, SectionLabel } from './onboardingUi';
import type { StageProps } from './Stages1to3';

// ---------------------------------------------------------------- Stage 7
export function Stage7({ data, update, onUploading }: StageProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const isUploading = uploading !== null;
  useEffect(() => { onUploading?.(isUploading); return () => onUploading?.(false); }, [isUploading, onUploading]);
  const [error, setError] = useState('');

  const docs = documentTypes(data);
  const verifiedDocs = data.verifiedDocs || {};
  const isGstVerified = Boolean(data.gstDetails?.isVerified && data.gstDetails?.gstin);
  const isIndividual = data.workModel === 'self';
  const uploadedCount = Object.keys(verifiedDocs).length;
  const totalCount = uploadedCount + (isGstVerified && !verifiedDocs.gst ? 1 : 0);

  const kai = isGstVerified
    ? `Awesome! Your business GSTIN (${data.gstDetails?.gstin}) is already live-verified via GSTN. You can upload any remaining studio credentials below.`
    : isIndividual
      ? 'Welcome! Since you operate as an individual practitioner/freelancer, GST is not mandatory. Upload your identity verification to proceed.'
      : totalCount > 0
        ? `Great! You've verified/uploaded ${totalCount} credential(s). Verified studios get up to 3X higher client inquiry rates!`
        : "Almost there! Let's complete your business verification to unlock your KAI Trust Badge.";

  async function pick(docId: string, photoOnly: boolean) {
    let file: { uri: string; name: string; mimeType: string; size?: number | null } | null = null;
    if (photoOnly) {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const name = asset.fileName || generatedFileName(docId);
      file = { uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name), size: asset.fileSize };
    } else {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], multiple: false, copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      file = { uri: asset.uri, name: asset.name, mimeType: normalizeMime(asset.mimeType, asset.name), size: asset.size };
    }
    setError('');
    setUploading(docId);
    try {
      const url = await uploadStudioFile(file, 'designerPortfolioDocument');
      update({ verifiedDocs: { ...verifiedDocs, [docId]: { fileName: file.name, url } } });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload document. Please try again.');
    } finally {
      setUploading(null);
    }
  }

  function remove(docId: string) {
    const next = { ...verifiedDocs };
    delete next[docId];
    update({ verifiedDocs: next });
  }

  return (
    <View>
      <KaiCard message={kai} sub="Uploaded documents are stored with bank-level 256-bit encryption." />

      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.head}>Upload Verification Documents</Text>
          <Text style={s.sub}>All documents are encrypted and 100% secure</Text>
        </View>
        <Pill label={`${totalCount} / ${docs.length}`} />
      </View>

      {docs.map(doc => {
        const raw = verifiedDocs[doc.id];
        const uploaded = Boolean(raw);
        const fileName = typeof raw === 'object' ? raw?.fileName : raw;
        const busy = uploading === doc.id;
        const done = uploaded || doc.autoVerified;
        return (
          <View key={doc.id} style={[s.doc, done && s.docOn]}>
            <View style={[s.docIcon, done && { backgroundColor: c.green }]}>
              {busy ? <ActivityIndicator color={done ? '#fff' : c.green} /> : <Text style={[s.docIconText, done && { color: '#fff' }]}>{done ? '✓' : '▤'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.docTitleRow}>
                <Text style={s.docName}>{doc.name}</Text>
                {doc.required && !done && <Pill tone="amber" label="REQUIRED" />}
              </View>
              <Text style={s.docSub} numberOfLines={2}>{busy ? 'Uploading…' : uploaded ? fileName : doc.autoVerified ? '✓ Verified via GSTN' : doc.subtitle}</Text>
              <View style={s.docActions}>
                <Pressable style={[s.docBtn, done && s.docBtnOn]} disabled={busy} onPress={() => void pick(doc.id, doc.photoOnly)}>
                  <Text style={[s.docBtnText, done && { color: '#fff' }]}>{uploaded ? 'Change File' : doc.autoVerified ? 'Attach PDF (Opt)' : 'Upload File'}</Text>
                </Pressable>
                {uploaded && <Pressable onPress={() => remove(doc.id)} disabled={busy}><Text style={s.remove}>Remove</Text></Pressable>}
              </View>
            </View>
          </View>
        );
      })}
      {!!error && <ErrorText>{error}</ErrorText>}
      <Text style={s.note}>🔒  Your documents are private and will only be used for verification and trust scoring. We use bank-level encryption and your data is never shared.</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Stage 8
const stars = (rating: number) => {
  const full = Math.floor(rating);
  return '★'.repeat(full) + (rating % 1 !== 0 ? '⯨' : '') + '☆'.repeat(Math.max(0, 5 - full - (rating % 1 !== 0 ? 1 : 0)));
};

export function Stage8({ data }: Pick<StageProps, 'data'>) {
  const kai = computeKaiScore(data);
  const strongest = data.primaryExpertise[0] ? `${data.primaryExpertise[0]}${data.specializations[0] ? ` & ${data.specializations[0]}` : ''}` : 'Architecture & Design';
  const locations = data.cities.length ? data.cities.join(', ') : joinOrNone(data.primaryCities);
  const insights = [
    { title: 'Your Strongest Expertise', value: strongest },
    { title: 'Best Matching Budget Range', value: joinOrNone(data.budgetRanges) },
    { title: 'Best Locations for You', value: locations },
    { title: 'Project Types You Win Most', value: joinOrNone(data.propertyTypes) },
    { title: 'Your Design Language', value: joinOrNone(data.specializations) },
  ];

  return (
    <View>
      <KaiCard
        message={kai.isLow
          ? `KAI Trust Alert: Your KAI Score is ${kai.score}/100. Uploading authentic GST/PAN verification documents & portfolio proof will boost your rank to 90+!`
          : `KAI has calculated your score as ${kai.score}/100 (${kai.rankTag}). Your profile authenticity is verified!`}
        sub={kai.isLow ? 'Unverified or missing document details reduce overall lead matching rank.' : 'High credibility profiles receive 3X more premium client project leads.'}
      />

      <Card style={s.scoreCard}>
        <Text style={s.cardHead}>Your KAI Match Score</Text>
        <View style={[s.ring, kai.isLow && { borderColor: c.amber }]}>
          <Text style={s.ringScore}>{kai.score}</Text>
          <Text style={s.ringMax}>/100</Text>
        </View>
        <Pill tone={kai.isLow ? 'amber' : 'green'} label={kai.rankTag} />
        <Text style={s.cardCopy}>
          {kai.isLow
            ? 'Your profile has a lower credibility score due to missing verification documents or portfolio proof.'
            : `You are ranked in the ${kai.rankTag.toLowerCase()} of professionals on KraftNex based on your selections.`}
        </Text>
      </Card>

      <SectionLabel>WHAT DRIVES YOUR SCORE</SectionLabel>
      <Card>
        {kai.drivers.map(driver => (
          <View key={driver.label} style={s.driver}>
            <View style={s.driverTop}>
              <Text style={s.driverLabel}>{driver.label}</Text>
              <Text style={s.driverPts}>+{driver.points} pts</Text>
            </View>
            <View style={s.bar}><View style={[s.barFill, { width: `${(driver.points / driver.max) * 100}%` }]} /></View>
          </View>
        ))}
      </Card>

      <SectionLabel>YOUR EXPERTISE STRENGTH MATRIX</SectionLabel>
      <Card>
        {kai.matrix.map(item => (
          <View key={item.title} style={s.matrixRow}>
            <Text style={s.matrixTitle}>{item.title}</Text>
            <Text style={s.matrixStars}>{stars(item.rating)}</Text>
            <Text style={[s.matrixScore, kai.isLow && { color: c.amber }]}>{item.score}/100</Text>
          </View>
        ))}
      </Card>

      <SectionLabel>KAI INSIGHTS ABOUT YOU</SectionLabel>
      <Card>
        {insights.map(item => (
          <View key={item.title} style={s.insight}>
            <Text style={s.insightTitle}>{item.title}</Text>
            <Text style={s.insightValue}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {kai.isLow && (
        <Card style={{ marginTop: 14, backgroundColor: c.amberSoft, borderColor: '#efd9a3' }}>
          <Text style={s.alert}>Upload GST or PAN document to gain +20 pts</Text>
          <Text style={s.alert}>Attach portfolio images/links to gain +15 pts</Text>
        </Card>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Stage 9
export function Stage9({ data, submitted }: Pick<StageProps, 'data'> & { submitted: boolean }) {
  const kai = computeKaiScore(data);
  const rows = [
    { label: 'Studio', value: data.businessName || 'Not Specified' },
    { label: 'Expertise', value: joinOrNone(data.primaryExpertise) },
    { label: 'Best Budget Range', value: joinOrNone(data.budgetRanges) },
    { label: 'Locations', value: data.cities.length ? data.cities.join(', ') : joinOrNone(data.primaryCities) },
    { label: 'Project Types You Win Most', value: joinOrNone(data.propertyTypes) },
    { label: 'Portfolio', value: `${data.portfolioImages.length} image(s), ${data.pdfDocuments.length} PDF(s)` },
    { label: 'Verification documents', value: `${kai.verifiedDocs} uploaded${data.gstDetails?.isVerified ? ' + GSTIN verified' : ''}` },
  ];
  return (
    <View>
      <KaiCard
        message={`${submitted ? 'Application received' : 'Ready to submit'} for ${data.businessName || 'your studio'}! Your initial Professional DNA score is ${kai.score}/100.`}
        sub="Our admin team will review your business credentials and unlock your full studio dashboard once approved."
      />

      <Card style={{ marginTop: 14 }}>
        <Text style={s.cardHead}>Studio Approval Workflow</Text>
        <Text style={s.cardCopy}>Thank you for completing your professional onboarding! Your studio application and credentials are under review by the KraftNex Admin team.</Text>
      </Card>

      <SectionLabel>YOUR PROFESSIONAL DNA SUMMARY</SectionLabel>
      <Card>
        {rows.map(row => (
          <View key={row.label} style={s.insight}>
            <Text style={s.insightTitle}>{row.label}</Text>
            <Text style={s.insightValue}>{row.value}</Text>
          </View>
        ))}
        <View style={s.insight}>
          <Text style={s.insightTitle}>Your KAI Professional Score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.insightValue, { fontWeight: '800' }]}>{kai.score} / 100</Text>
            <Pill tone={kai.isLow ? 'amber' : 'green'} label={kai.rankTag} />
          </View>
        </View>
      </Card>

      <Question>What Happens Next?</Question>
      <Card style={{ gap: 12 }}>
        {[
          ['AI Matching Starts', 'KAI will analyze live projects and find the best matches for you.'],
          ['Personalized Recommendations', "You'll receive project and client recommendations in your dashboard."],
          ['Grow & Win', 'Connect, collaborate and win projects that are perfect for your business.'],
        ].map(([title, body]) => (
          <View key={title}>
            <Text style={s.insightValueLeft}>{title}</Text>
            <Text style={s.cardCopy}>{body}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 12 },
  head: { color: c.ink, fontSize: 17, fontWeight: '800' },
  sub: { color: c.muted, fontSize: 12, marginTop: 2 },
  doc: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: c.line, padding: 14, marginBottom: 10 },
  docOn: { backgroundColor: c.greenSoft, borderColor: c.green },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  docIconText: { color: c.green, fontSize: 18, fontWeight: '800' },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docName: { color: c.ink, fontSize: 14, fontWeight: '800' },
  docSub: { color: c.body, fontSize: 12, marginTop: 3 },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  docBtn: { minHeight: 38, borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  docBtnOn: { backgroundColor: c.green },
  docBtnText: { color: c.green, fontSize: 12.5, fontWeight: '800' },
  remove: { color: c.red, fontSize: 12.5, fontWeight: '800' },
  note: { color: c.muted, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  scoreCard: { marginTop: 16, alignItems: 'center', gap: 12 },
  cardHead: { color: c.ink, fontSize: 15, fontWeight: '800' },
  cardCopy: { color: c.body, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  ring: { width: 132, height: 132, borderRadius: 66, borderWidth: 10, borderColor: '#2f8a68', alignItems: 'center', justifyContent: 'center' },
  ringScore: { color: c.ink, fontSize: 38, fontWeight: '800' },
  ringMax: { color: c.muted, fontSize: 12, fontWeight: '700', marginTop: -4 },
  driver: { marginBottom: 14 },
  driverTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  driverLabel: { color: c.ink, fontSize: 13.5, fontWeight: '700' },
  driverPts: { color: c.greenText, fontSize: 13, fontWeight: '800' },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#2f8a68' },
  matrixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  matrixTitle: { flex: 1, color: c.ink, fontSize: 12.5, fontWeight: '700' },
  matrixStars: { color: '#2f8a68', fontSize: 12, letterSpacing: 1 },
  matrixScore: { minWidth: 52, textAlign: 'right', color: c.greenText, fontSize: 12.5, fontWeight: '800' },
  insight: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, gap: 3 },
  insightTitle: { color: c.muted, fontSize: 11.5, fontWeight: '700' },
  insightValue: { color: c.ink, fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  insightValueLeft: { color: c.ink, fontSize: 14, fontWeight: '800' },
  alert: { color: c.amber, fontSize: 12.5, fontWeight: '700', lineHeight: 20 },
});
