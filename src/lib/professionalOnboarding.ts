import {
  partnerApi,
  PartnerApiError,
  ProfessionalGstDetails,
  ProfessionalProfileRecord,
} from './partnerApi';

// Mirrors the desktop partner-app studio onboarding (views/ProfessionalOnboardingPage and
// components/onboarding/Stage1-9). Option lists, copy, validation and the saved payload are the
// desktop's; only the presentation differs.

export const TOTAL_STAGES = 9;

export interface PortfolioDocument { name: string; url: string }
export interface VerifiedDoc { fileName: string; url: string }

export interface OnboardingData {
  // Stage 1
  workModel: '' | 'self' | 'registered' | 'unregistered';
  role: string;
  operationType: string;
  businessName: string;
  establishedYear: string;
  cities: string[];
  gstDetails?: ProfessionalGstDetails;
  acceptedPartnerTerms?: boolean;
  // Stage 2
  primaryExpertise: string[];
  industries: string[];
  propertyTypes: string[];
  // Stage 3
  subtypes?: string[];
  services: string[];
  specializations: string[];
  budgetRanges: string[];
  tier: string;
  projectSize: string;
  // Stage 4
  portfolioImages: string[];
  portfolioImagesCount: number;
  pdfFileNames: string[];
  pdfDocuments: PortfolioDocument[];
  pdfUploaded: boolean;
  websiteUrl: string;
  instagramUrl: string;
  behanceUrl: string;
  youtubeUrl: string;
  // Stage 5
  team: { total: number; architects: number; designers: number; civilEngineers: number; siteEngineers: number; otherStaff: number };
  simultaneousProjects: string;
  projectTimeline: string;
  clientWorkMode: string;
  primaryCities: string[];
  willingToTravel?: boolean;
  preferredEngagement: string;
  afterProjectSupport: string;
  inHouseManufacturing?: boolean;
  warrantyProvided?: boolean;
  // Stage 6
  processSteps: string[];
  commChannels: string[];
  clientInvolvement: string;
  differentiators: string[];
  // Stage 7
  verifiedDocs: Record<string, VerifiedDoc | string>;
}

export const getInitialData = (): OnboardingData => ({
  workModel: '', role: '', operationType: '', businessName: '', establishedYear: '', cities: [],
  primaryExpertise: [], industries: [], propertyTypes: [],
  services: [], specializations: [], budgetRanges: [], tier: '', projectSize: '',
  portfolioImages: [], portfolioImagesCount: 0, pdfFileNames: [], pdfDocuments: [], pdfUploaded: false,
  websiteUrl: '', instagramUrl: '', behanceUrl: '', youtubeUrl: '',
  team: { total: 0, architects: 0, designers: 0, civilEngineers: 0, siteEngineers: 0, otherStaff: 0 },
  simultaneousProjects: '', projectTimeline: '', clientWorkMode: '', primaryCities: [],
  preferredEngagement: '', afterProjectSupport: '',
  processSteps: [], commChannels: [], clientInvolvement: '', differentiators: [],
  verifiedDocs: {},
});

export const STAGES = [
  { num: 1, title: 'Identity & Operating Model', sub: 'Individual, Studio or Firm', tag: 'IDENTITY SETUP' },
  { num: 2, title: 'Business DNA & Focus', sub: 'Expertise & Property Types', tag: 'EXPERTISE SETUP' },
  { num: 3, title: 'Services & Budget Range', sub: 'Specializations & Scale', tag: 'SERVICES & COMMERCIALS' },
  { num: 4, title: 'Portfolio & Credentials', sub: 'Images & PDF Documents', tag: 'PORTFOLIO & MEDIA' },
  { num: 5, title: 'Operations & Capacity', sub: 'Team & Timelines', tag: 'OPERATIONS & DELIVERY' },
  { num: 6, title: 'Client Process & Standards', sub: 'Execution & Deliverables', tag: 'MILESTONE PROTOCOL' },
  { num: 7, title: 'Verification & Documents', sub: 'COA, GST & Govt IDs', tag: 'STATUTORY & REGULATORY' },
  { num: 8, title: 'KAI Ranking Matrix', sub: 'Algorithmic Score', tag: 'ALGORITHMIC INTELLIGENCE' },
  { num: 9, title: 'Studio Completion', sub: 'Review & Activate', tag: 'FINAL VERIFICATION' },
] as const;

