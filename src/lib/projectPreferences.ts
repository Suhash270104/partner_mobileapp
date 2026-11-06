import AsyncStorage from '@react-native-async-storage/async-storage';

// A professional's "Find Projects" preferences, same model and matching rule as the desktop
// lib/projectPreferences.ts.
//
// Where each answer lives:
//  - Saved to the studio profile (PUT /professional/profile) in the vocabulary studio onboarding
//    already uses: servicesOffered, acceptedBudgetCategories, primaryCities, willingToTravel,
//    industries, availability, projectTimeline, projectPreferencesNote.
//  - The exact radius, minimum project value and the Renovation / New Construction interests have no
//    profile field, so the full answer set is also kept per studio on this device (AsyncStorage).

export interface ProjectPreferences {
  services: string[];
  budgetTiers: string[]; // acceptedBudgetCategories: Regular | Premium | Luxury
  minProjectValue: string; // '' or a MIN_PROJECT_VALUES value (INR)
  cities: string[]; // empty = anywhere
  radius: string;
  projectTypes: string[];
  availability: string;
  duration: string;
  note: string;
}

export const NOTE_MAX = 300;

export const EMPTY_PREFERENCES: ProjectPreferences = {
  services: [], budgetTiers: [], minProjectValue: '', cities: [], radius: '', projectTypes: [], availability: '', duration: '', note: '',
};

export const SERVICE_OPTIONS = [
  'Interior Design', 'Architecture', 'Construction', 'Turnkey Projects', 'Modular Kitchen', 'Renovation',
  'Landscape Design', '3D Visualization', 'Vastu Consultation', 'Project Management', 'False Ceiling & Lighting', 'Furniture & Decor',
];

export const PROJECT_VALUE_TIERS = [
  { tier: 'Regular', label: 'Standard', range: 'Up to ₹15 Lakhs', sub: 'Projects up to ₹15 lakhs' },
  { tier: 'Premium', label: 'Premium', range: '₹15 – 30 Lakhs', sub: 'Projects from ₹15 to ₹30 lakhs' },
  { tier: 'Luxury', label: 'Elite', range: 'Above ₹30 Lakhs', sub: 'Projects above ₹30 lakhs' },
];

export const MIN_PROJECT_VALUES = [
  { value: '', label: 'No minimum' },
  { value: '200000', label: '₹2 Lakhs' },
  { value: '500000', label: '₹5 Lakhs' },
  { value: '1000000', label: '₹10 Lakhs' },
  { value: '2500000', label: '₹25 Lakhs' },
  { value: '5000000', label: '₹50 Lakhs' },
  { value: '10000000', label: '₹1 Crore' },
];

export const RADIUS_OPTIONS = ['10 km', '25 km', '50 km', '100 km', 'Anywhere'];

// Project types a studio can prefer, with the words that identify one in a client project, and the
// studio-onboarding industry each maps to (none for work types like Renovation).
export const PROJECT_TYPE_OPTIONS: { value: string; keywords: string[]; industry?: string }[] = [
  { value: 'Residential', keywords: ['residential', 'apartment', 'villa', 'bungalow', 'house', 'home'], industry: 'Residential' },
  { value: 'Commercial', keywords: ['commercial', 'office', 'retail', 'showroom'], industry: 'Commercial' },
  { value: 'Hospitality', keywords: ['hospitality', 'hotel', 'restaurant', 'cafe', 'café', 'resort'], industry: 'Hospitality' },
  { value: 'Office', keywords: ['office', 'corporate', 'workspace'], industry: 'Commercial' },
  { value: 'Retail', keywords: ['retail', 'showroom', 'store'], industry: 'Retail' },
  { value: 'Industrial', keywords: ['industrial', 'factory', 'warehouse'], industry: 'Industrial' },
  { value: 'Renovation', keywords: ['renovation', 'remodel'] },
  { value: 'New Construction', keywords: ['construction'] },
];

