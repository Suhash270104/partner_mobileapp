import { partnerApi, PartnerApiError, type TechnicianProfileRecord } from './partnerApi';
import { isProfileComplete } from './professionalOnboarding';

/** Where a signed-in person goes when they open a workspace. One decision for every entry point.
 *  open   = finished: the dashboard.      resume = started elsewhere (e.g. the website): the wizard at the saved step.
 *  start  = no workspace yet: the wizard.  signedOut = sign in first.   error = could not tell (offline, server error):
 *  never guess, never open a wizard. */
export type LaunchTarget =
  | { kind: 'open' | 'resume' | 'start'; path: string }
  | { kind: 'signedOut' }
  | { kind: 'blocked'; message: string }
  | { kind: 'error'; message: string };

/** 'none' = the server has no such workspace for this person; 'signedOut' = nobody is signed in; null = a real failure.
 *  A signed-in account without the role also answers 401, so a live session decides which of the two it is. */
async function classify(error: unknown, roleType: 'designer' | 'technician'): Promise<'none' | 'signedOut' | 'blocked' | null> {
  if (!(error instanceof PartnerApiError)) return null;
  if (error.status === 404) return 'none';
  if (error.status === 401 || error.status === 403) {
    try {
      const { user } = await partnerApi.session();
      if (!user) return 'signedOut';
      // The backend hides rejected and suspended roles behind the same 401, but the session still lists their status.
      const status = user.roles?.find(role => role.type === roleType)?.status;
      return status === 'rejected' || status === 'suspended' ? 'blocked' : 'none';
    } catch { return null; }
  }
  return null;
}
const BLOCKED_COPY = (what: string) => `Your ${what} was not approved or has been suspended by KraftNex. Contact support from the Help section to find out why and what to do next.`;
const failure = (error: unknown, what: string): LaunchTarget => ({ kind: 'error', message: error instanceof Error && error.message ? error.message : `Could not load your ${what}. Check your connection and try again.` });

async function loadStudioLaunch(): Promise<LaunchTarget> {
  try {
    const studio = await partnerApi.professionalProfile();
    return isProfileComplete(studio)
      ? { kind: 'open', path: '/professional/dashboard' }
      : { kind: (studio.onboardingStage ?? 1) > 1 ? 'resume' : 'start', path: '/professional/onboarding' };
  } catch (error) {
    const outcome = await classify(error, 'designer');
    if (outcome === 'blocked') return { kind: 'blocked', message: BLOCKED_COPY('studio') };
    if (outcome === 'none') return { kind: 'start', path: '/professional/onboarding' };
    if (outcome === 'signedOut') return { kind: 'signedOut' };
    return failure(error, 'studio');
  }
}

async function loadTechnicianLaunch(): Promise<LaunchTarget> {
  try {
    const { technician } = await partnerApi.technicianProfile();
    return isTechnicianSetupDone(technician)
      ? { kind: 'open', path: '/technician/dashboard' }
      : { kind: 'resume', path: '/technician/setup' };
  } catch (error) {
    const outcome = await classify(error, 'technician');
    if (outcome === 'blocked') return { kind: 'blocked', message: BLOCKED_COPY('technician profile') };
    if (outcome === 'none') return { kind: 'start', path: '/technician/setup' };
    if (outcome === 'signedOut') return { kind: 'signedOut' };
    return failure(error, 'technician profile');
  }
}

// The home screen asks for the same answer from several places at once (tile status, auto-open, a tap).
// Calls made while one is already running share its result instead of each hitting the server; nothing
// is kept afterwards, so a later call always sees fresh data.
function shareInFlight(load: () => Promise<LaunchTarget>): () => Promise<LaunchTarget> {
  let pending: Promise<LaunchTarget> | null = null;
  return () => {
    if (!pending) pending = load().finally(() => { pending = null; });
    return pending;
  };
}
export const resolveStudioLaunch = shareInFlight(loadStudioLaunch);
export const resolveTechnicianLaunch = shareInFlight(loadTechnicianLaunch);

// Remembers, for this app run, which signed-in person the home screen has already sent straight to
// their workspace. Going back to the home screen afterwards must NOT bounce them in again, and
// signing out clears it so the next sign-in opens the workspace once more.
let openedFor: string | null = null;
export const hasAutoOpened = (userId: string) => openedFor === userId;
export const markAutoOpened = (userId: string) => { openedFor = userId; };
export const resetAutoOpen = () => { openedFor = null; };

/** True once a technician has really filled in their setup. The server only stamps
 * `onboardingSubmittedAt` when the final Submit button of the 11-step wizard is pressed, so an
 * account whose details are all saved (or that was set up elsewhere) can still have it empty.
 * Such a person must open the dashboard, not the wizard again. */
export function isTechnicianSetupDone(technician: TechnicianProfileRecord | null | undefined): boolean {
  if (!technician) return false;
  if (technician.onboardingSubmittedAt) return true;
  const hasServices = (technician.servicesOffered?.length ?? 0) > 0;
  const hasBasePin = technician.coordinates?.lat != null && technician.coordinates?.lng != null;
  const hasToolsOrPayout = (technician.equipmentChecklist?.length ?? 0) > 0
    || Boolean(technician.bankDetails?.accountNumber || technician.bankDetails?.upiId);
  // KN Certified partners must also have given proof of address; independents may skip documents.
  const proof = technician.documents?.addressProof;
  const hasProof = Boolean(proof?.documentUrl || proof?.documentNumber);
  return hasServices && hasBasePin && hasToolsOrPayout && (technician.type !== 'KN_CERTIFIED' || hasProof);
}
