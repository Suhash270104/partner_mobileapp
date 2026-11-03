# Kraftnex Partner

Expo React Native app for Kraftnex business partners.

## Run locally

```powershell
Copy-Item .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `.env` to the Kraftnex API URL reachable from the device, including its `/api` prefix. `EXPO_PUBLIC_PUBLIC_SITE_URL` and `EXPO_PUBLIC_PARTNER_SITE_URL` point to the existing web properties used by links to flows not yet ported to mobile. Keep `.env` local; only public configuration belongs there.

The technician service-area map uses `react-native-maps` and `expo-location`. For Android EAS builds, set `GOOGLE_MAPS_API_KEY` in the EAS environment (or local `.env` for local native builds); it is intentionally not an `EXPO_PUBLIC_` variable.

Open the QR code with Expo Go for the app. Build a development client with EAS when the app adds native modules that Expo Go does not include.

## EAS builds

This repository is linked to the Expo EAS project `@suhash270104/kraftnex-partner`. Configure Android FCM V1 credentials in EAS, then run `npx eas-cli@latest build -p android --profile preview` and install the generated APK. Remote push notifications are not available in Expo Go on Android; use the EAS APK to receive them.