export const AVAILABILITY_OPTIONS = ['Available now', 'Within 1 month', '1 – 3 months', 'Just exploring'];

// Durations map onto the studio onboarding's projectTimeline options.
export const DURATION_OPTIONS = [
  { value: 'Short term', sub: '< 3 months', projectTimeline: '1 - 3 Months' },
  { value: 'Medium term', sub: '3 – 6 months', projectTimeline: '3 - 6 Months' },
  { value: 'Long term', sub: '6 – 12 months', projectTimeline: '6 - 12 Months' },
  { value: 'Any duration', sub: '', projectTimeline: '' },
];

// The slice of the studio profile this feature reads.
export interface PrefsProfile {
  onboardingData?: Record<string, unknown>;
  industries?: string[];
  servicesOffered?: string[];
  acceptedBudgetCategories?: string[];
  availability?: string;
}

// The slice of a client project the matching rule reads.
export interface MatchableProject {
  membershipLevel?: string;
  budgetRange?: string;
  city?: string;
  location?: string;
  category?: string;
  subtype?: string;
  propertyType?: string;
  serviceType?: string;
  title?: string;
  description?: string;
}

const storageKey = (designerId: string) => `kraftnex_project_prefs_${designerId}`;

export async function loadStoredPreferences(designerId: string): Promise<ProjectPreferences | null> {
  if (!designerId) return null;
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(storageKey(designerId))) || 'null');
    return parsed && typeof parsed === 'object' ? { ...EMPTY_PREFERENCES, ...parsed } : null;
  } catch {
    return null;
  }
}

async function storePreferences(designerId: string, prefs: ProjectPreferences) {
  try { await AsyncStorage.setItem(storageKey(designerId), JSON.stringify(prefs)); } catch { /* device storage unavailable: the profile copy still saved */ }
}

// Pre-fill for a studio that hasn't used the wizard on this device yet.
export function preferencesFromProfile(profile: PrefsProfile): ProjectPreferences {
  const ob = profile.onboardingData || {};
  const obIndustries = ob.industries;
  const industries: string[] = Array.isArray(obIndustries) ? obIndustries.map(String) : Array.isArray(profile.industries) ? profile.industries : [];
  const primaryCities = ob.primaryCities;
  return {
    ...EMPTY_PREFERENCES,
    services: (Array.isArray(profile.servicesOffered) ? profile.servicesOffered : []).filter(s => SERVICE_OPTIONS.includes(s)),
    budgetTiers: (Array.isArray(profile.acceptedBudgetCategories) ? profile.acceptedBudgetCategories : []).filter(t => PROJECT_VALUE_TIERS.some(v => v.tier === t)),
    cities: Array.isArray(primaryCities) ? primaryCities.map(String) : [],
    radius: ob.willingToTravel === true ? 'Anywhere' : '',
    projectTypes: PROJECT_TYPE_OPTIONS.filter(o => o.industry && o.value === o.industry && industries.some(i => i.toLowerCase() === o.industry!.toLowerCase())).map(o => o.value),
    availability: profile.availability === 'Busy' ? '1 – 3 months' : profile.availability ? 'Available now' : '',
    duration: DURATION_OPTIONS.find(d => d.projectTimeline && d.projectTimeline === ob.projectTimeline)?.value || '',
    note: typeof ob.projectPreferencesNote === 'string' ? ob.projectPreferencesNote : '',
  };
}