// ---- Stage 1 ----
export const WORK_MODELS = [
  { id: 'self', title: 'Self', subtitle: '(Individual Professional)', desc: 'For freelancers, individual architects, interior designers, consultants, and solo practitioners.', bullets: ['No registered company required', 'Work as an individual professional'], badge: 'Best for independent professionals and solo practitioners.', glyph: '◉' },
  { id: 'registered', title: 'Company Registered', subtitle: '', desc: 'For legally registered businesses with proper documentation.', bullets: ['Proprietorship, Partnership, LLP', 'Private Limited, OPC', 'Verified business with legal registration'], badge: 'Get verified, build trust and unlock premium project opportunities.', glyph: '▣' },
  { id: 'unregistered', title: 'Not Registered Company', subtitle: '', desc: 'For growing studios and teams operating without formal registration.', bullets: ['Small design studios', 'Family-run businesses', 'You can upgrade later'], badge: 'Start receiving projects and upgrade your profile anytime.', glyph: '◈' },
] as const;
export const ROLES = ['Architect', 'Interior Designer', 'Turnkey Company', 'Civil Contractor', 'Landscape Designer', 'Consultant', 'Builder / Developer', 'Other'];
export const OPERATION_TYPES = ['Individual', 'Partnership', 'LLP', 'Private Limited', 'Other'];
export const AVAILABLE_CITIES = ['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Goa', 'Kochi'];
export const establishedYears = () => {
  const current = new Date().getFullYear();
  return Array.from({ length: 40 }, (_, index) => String(current - index));
};

// ---- Stage 2 ----
export const EXPERTISE_OPTIONS = ['Architecture', 'Interior Design', 'Landscape Design', 'Turnkey Solutions', 'Project Management (PMC)', 'Design Consultancy', 'Renovation / Remodeling', 'Other'];
export const INDUSTRY_OPTIONS = ['Residential', 'Commercial', 'Hospitality', 'Healthcare', 'Retail', 'Education', 'Industrial', 'Institutional / Government', 'Other'];
export const PROPERTY_OPTIONS = ['Villas / Bungalows', 'Apartments', 'Farmhouses', 'Plots / Landscapes', 'Offices', 'Retail Spaces', 'Restaurants / Cafes', 'Hotels / Resorts', 'Others'];

