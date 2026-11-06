import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  COMM_OPTIONS,
  DEFAULT_PROCESS_STEPS,
  DIFFERENTIATOR_OPTIONS,
  generatedFileName,
  ENGAGEMENT_OPTIONS,
  INVOLVEMENT_OPTIONS,
  normalizeMime,
  normalizeUrl,
  OPERATING_CITIES,
  PROJECT_CAPACITY_OPTIONS,
  SUPPORT_OPTIONS,
  TEAM_FIELDS,
  TIMELINE_OPTIONS,
  toggleItem,
  uploadStudioFile,
  WORK_MODES,
} from '../../lib/professionalOnboarding';
import { c, Card, Chip, ChoiceCard, ErrorText, Field, Grid2, KaiCard, OptionTile, Question, Row, Segmented, Stepper, YesNo } from './onboardingUi';
import type { StageProps } from './Stages1to3';

const message = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

// ---------------------------------------------------------------- Stage 4
type LinkField = 'websiteUrl' | 'instagramUrl' | 'behanceUrl' | 'youtubeUrl';
const LINKS: { field: LinkField; label: string; hint: string; placeholder: string }[] = [
  { field: 'websiteUrl', label: 'Studio Website', hint: 'Your Portfolio Website', placeholder: 'https://yourstudio.com' },
  { field: 'instagramUrl', label: 'Instagram Profile', hint: 'Business Account', placeholder: 'https://instagram.com/yourstudio' },
  { field: 'behanceUrl', label: 'Behance / Pinterest', hint: 'Profile Link', placeholder: 'https://behance.net/yourstudio' },
  { field: 'youtubeUrl', label: 'YouTube / Video', hint: 'Project Walkthrough', placeholder: 'https://youtube.com/@yourstudio' },
];

