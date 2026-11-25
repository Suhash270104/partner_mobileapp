import { ReactNode, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const API_ORIGIN = /^https?:\/\/[^/]+/i.exec(process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '')?.[0] ?? '';

/** The address to load a stored image from. For display only: never save the result back to a record. */
function displayImageUrl(value: string) {
  const url = value.trim().replace(/ /g, '%20');
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
}

/** A hosted image that shows `fallback` instead of a blank box when it is missing or cannot be loaded. */
export function RemoteImage({ uri, style, fallback }: { uri?: string; style: StyleProp<ImageStyle>; fallback: ReactNode }) {
  // Remember which address failed, so a different one is tried afresh.
  const [failed, setFailed] = useState('');
  const url = uri ? displayImageUrl(uri) : '';
  if (!url || failed === url) return <>{fallback}</>;
  return <Image source={{ uri: url }} style={style} resizeMode="cover" onError={() => setFailed(url)} />;
}
