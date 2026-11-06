import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { partnerApi } from './partnerApi';

// Shares the technician's position while they're online so dispatch measures from where they
// actually are (backend only trusts a fix for 10 minutes). Nothing runs while offline.
const MIN_INTERVAL_MS = 60 * 1000;
const MIN_MOVE_M = 250;
const KEEPALIVE_MS = 4 * 60 * 1000;

export type LiveLocationState = 'off' | 'sharing' | 'denied' | 'unsupported';

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useLiveLocationSharing(online: boolean): LiveLocationState {
  const [state, setState] = useState<LiveLocationState>('off');

  useEffect(() => {
    if (!online) return;
    let active = true;
    let last: { lat: number; lng: number; at: number } | null = null;
    let subscription: Location.LocationSubscription | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;

    const send = (position: Location.LocationObject) => {
      const here = { lat: position.coords.latitude, lng: position.coords.longitude };
      const now = Date.now();
      if (last && now - last.at < MIN_INTERVAL_MS && metresBetween(last, here) < MIN_MOVE_M) return;
      last = { ...here, at: now };
      setState('sharing');
      partnerApi.updateTechnicianLocation({ ...here, accuracy: position.coords.accuracy ?? undefined }).catch(() => {});
    };

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (!permission.granted) { setState('denied'); return; }
        subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: MIN_INTERVAL_MS, distanceInterval: MIN_MOVE_M }, send);
        if (!active) { subscription.remove(); return; }
        keepAlive = setInterval(() => {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(send).catch(() => {});
        }, KEEPALIVE_MS);
      } catch {
        if (active) setState('unsupported');
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
      if (keepAlive) clearInterval(keepAlive);
    };
  }, [online]);

  return online ? state : 'off';
}
