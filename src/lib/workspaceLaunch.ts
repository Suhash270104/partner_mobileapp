import type { TechnicianProfileRecord } from './partnerApi';

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