// ---- Stage 3 ----
// Kraftnex taxonomy ids (mirrors partner-app lib/taxonomy/kraftnexTaxonomy.ts and
// backend/config/kraftnexTaxonomy.js) — what the KAI match engine matches a client's subtype against.
export const TAXONOMY_GROUPS: { label: string; entries: { id: string; name: string }[] }[] = [
  {
    label: 'Architecture',
    entries: [
      { id: 'residential_architecture', name: 'Residential Architecture' },
      { id: 'commercial_architecture', name: 'Commercial Architecture' },
      { id: 'institutional_architecture', name: 'Institutional Architecture' },
      { id: 'industrial_architecture', name: 'Industrial Architecture' },
      { id: 'infrastructure_architecture', name: 'Infrastructure / Specialized Architecture' },
    ],
  },
  {
    label: 'Interior',
    entries: [
      { id: 'residential_interior', name: 'Residential Interior' },
      { id: 'office_interior', name: 'Office / Corporate Interior' },
      { id: 'commercial_interior', name: 'Commercial Interior' },
      { id: 'retail_interior', name: 'Retail Interior' },
      { id: 'showroom_interior', name: 'Showroom Interior' },
      { id: 'hospitality_interior', name: 'Hospitality Interior' },
      { id: 'hotel_interior', name: 'Hotel Interior' },
      { id: 'resort_retreat_interior', name: 'Resort & Retreat Interior' },
      { id: 'restaurant_dining_interior', name: 'Restaurant & Dining Interior' },
      { id: 'cafe_lounge_interior', name: 'Café & Lounge Interior' },
      { id: 'healthcare_interior', name: 'Healthcare Interior' },
      { id: 'hospital_interior', name: 'Hospital Interior' },
      { id: 'clinic_medical_interior', name: 'Clinic & Medical Interior' },
      { id: 'diagnostic_consultation_interior', name: 'Diagnostic & Consultation Interior' },
      { id: 'wellness_care_interior', name: 'Wellness & Care Interior' },
      { id: 'educational_interior', name: 'Educational Interior' },
      { id: 'entertainment_interior', name: 'Entertainment Interior' },
      { id: 'sports_recreation_interior', name: 'Sports & Recreation Interior' },
      { id: 'cultural_public_interior', name: 'Cultural & Public Interior' },
      { id: 'religious_spiritual_interior', name: 'Religious & Spiritual Interior' },
      { id: 'transportation_interior', name: 'Transportation Interior' },
      { id: 'automotive_interior', name: 'Automotive Interior' },
      { id: 'industrial_interior', name: 'Industrial Interior' },
      { id: 'government_institutional_interior', name: 'Government & Institutional Interior' },
      { id: 'financial_professional_interior', name: 'Financial & Professional Interior' },
      { id: 'beauty_personal_care_interior', name: 'Beauty & Personal Care Interior' },
      { id: 'specialty_experience_interior', name: 'Specialty & Experience Interior' },
    ],
  },
  {
    label: 'Construction',
    entries: [
      { id: 'residential_construction', name: 'Residential Construction' },
      { id: 'commercial_construction', name: 'Commercial Construction' },
      { id: 'institutional_construction', name: 'Institutional Construction' },
      { id: 'industrial_construction', name: 'Industrial Construction' },
      { id: 'infrastructure_construction', name: 'Infrastructure Construction' },
    ],
  },
];
export const SERVICE_OPTIONS = ['Concept Design', 'Architecture Design', 'Interior Design', 'Landscape Design', 'Turnkey Solutions', 'Project Management (PMC)', 'Renovation / Remodeling', 'Consultation', '3D Visualization', 'Execution / Construction', 'Others'];
export const SPECIALIZATION_OPTIONS = ['Luxury Design', 'Modern / Contemporary', 'Minimalist', 'Traditional / Classic', 'Industrial', 'Scandinavian', 'Bohemian', 'Others'];
export const MAX_SPECIALIZATIONS = 3;
export const BUDGET_OPTIONS = ['Up to ₹20 Lakh', '₹20 L - ₹50 L', '₹50 L - ₹1 Cr', '₹1 Cr - ₹5 Cr', 'Above ₹5 Cr'];
export const SIZE_OPTIONS = [
  { id: 'Small', label: 'Small (Up to 2,000 sq.ft.)' },
  { id: 'Medium', label: 'Medium (2,000 - 5,000 sq.ft.)' },
  { id: 'Large', label: 'Large (5,000 - 10,000 sq.ft.)' },
  { id: 'Ultra Large', label: 'Ultra Large (Above 10,000 sq.ft.)' },
];
export const TIER_OPTIONS = [
  { id: 'Standard', label: 'Standard', desc: 'Up to ₹15 Lakh projects' },
  { id: 'Premium', label: 'Premium', desc: '₹15 - 30 Lakh projects' },
  { id: 'Elite', label: 'Elite', desc: 'Above ₹30 Lakh luxury projects' },
];

