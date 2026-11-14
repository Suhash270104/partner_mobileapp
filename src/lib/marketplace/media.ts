import * as ImagePicker from 'expo-image-picker';
import { LIMITS } from './constants';
import { merchantApi } from './api';

export type MediaPurpose = 'product' | 'logo' | 'banner';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Upload one picked image through the 3-step media flow (init → PUT to storage → complete). Returns the hosted URL. */
async function uploadAsset(asset: ImagePicker.ImagePickerAsset, purpose: MediaPurpose): Promise<string> {
  const mime = asset.mimeType || 'image/jpeg';
  if (!ALLOWED.includes(mime)) throw new Error('Use a JPG, PNG or WebP image.');
  if (asset.fileSize && asset.fileSize > MAX_BYTES) throw new Error('Each image must be 10 MB or smaller.');
  const init = await merchantApi.initMedia({ purpose, fileName: asset.fileName || `${purpose}-${Date.now()}.jpg`, fileType: mime, fileSize: asset.fileSize });
  const file = await fetch(asset.uri);
  if (!file.ok) throw new Error('Could not read the selected image.');
  const put = await fetch(String(init.uploadUrl), { method: 'PUT', headers: { 'Content-Type': mime }, body: await file.blob() });
  if (!put.ok) throw new Error('Image upload failed. Please try again.');
  const image = await merchantApi.completeMedia(String(init.imageId));
  const url = image.mediumUrl || image.url;
  if (!url) throw new Error('Image upload failed. Please try again.');
  return url;
}

/** Opens the gallery and uploads the selection. Returns [] if the person cancels. */
export async function pickAndUploadImages(purpose: MediaPurpose, max = 1): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access in Settings to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: max > 1, selectionLimit: Math.max(1, max), quality: 0.9 });
  if (result.canceled) return [];
  const urls: string[] = [];
  for (const asset of result.assets.slice(0, max)) urls.push(await uploadAsset(asset, purpose));
  return urls;
}

export const PHOTO_LIMIT = LIMITS.photosUi;
