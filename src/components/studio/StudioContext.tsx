import { createContext, useContext } from 'react';
import type { ProfessionalProfileRecord } from '../../lib/partnerApi';

// The signed-in studio, loaded once by the dashboard layout and shared with every section.
export interface StudioProfile extends ProfessionalProfileRecord {
  name?: string;
  email?: string;
  phone?: string;
  availability?: string;
  rating?: number;
  reviewsCount?: number;
  profilePhoto?: string;
  logoUrl?: string;
  city?: string;
}

export interface StudioContextValue {
  profile: StudioProfile;
  studioName: string;
  ownerName: string;
  refresh: () => Promise<void>;
  patchProfile: (fields: Partial<StudioProfile>) => void;
}

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useStudio must be used inside the studio dashboard layout.');
  return value;
}
