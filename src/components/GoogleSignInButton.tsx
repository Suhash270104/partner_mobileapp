/* eslint-disable @typescript-eslint/no-require-imports -- native/web Google modules are loaded on demand, as in the main app. */
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from './AppText';
import Svg, { Path } from 'react-native-svg';

type Props = {
  clientId?: string;
  disabled?: boolean;
  onIdToken: (token: string) => Promise<void>;
  onError: (message: string) => void;
};

// The backend verifies the Google ID token against its one web client ID, so the native sign-in is
// configured with that same web client. The Android OAuth client (package + SHA-1) only has to exist
// in Google Cloud so Google trusts this app - it is never referenced here.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

export default function GoogleSignInButton({ clientId, disabled = false, onIdToken, onError }: Props) {
  if (Platform.OS === 'web') {
    if (!clientId) return <PlainButton disabled={disabled} onPress={() => onError('Google sign in is not configured for web. Add its OAuth client ID to partner_mobileapp/.env and restart Expo.')} />;
    return <WebGoogleButton clientId={clientId} disabled={disabled} onIdToken={onIdToken} onError={onError} />;
  }
  return <NativeGoogleButton disabled={disabled} onIdToken={onIdToken} onError={onError} />;
}

function NativeGoogleButton({ disabled, onIdToken, onError }: Omit<Props, 'clientId'>) {
  async function start() {
    if (!WEB_CLIENT_ID) {
      onError('Google sign in is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to partner_mobileapp/.env and rebuild the app.');
      return;
    }
    let GoogleSigninModule: typeof import('@react-native-google-signin/google-signin');
    try {
      // Loaded on demand so Expo Go (which lacks the native module) can still open the screen.
      GoogleSigninModule = require('@react-native-google-signin/google-signin');
    } catch {
      onError('Google sign in needs a development build of the app. It is not available in Expo Go.');
      return;
    }
    const { GoogleSignin, statusCodes } = GoogleSigninModule;
    try {
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: ['email', 'profile'] });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return; // the person closed the Google sheet
      const idToken = result.data.idToken;
      if (!idToken) throw new Error('Google did not return an ID token. Check that the web client ID is correct.');
      await onIdToken(idToken);
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) { onError('Google Play Services is missing or out of date on this device.'); return; }
      const message = cause instanceof Error ? cause.message : 'Google sign in could not be started.';
      // DEVELOPER_ERROR means the Android OAuth client (package name + SHA-1) does not match this build.
      onError(/DEVELOPER_ERROR|10:/i.test(message) ? 'Google rejected this build. Check the Android OAuth client package name and SHA-1 in Google Cloud.' : message);
    }
  }

  return <PlainButton disabled={disabled} onPress={() => void start()} />;
}

function WebGoogleButton({ clientId, disabled = false, onIdToken, onError }: Props & { clientId: string }) {
  const Google = require('expo-auth-session/providers/google');
  const { ResponseType } = require('expo-auth-session');
  const [, , promptAsync] = Google.useAuthRequest({
    webClientId: clientId,
    responseType: ResponseType.IdToken,
    scopes: ['openid', 'email', 'profile'],
  });

  async function start() {
    try {
      const result = await promptAsync();
      if (result.type !== 'success') return;
      const idToken = result.authentication?.idToken ?? result.params?.id_token;
      if (!idToken) throw new Error('Google did not return an ID token. Check the web OAuth client configuration.');
      await onIdToken(idToken);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Google sign in could not be started.');
    }
  }

  return <PlainButton disabled={disabled} onPress={() => void start()} />;
}

function PlainButton({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <GoogleMark />
      <Text style={styles.label}>Continue with Google</Text>
    </Pressable>
  );
}

function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.1A6.96 6.96 0 0 1 5.47 12c0-.73.13-1.43.36-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
      <Path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.65 2.84C6.71 7.3 9.14 5.37 12 5.37z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: { height: 52, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 13, shadowColor: '#4b3a63', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  label: { color: '#101d2d', fontSize: 14, fontWeight: '500' },
  disabled: { opacity: 0.62 },
});