export async function savePreferences(
  save: (body: Record<string, unknown>) => Promise<unknown>,
  designerId: string,
  prefs: ProjectPreferences,
  profile: PrefsProfile,
) {
  const existingIndustries = Array.isArray(profile.industries) ? profile.industries : [];
  const existingServices = Array.isArray(profile.servicesOffered) ? profile.servicesOffered : [];
  const mappedIndustries = Array.from(new Set(
    prefs.projectTypes.map(t => PROJECT_TYPE_OPTIONS.find(o => o.value === t)?.industry).filter(Boolean) as string[],
  ));
  // Keep onboarding industries / services this wizard doesn't offer (Healthcare, Education, ...).
  const offered = new Set(PROJECT_TYPE_OPTIONS.map(o => o.industry).filter(Boolean));
  const keptIndustries = existingIndustries.filter(i => !offered.has(i));
  const keptServices = existingServices.filter(s => !SERVICE_OPTIONS.includes(s));
  const duration = DURATION_OPTIONS.find(d => d.value === prefs.duration);

  const body: Record<string, unknown> = {
    servicesOffered: [...keptServices, ...prefs.services],
    acceptedBudgetCategories: prefs.budgetTiers,
    primaryCities: prefs.cities,
    cities: prefs.cities,
    willingToTravel: prefs.radius === 'Anywhere' || prefs.radius === '100 km' || prefs.radius === '50 km',
    industries: [...keptIndustries, ...mappedIndustries],
    availability: prefs.availability === '1 – 3 months' ? 'Busy' : 'Available',
    projectPreferencesNote: prefs.note.trim().slice(0, NOTE_MAX),
  };
  if (duration?.projectTimeline) body.projectTimeline = duration.projectTimeline;

  await save(body);
  await storePreferences(designerId, prefs);
}

// Rough INR upper bound of a client project's budget text ("₹10L–50L", "Under ₹10L", "₹1–2Cr").
export function budgetMaxInr(text: string): number | null {
  const str = String(text || '').toLowerCase();
  const values = [
    ...(str.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore)/g) || []).map(m => parseFloat(m) * 10000000),
    ...(str.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)/g) || []).map(m => parseFloat(m) * 100000),
  ];
  if (!values.length) return null;
  return str.includes('+') ? Infinity : Math.max(...values);
}

const PROJECT_TIER_FOR: Record<string, string> = { Standard: 'Regular', Premium: 'Premium', Elite: 'Luxury' };

export function projectMatchesPreferences(project: MatchableProject, prefs: ProjectPreferences): boolean {
  if (prefs.budgetTiers.length) {
    const tier = PROJECT_TIER_FOR[String(project.membershipLevel)] || 'Regular';
    if (!prefs.budgetTiers.includes(tier)) return false;
  }
  if (prefs.minProjectValue) {
    const max = budgetMaxInr(project.budgetRange || '');
    if (max !== null && max < Number(prefs.minProjectValue)) return false;
  }
  if (prefs.cities.length && prefs.radius !== 'Anywhere') {
    const where = `${project.city || ''} ${project.location || ''}`.toLowerCase();
    if (!prefs.cities.some(c => where.includes(c.toLowerCase()))) return false;
  }
  if (prefs.projectTypes.length) {
    const text = [project.category, project.subtype, project.propertyType, project.serviceType, project.title, project.description]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesType = prefs.projectTypes.some(t => PROJECT_TYPE_OPTIONS.find(o => o.value === t)?.keywords.some(k => text.includes(k)));
    if (!matchesType) return false;
  }
  return true;
}

// Which of the studio's own criteria a brief meets, one at a time. Only criteria they actually set.
export function preferenceCriteria(project: MatchableProject, prefs: ProjectPreferences): { label: string; ok: boolean }[] {
  const out: { label: string; ok: boolean }[] = [];
  if (prefs.budgetTiers.length || prefs.minProjectValue) {
    out.push({ label: 'Budget', ok: projectMatchesPreferences(project, { ...EMPTY_PREFERENCES, budgetTiers: prefs.budgetTiers, minProjectValue: prefs.minProjectValue }) });
  }
  if (prefs.cities.length && prefs.radius !== 'Anywhere') {
    out.push({ label: 'Location', ok: projectMatchesPreferences(project, { ...EMPTY_PREFERENCES, cities: prefs.cities, radius: prefs.radius }) });
  }
  if (prefs.projectTypes.length) {
    out.push({ label: 'Project type', ok: projectMatchesPreferences(project, { ...EMPTY_PREFERENCES, projectTypes: prefs.projectTypes }) });
  }
  return out;
}