// ---- Stage 5 ----
export const TEAM_FIELDS: { field: keyof OnboardingData['team']; label: string }[] = [
  { field: 'total', label: 'Total Team Size' },
  { field: 'architects', label: 'Architects' },
  { field: 'designers', label: 'Designers' },
  { field: 'civilEngineers', label: 'Civil Engineers' },
  { field: 'siteEngineers', label: 'Site / Project' },
  { field: 'otherStaff', label: 'Other Staff' },
];
export const PROJECT_CAPACITY_OPTIONS = ['1 - 3 Projects', '4 - 6 Projects', '7 - 10 Projects', '10+ Projects'];
export const TIMELINE_OPTIONS = ['1 - 3 Months', '3 - 6 Months', '6 - 12 Months', '12 - 18 Months', '18+ Months'];
export const WORK_MODES = ['On-site', 'Online', 'Hybrid'];
export const OPERATING_CITIES = ['Hyderabad', 'Bengaluru', 'Pune', 'Mumbai', 'Delhi NCR'];
export const ENGAGEMENT_OPTIONS = ['Design Only', 'Turnkey', 'Design + Execution', 'PMC / Consulting'];
export const SUPPORT_OPTIONS = ['Yes, always', 'On request', 'No'];

// ---- Stage 6 ----
export const DEFAULT_PROCESS_STEPS = ['Initial Consultation', 'Concept & Briefing', 'Design Development', 'Approvals & Documentation', 'Execution / Construction', 'Handover & After Support'];
export const COMM_OPTIONS = ['Email', 'Phone Call', 'WhatsApp', 'Video Call', 'In-person Meeting', 'Other'];
export const INVOLVEMENT_OPTIONS = [
  'I prefer to lead the process and keep clients updated at key milestones',
  'I like to collaborate closely and take client feedback at every stage',
  'I prefer clients to be minimally involved',
];
export const DIFFERENTIATOR_OPTIONS = ['Clear Communication', 'Timely Delivery', 'Transparent Process', 'High Quality Design', 'Attention to Detail', 'Post-Handover Support'];

// ---- Stage 7 ----
export interface DocType { id: string; name: string; subtitle: string; required: boolean; autoVerified: boolean; photoOnly: boolean }
export function documentTypes(data: OnboardingData): DocType[] {
  const isGstVerified = Boolean(data.gstDetails?.isVerified && data.gstDetails?.gstin);
  const isIndividual = data.workModel === 'self';
  return [
    { id: 'gst', name: isIndividual ? 'GST Certificate (Optional)' : 'GST Certificate', subtitle: isGstVerified ? `GSTIN: ${data.gstDetails?.gstin} • Verified Active` : isIndividual ? 'Not required for individual practitioners' : 'PDF, JPG, PNG', required: !isIndividual && !isGstVerified, autoVerified: isGstVerified, photoOnly: false },
    { id: 'pan', name: 'PAN Card', subtitle: data.gstDetails?.pan ? `PAN: ${data.gstDetails.pan}` : 'PDF, JPG, PNG', required: true, autoVerified: false, photoOnly: false },
    { id: 'registration', name: isIndividual ? 'ID / Business Proof' : 'Business Registration', subtitle: isGstVerified && data.gstDetails?.constitution ? data.gstDetails.constitution : 'PDF, JPG, PNG', required: !isIndividual, autoVerified: false, photoOnly: false },
    { id: 'license', name: 'Professional License (If any)', subtitle: 'PDF, JPG, PNG', required: false, autoVerified: false, photoOnly: false },
    { id: 'insurance', name: 'Insurance Certificate (If any)', subtitle: 'PDF, JPG, PNG', required: false, autoVerified: false, photoOnly: false },
    { id: 'awards', name: 'Awards & Recognition (If any)', subtitle: 'PDF, JPG, PNG', required: false, autoVerified: false, photoOnly: false },
    { id: 'certifications', name: 'Professional Certifications (If any)', subtitle: 'PDF, JPG, PNG', required: false, autoVerified: false, photoOnly: false },
    { id: 'officePhotos', name: 'Office / Studio Photos', subtitle: 'JPG, PNG', required: false, autoVerified: false, photoOnly: true },
    { id: 'teamPhotos', name: 'Team Photos', subtitle: 'JPG, PNG', required: false, autoVerified: false, photoOnly: true },
    { id: 'other', name: 'Other Documents (Optional)', subtitle: 'PDF, JPG, PNG', required: false, autoVerified: false, photoOnly: false },
  ];
}

