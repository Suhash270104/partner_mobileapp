import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { isExpoGo } from './runtime';
import { partnerApi } from './partnerApi';

// Keeps the technician's position fresh while the app is in the background (phone locked, another
// app open). Dispatch only trusts a fix for 10 minutes, so without this an online technician who
// pockets the phone drops out of matching. Android needs a visible "sharing location" notification
// (foreground service) for this; it only runs while the technician is online.
//
// The task must be defined when the JS bundle loads, not when a screen mounts, because Android can
// start the app headless to deliver a location. technicianLiveLocation.ts and _layout.tsx import
// this file for that reason.
export const TECHNICIAN_LOCATION_TASK = 'kraftnex-technician-live-location';

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TECHNICIAN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const latest = data?.locations?.[data.locations.length - 1];
  if (!latest) return;
  try {
    await partnerApi.updateTechnicianLocation({
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? undefined,
    });
  } catch {
    /* signed out, offline or the token is being renewed: the next fix tries again */
  }
});

export type BackgroundLocationResult = 'started' | 'denied' | 'unsupported';

// Background location is not available in Expo Go or on the web, only in a real build.
const supported = () => (Platform.OS === 'android' || Platform.OS === 'ios') && !isExpoGo();

export async function startBackgroundLocation(): Promise<BackgroundLocationResult> {
  if (!supported()) return 'unsupported';
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return 'denied';
    // Android asks for "Allow all the time" as a separate step after the in-use permission.
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) return 'denied';
    if (await Location.hasStartedLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK)) return 'started';
    await Location.startLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60 * 1000,
      distanceInterval: 250,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'You are online on Kraftnex Partner',
        notificationBody: 'Sharing your location so nearby jobs can reach you. Go offline to stop.',
        notificationColor: '#2563eb',
        // Swiping the app away ends sharing, so a technician who closes the app is not tracked.
        killServiceOnDestroy: true,
      },
    });
    return 'started';
  } catch {
    return 'unsupported';
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  if (!supported()) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK);
    }
  } catch {
    /* already stopped */
  }
}
