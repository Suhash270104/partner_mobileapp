import * as Location from 'expo-location';
import { JobPhotoPhase, partnerApi, PartnerApiError, TechnicianBookingRecord } from './partnerApi';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export interface PickedPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

// Best-effort geotag: never blocks the upload if the technician denied location permission.
async function currentGeo(): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return { lat: null, lng: null };
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : { lat: null, lng: null };
  } catch {
    return { lat: null, lng: null };
  }
}

// Mirrors the desktop three-step flow: presigned init, direct PUT to storage, then complete
// (the backend verifies the object landed before attaching it to the booking).
export async function uploadJobPhoto(photo: PickedPhoto, bookingId: string, phase: JobPhotoPhase): Promise<TechnicianBookingRecord> {
  // The backend only accepts jpeg/png/webp/avif. Camera shots are jpeg whatever the device reports (e.g. image/jpg).
  const fileType = photo.mimeType && ALLOWED_PHOTO_TYPES.includes(photo.mimeType) ? photo.mimeType : 'image/jpeg';
  const fileName = `${phase}-${Date.now()}.${fileType === 'image/jpeg' ? 'jpg' : fileType.split('/')[1]}`;
  const init = await partnerApi.initTechnicianJobPhoto(bookingId, { phase, fileName, fileType, fileSize: photo.fileSize ?? undefined });

  const blob = await (await fetch(photo.uri)).blob();
  let response: Response;
  try {
    response = await fetch(init.uploadUrl, { method: 'PUT', headers: { 'Content-Type': fileType }, body: blob });
  } catch {
    throw new PartnerApiError('Network error during upload. Check your connection and try again.', 0, 'NETWORK');
  }
  if (!response.ok) throw new PartnerApiError(`Upload to storage failed with status ${response.status}`, response.status);

  const geo = await currentGeo();
  const { booking } = await partnerApi.completeTechnicianJobPhoto(bookingId, init.imageId, { phase, ...geo });
  return booking;
}