// ---- Stage 8 / 9 scoring (same engine the desktop runs on both stages) ----
export interface KaiScore {
  score: number;
  isLow: boolean;
  rankTag: string;
  matrix: { title: string; rating: number; score: number }[];
  portfolioItems: number;
  verifiedDocs: number;
  // Each term of the score, so the screen can show what moved it (same numbers the total uses).
  drivers: { label: string; points: number; max: number }[];
}

export function computeKaiScore(data: OnboardingData): KaiScore {
  const businessName = (data.businessName || '').trim();
  const verifiedDocs = Object.keys(data.verifiedDocs || {}).length;
  const portfolioItems = (data.portfolioImagesCount || 0) + (data.pdfUploaded ? 1 : 0) + (data.websiteUrl ? 1 : 0) + (data.instagramUrl ? 1 : 0);
  const suspiciousName = businessName.length < 3 || /^(test|asdf|qwerty|1234|abc|xxx|none|nil)$/i.test(businessName);

  const servicePoints = Math.min(10, (data.services || []).length * 2);
  const specPoints = Math.min(8, (data.specializations || []).length * 2);
  const docPoints = Math.min(10, verifiedDocs * 3);
  const portfolioPoints = Math.min(6, portfolioItems * 2);
  let raw = 75 + servicePoints + specPoints + docPoints + portfolioPoints;
  if (suspiciousName) raw -= 18;
  if (verifiedDocs === 0) raw -= 15;
  if (portfolioItems === 0) raw -= 12;
  if ((data.team?.total || 0) === 0) raw -= 8;

  const score = Math.min(98, Math.max(38, Math.round(raw)));
  const isLow = score < 70;
  const rankTag = score >= 92 ? 'Top 5%' : score >= 82 ? 'Top 10%' : score >= 70 ? 'Top 25%' : 'Needs Verification';

  const selections = Array.from(new Set([
    ...(data.primaryExpertise || []),
    ...(data.specializations || []),
    ...(data.services || []),
    ...(data.propertyTypes || []),
  ]));
  const categories = ['Architecture - Residential', 'Luxury Villas', 'Interior Design - Residential', 'Turnkey Projects', 'Landscape Design', 'Commercial Projects', 'Healthcare Projects', 'Industrial Projects'];
  const matrix = categories.map((title, index) => {
    const matches = selections.some(item => title.toLowerCase().includes(item.toLowerCase()) || item.toLowerCase().includes(title.toLowerCase().split(' ')[0]));
    const cap = isLow ? 72 : 98;
    const itemScore = matches ? Math.max(isLow ? 55 : 82, cap - index * 3) : Math.max(20, 60 - index * 6);
    const rating = itemScore >= 90 ? 5 : itemScore >= 80 ? 4.5 : itemScore >= 60 ? 3.5 : itemScore >= 40 ? 2.5 : 1.5;
    return { title, rating, score: itemScore };
  });

  const drivers = [
    { label: 'Services offered', points: servicePoints, max: 10 },
    { label: 'Specializations', points: specPoints, max: 8 },
    { label: 'Verification documents', points: docPoints, max: 10 },
    { label: 'Portfolio proof', points: portfolioPoints, max: 6 },
  ];

  return { score, isLow, rankTag, matrix, portfolioItems, verifiedDocs, drivers };
}

export const toggleItem = (list: string[] | undefined, value: string) => {
  const current = list || [];
  return current.includes(value) ? current.filter(item => item !== value) : [...current, value];
};