export function Stage4({ data, update, onUploading }: StageProps) {
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [imageError, setImageError] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [editing, setEditing] = useState<LinkField | null>(null);
  const [draft, setDraft] = useState('');
  const [linkError, setLinkError] = useState('');

  const images = data.portfolioImages;
  const busy = uploadingImages || uploadingPdf;
  useEffect(() => { onUploading?.(busy); return () => onUploading?.(false); }, [busy, onUploading]);
  const totalAdded = images.length + data.pdfDocuments.length + LINKS.filter(item => data[item.field]).length;
  const kai = totalAdded > 0
    ? `Awesome! You've attached ${totalAdded} portfolio item(s). KAI is analyzing your design aesthetic.`
    : 'Share your work by uploading images, project presentations, website links or social handles.';

  async function addImages(assets: ImagePicker.ImagePickerAsset[]) {
    if (!assets.length) return;
    setImageError('');
    setUploadingImages(true);
    const urls: string[] = [];
    let failed = 0;
    let lastReason = '';
    for (const asset of assets) {
      const name = asset.fileName || generatedFileName('portfolio');
      try {
        urls.push(await uploadStudioFile({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name), size: asset.fileSize }, 'designerPortfolio'));
      } catch (error) {
        failed += 1;
        lastReason = message(error, 'Upload failed');
      }
    }
    const next = Array.from(new Set([...images, ...urls]));
    update({ portfolioImages: next, portfolioImagesCount: next.length });
    if (failed) setImageError(`${failed} of ${assets.length} image(s) failed to upload. ${lastReason}`);
    setUploadingImages(false);
  }

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (!result.canceled) await addImages(result.assets);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setImageError('Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) await addImages(result.assets);
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setPdfError('');
    setUploadingPdf(true);
    const added = [];
    let failed = 0;
    let lastReason = '';
    for (const asset of result.assets) {
      try {
        const url = await uploadStudioFile({ uri: asset.uri, name: asset.name, mimeType: 'application/pdf', size: asset.size }, 'designerPortfolioDocument');
        added.push({ name: asset.name, url });
      } catch (error) {
        failed += 1;
        lastReason = message(error, 'Upload failed');
      }
    }
    const documents = [...data.pdfDocuments, ...added];
    update({ pdfDocuments: documents, pdfFileNames: documents.map(item => item.name), pdfUploaded: documents.length > 0 });
    if (failed) setPdfError(`${failed} of ${result.assets.length} file(s) failed to upload. ${lastReason}`);
    setUploadingPdf(false);
  }

  function removeImage(index: number) {
    const next = images.filter((_, position) => position !== index);
    update({ portfolioImages: next, portfolioImagesCount: next.length });
  }

  function removePdf(index: number) {
    const documents = data.pdfDocuments.filter((_, position) => position !== index);
    update({ pdfDocuments: documents, pdfFileNames: documents.map(item => item.name), pdfUploaded: documents.length > 0 });
  }

  function openLink(field: LinkField) {
    setDraft(data[field] || '');
    setLinkError('');
    setEditing(field);
  }

  function saveLink() {
    if (!editing) return;
    const normalized = normalizeUrl(draft);
    if (normalized === null) {
      setLinkError('Enter a valid link, for example https://yourstudio.com');
      return;
    }
    update({ [editing]: normalized } as Partial<typeof data>);
    setEditing(null);
  }

  return (
    <View>
      <KaiCard message={kai} sub="Upload files or attach links below." />

      <Question note="Choose any format">Add your portfolio & project links</Question>
      <Card>
        <Text style={s.cardTitle}>Showcase Your Best Work</Text>
        <Text style={s.cardCopy}>JPG, PNG or WEBP images. {images.length} uploaded.</Text>
        <View style={s.buttonRow}>
          <Pressable style={s.action} onPress={() => void pickImages()} disabled={uploadingImages}><Text style={s.actionText}>Choose from Gallery</Text></Pressable>
          <Pressable style={s.action} onPress={() => void takePhoto()} disabled={uploadingImages}><Text style={s.actionText}>Camera Capture</Text></Pressable>
        </View>
        {uploadingImages && <View style={s.uploading}><ActivityIndicator color={c.green} /><Text style={s.uploadingText}>Uploading…</Text></View>}
        {!!imageError && <ErrorText>{imageError}</ErrorText>}
        {images.length > 0 && (
          <View style={s.thumbs}>
            {images.map((url, index) => (
              <View key={`${url}-${index}`} style={s.thumb}>
                <Image source={{ uri: url }} style={s.thumbImg} />
                <Pressable style={s.thumbRemove} onPress={() => removeImage(index)} accessibilityLabel={`Remove portfolio image ${index + 1}`}><Text style={s.thumbRemoveText}>×</Text></Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={s.cardTitle}>Upload PDF / Deck</Text>
        <Text style={s.cardCopy}>PDF only.</Text>
        <Pressable style={[s.action, { marginTop: 10 }]} onPress={() => void pickPdf()} disabled={uploadingPdf}>
          {uploadingPdf ? <ActivityIndicator color={c.green} /> : <Text style={s.actionText}>Choose PDF</Text>}
        </Pressable>
        {!!pdfError && <ErrorText>{pdfError}</ErrorText>}
        {data.pdfDocuments.map((doc, index) => (
          <View key={`${doc.url}-${index}`} style={s.fileRow}>
            <Text style={s.fileName} numberOfLines={1}>📄  {doc.name}</Text>
            <Pressable onPress={() => removePdf(index)}><Text style={s.remove}>Remove</Text></Pressable>
          </View>
        ))}
      </Card>

      <Question>Your Online Presence</Question>
      {LINKS.map(item => (
        <Pressable key={item.field} style={[s.linkRow, !!data[item.field] && s.linkRowOn]} onPress={() => openLink(item.field)}>
          <View style={s.flex}>
            <Text style={s.linkLabel}>{item.label}</Text>
            <Text style={s.linkValue} numberOfLines={1}>{data[item.field] || item.hint}</Text>
          </View>
          <Text style={s.linkAction}>{data[item.field] ? 'Edit' : 'Add'}</Text>
        </Pressable>
      ))}
      <Text style={s.note}>🔒  All uploads are secure and only used to analyze your portfolio for matching.</Text>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.cardTitle}>Add Link</Text>
            <Field value={draft} onChangeText={text => { setDraft(text); setLinkError(''); }} placeholder={LINKS.find(item => item.field === editing)?.placeholder} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            {!!linkError && <ErrorText>{linkError}</ErrorText>}
            <View style={s.buttonRow}>
              <Pressable style={s.action} onPress={() => setEditing(null)}><Text style={s.actionText}>Cancel</Text></Pressable>
              <Pressable style={[s.action, s.actionPrimary]} onPress={saveLink}><Text style={[s.actionText, { color: '#fff' }]}>Save Link</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------- Stage 5
export function Stage5({ data, update }: StageProps) {
  const team = data.team;
  const total = team.total || 0;
  const kai = total > 0 && data.simultaneousProjects
    ? `A ${total}-person team handling ${data.simultaneousProjects} simultaneously allows optimal project delivery & client satisfaction.`
    : total > 0
      ? `Team size: ${total} professionals! Select your capacity and operating cities next.`
      : "Let's understand the way you operate. These details help KAI recommend projects fitting your team capacity.";

  function setTeam(field: keyof typeof team, value: number) {
    const next = { ...team, [field]: Math.max(0, value) };
    if (field !== 'total') next.total = next.architects + next.designers + next.civilEngineers + next.siteEngineers + next.otherStaff;
    update({ team: next });
  }

  return (
    <View>
      <KaiCard message={kai} sub="Capacity details help KAI balance lead delivery so you never get overwhelmed." />

      <Question index="1.">Tell me about your team</Question>
      <Card>
        {TEAM_FIELDS.map(item => <Stepper key={item.field} label={item.label} hint="People" value={team[item.field] || 0} onChange={value => setTeam(item.field, value)} />)}
      </Card>

      <Question index="2." note="Across all stages">How many projects can you handle simultaneously?</Question>
      {PROJECT_CAPACITY_OPTIONS.map(option => <ChoiceCard key={option} selected={data.simultaneousProjects === option} onPress={() => update({ simultaneousProjects: option })} title={option} />)}

      <Question index="3." note="From concept to completion">What is your typical project timeline?</Question>
      {TIMELINE_OPTIONS.map(option => <ChoiceCard key={option} selected={data.projectTimeline === option} onPress={() => update({ projectTimeline: option })} title={option} />)}

      <Question index="4.">How do you usually work with clients?</Question>
      <Segmented options={WORK_MODES} value={data.clientWorkMode} onChange={clientWorkMode => update({ clientWorkMode })} />

      <Question index="5.">Where do you operate?</Question>
      <Row>{OPERATING_CITIES.map(city => <Chip key={city} label={city} removable selected={data.primaryCities.includes(city)} onPress={() => update({ primaryCities: toggleItem(data.primaryCities, city) })} />)}</Row>
      <Card style={s.inlineCard}>
        <Text style={s.inlineLabel}>Willing to travel / serve in other cities?</Text>
        <YesNo value={data.willingToTravel} onChange={willingToTravel => update({ willingToTravel })} />
      </Card>
      <KaiCard title="AI INSIGHT" message={data.primaryCities.length ? `Your primary target cities are: ${data.primaryCities.join(', ')}.` : 'Select your primary operating cities to get regional client project matches.'} />

      <Question index="6.">What is your preferred project engagement?</Question>
      <Grid2>{ENGAGEMENT_OPTIONS.map(option => <OptionTile key={option} multi={false} label={option} selected={data.preferredEngagement === option} onPress={() => update({ preferredEngagement: option })} />)}</Grid2>

      <Question index="7.">Do you offer after-project support?</Question>
      <Row>{SUPPORT_OPTIONS.map(option => <Chip key={option} label={option} selected={data.afterProjectSupport === option} onPress={() => update({ afterProjectSupport: option })} />)}</Row>

      <Card style={s.inlineCard}>
        <Text style={s.inlineLabel}>8.  Do you have any in-house manufacturing or execution unit?</Text>
        <YesNo value={data.inHouseManufacturing} onChange={inHouseManufacturing => update({ inHouseManufacturing })} no="No, we work with partners" />
      </Card>
      <Card style={s.inlineCard}>
        <Text style={s.inlineLabel}>9.  Do you provide warranty or maintenance?</Text>
        <YesNo value={data.warrantyProvided} onChange={warrantyProvided => update({ warrantyProvided })} />
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- Stage 6
export function Stage6({ data, update }: StageProps) {
  const [newStep, setNewStep] = useState('');
  const [adding, setAdding] = useState(false);

  // New studios start with no steps and no involvement choice. Seed what is shown into the form so the
  // list and selection on screen are exactly what the next save stores.
  useEffect(() => {
    const seeded: Partial<typeof data> = {};
    if (!data.processSteps.length) seeded.processSteps = DEFAULT_PROCESS_STEPS;
    if (!data.clientInvolvement) seeded.clientInvolvement = INVOLVEMENT_OPTIONS[0];
    if (Object.keys(seeded).length) update(seeded);
  }, [data.processSteps.length, data.clientInvolvement, update]);

  const steps = data.processSteps.length ? data.processSteps : DEFAULT_PROCESS_STEPS;
  const kai = data.commChannels.length
    ? `Communicating via ${data.commChannels.join(', ')}! KAI matches you with clients who prefer these exact communication channels.`
    : 'Every business has a unique way of working. Tell me about your process and preferred client interaction channels.';

  function addStep() {
    const name = newStep.trim();
    if (name && !steps.some(step => step.toLowerCase() === name.toLowerCase())) update({ processSteps: [...steps, name] });
    setNewStep('');
    setAdding(false);
  }

  return (
    <View>
      <KaiCard message={kai} sub="Clear working styles increase client retention and proposal conversion rates." />

      <Question index="1." note="Add or remove steps">What is your typical process?</Question>
      <Card>
        {steps.map((step, index) => (
          <View key={`${step}-${index}`} style={s.stepRow}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <Text style={s.stepName}>{step}</Text>
            {steps.length > 1 && <Pressable onPress={() => update({ processSteps: steps.filter((_, position) => position !== index) })} hitSlop={8} accessibilityLabel={`Remove ${step}`}><Text style={s.stepRemove}>×</Text></Pressable>}
          </View>
        ))}
        {adding ? (
          <View style={{ marginTop: 10 }}>
            <Field value={newStep} onChangeText={setNewStep} maxLength={60} placeholder="e.g. Site Survey" autoFocus onSubmitEditing={addStep} returnKeyType="done" />
            <View style={s.buttonRow}>
              <Pressable style={s.action} onPress={() => { setNewStep(''); setAdding(false); }}><Text style={s.actionText}>Cancel</Text></Pressable>
              <Pressable style={[s.action, s.actionPrimary, !newStep.trim() && { opacity: 0.5 }]} disabled={!newStep.trim()} onPress={addStep}><Text style={[s.actionText, { color: '#fff' }]}>Add</Text></Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={{ marginTop: 12 }} onPress={() => setAdding(true)}><Text style={s.addStep}>＋  Add Step</Text></Pressable>
        )}
      </Card>

      <Question index="2." note="Select all that apply">How do you prefer to communicate with clients?</Question>
      <Grid2>{COMM_OPTIONS.map(option => <OptionTile key={option} label={option} selected={data.commChannels.includes(option)} onPress={() => update({ commChannels: toggleItem(data.commChannels, option) })} />)}</Grid2>

      <Question index="3.">How involved do you like clients to be during the project?</Question>
      {INVOLVEMENT_OPTIONS.map(option => <ChoiceCard key={option} selected={(data.clientInvolvement || INVOLVEMENT_OPTIONS[0]) === option} onPress={() => update({ clientInvolvement: option })} title={option} />)}

      <Question index="4." note="Select all that apply">What sets your way of working apart?</Question>
      <Grid2>{DIFFERENTIATOR_OPTIONS.map(option => <OptionTile key={option} label={option} selected={data.differentiators.includes(option)} onPress={() => update({ differentiators: toggleItem(data.differentiators, option) })} />)}</Grid2>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  cardCopy: { color: c.body, fontSize: 12.5, marginTop: 3 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  actionPrimary: { backgroundColor: c.green, borderColor: c.green },
  actionText: { color: c.green, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  uploadingText: { color: c.body, fontSize: 12.5 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef1ef' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 16, lineHeight: 18 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: '#f4f7f5', borderRadius: 10, padding: 10 },
  fileName: { flex: 1, color: c.ink, fontSize: 12.5, fontWeight: '600' },
  remove: { color: c.red, fontSize: 12, fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: c.line, padding: 14, marginBottom: 10 },
  linkRowOn: { borderColor: c.green, backgroundColor: c.greenSoft },
  linkLabel: { color: c.ink, fontSize: 14, fontWeight: '800' },
  linkValue: { color: c.body, fontSize: 12, marginTop: 2 },
  linkAction: { color: c.green, fontSize: 13, fontWeight: '800' },
  note: { color: c.muted, fontSize: 11.5, marginTop: 6, lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 8 },
  inlineCard: { marginTop: 12, gap: 10 },
  inlineLabel: { color: c.ink, fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: c.greenText, fontSize: 11, fontWeight: '800' },
  stepName: { flex: 1, color: c.ink, fontSize: 14, fontWeight: '700' },
  stepRemove: { color: c.muted, fontSize: 22, paddingHorizontal: 6 },
  addStep: { color: c.green, fontSize: 13.5, fontWeight: '800' },
});
