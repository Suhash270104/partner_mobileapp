import { useState } from 'react';
import { Image, View, type ImageProps, type StyleProp, type ImageStyle } from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
const ORIGIN = API_BASE.replace(/\/api$/, '');

/**
 * Backend image URLs arrive in several shapes. React Native's <Image> renders every bad one as a silent blank:
 *  - relative paths ("/uploads/a.jpg")  -> resolved against the API origin
 *  - protocol-less ("//cdn.x/a.jpg")     -> https
 *  - plain http:// (blocked by Android release builds' cleartext policy) -> https
 *  - unencoded spaces                    -> encoded
 */
export function resolveImageUrl(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  let url = value.trim();
  if (!url) return null;
  if (/^(file|content|data|blob|asset):/i.test(url)) return url;
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) { if (!ORIGIN) return null; url = `${ORIGIN}${url}`; }
  else if (!/^https?:\/\//i.test(url)) { if (!ORIGIN) return null; url = `${ORIGIN}/${url}`; }
  if (/^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.|10\.|192\.168\.)/i.test(url)) url = url.replace(/^http:/i, 'https:');
  return url.replace(/ /g, '%20');
}

type Props = Omit<ImageProps, 'source'> & { uri?: string | null; style?: StyleProp<ImageStyle>; fallback?: React.ReactNode };

/** Image that normalizes backend URLs and shows a neutral placeholder (or `fallback`) instead of a blank box when loading fails. */
export function RemoteImage({ uri, style, fallback, onError, ...rest }: Props) {
  const resolved = resolveImageUrl(uri);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!resolved || failedUri === resolved) {
    if (__DEV__ && uri && resolved) console.warn('[image] failed to load', resolved, '(raw:', uri, ')');
    return <>{fallback ?? <View style={[style as object, { backgroundColor: '#E5E7EB' }]} />}</>;
  }
  return (
    <Image
      {...rest}
      source={{ uri: resolved }}
      style={style}
      onError={event => {
        if (__DEV__) console.warn('[image] failed to load', resolved, event.nativeEvent?.error);
        setFailedUri(resolved);
        onError?.(event);
      }}
    />
  );
}