export const joinOrNone =(items?: string[]) => (items && items.length ? items.join(', ') : 'Not Specified');

// ---- Loading a saved draft ----
export function hydrateFromProfile(profile: ProfessionalProfileRecord): OnboardingData {
  const saved = (profile.onboardingData || {}) as Partial<OnboardingData>;
  const base = { ...getInitialData(), ...saved };
  return {
    ...base,
    businessName: profile.companyName || profile.businessName || saved.businessName || '',
    cities: profile.city ? [profile.city] : (saved.cities || []),
    budgetRanges: profile.acceptedBudgetCategories?.length ? profile.acceptedBudgetCategories : (saved.budgetRanges || []),
    tier: profile.membershipLevel || saved.tier || '',
    industries: profile.industries?.length ? profile.industries : (saved.industries || []),
    portfolioImages: profile.portfolioImages?.length ? profile.portfolioImages : (saved.portfolioImages || []),
    establishedYear: saved.establishedYear || (profile.experience ? String(new Date().getFullYear() - profile.experience) : ''),
  };
}

export function isProfileComplete(profile: ProfessionalProfileRecord): boolean {
  return Boolean(profile.isOnboarded || (profile.onboardingStage && profile.onboardingStage >= TOTAL_STAGES));
}

// ---- Per-stage "can continue" rules (the desktop's) ----
export function stageProblems(stage: number, data: OnboardingData): string[] {
  if (stage === 1) {
    return [
      !data.workModel && 'choose how you work',
      !data.role && 'pick what best describes you',
      !data.businessName.trim() && 'enter your business name',
      data.workModel === 'registered' && !data.gstDetails?.isVerified && 'verify your GST number',
      !data.acceptedPartnerTerms && 'accept the Partner Terms and Privacy Policy',
    ].filter(Boolean) as string[];
  }
  if (stage === 2) return data.primaryExpertise.length ? [] : ['pick at least one area of expertise'];
  if (stage === 3) return [!data.services.length && 'select at least one service', !data.tier && 'choose your tier'].filter(Boolean) as string[];
  return [];
}

// ---- Uploads ----
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function normalizeMime(mimeType: string | null | undefined, fileName: string): string {
  const lower = (mimeType || '').toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  if (lower) return lower;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export const generatedFileName = (prefix: string) => `${prefix}-${Date.now()}.jpg`;

export interface PickedFile { uri: string; name: string; mimeType: string; size?: number | null }

// Same two-path upload as the desktop: presigned direct-to-storage first, then the server-side
// upload if the direct path fails. Returns the public URL.
export async function uploadStudioFile(file: PickedFile, entityType: 'designerPortfolio' | 'designerPortfolioDocument' | 'designerPortfolioProject' | 'chatAttachment', entityId?: string): Promise<string> {
  const isPdf = file.mimeType === 'application/pdf';
  if (!isPdf && !IMAGE_TYPES.includes(file.mimeType)) {
    throw new Error('Only JPG, PNG, WEBP images and PDF files are supported.');
  }
  try {
    const init = await partnerApi.initImageUpload({ entityType, entityId, fileName: file.name, fileType: file.mimeType, fileSize: file.size ?? undefined });
    const blob = await (await fetch(file.uri)).blob();
    const response = await fetch(init.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.mimeType }, body: blob });
    if (!response.ok) throw new Error(`Upload to storage failed with status ${response.status}`);
    const done = await partnerApi.completeImageUpload(init.imageId);
    return done.image.url;
  } catch {
    try {
      const media = await partnerApi.uploadMedia(file, entityType === 'designerPortfolioProject' ? 'projects' : 'portfolios');
      return media.publicUrl;
    } catch (error) {
      throw new Error(error instanceof PartnerApiError ? error.message : 'Upload failed. Check your connection and try again.');
    }
  }
}

export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.hostname.includes('.') ? withScheme : null;
  } catch {
    return null;
  }
}
