import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants, { AppOwnership } from 'expo-constants';

export function isExpoGo(): boolean {
  return isRunningInExpoGo() || Constants.appOwnership === AppOwnership.Expo;
}

/**
 * Whether a native map can be shown. On Android, react-native-maps throws a fatal "API key not found"
 * error the moment a MapView mounts if the build has no Google Maps key, which closes the whole app.
 * app.config.js sets extra.googleMapsConfigured when GOOGLE_MAPS_API_KEY was present at build time.
 */
export function mapsAvailable(): boolean {
  if (isExpoGo()) return false;
  if (Platform.OS !== 'android') return true;
  return Constants.expoConfig?.extra?.googleMapsConfigured === true;
}
