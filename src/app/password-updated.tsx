import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

const LOGO = require('../../assets/kraftnex-logo-transparent.png');

export default function PasswordUpdatedScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.screen, Platform.OS === 'web' && styles.webScreen]}>
        <Image
          source={LOGO}
          resizeMode="contain"
          accessibilityLabel="Kraftnex"
          style={styles.logo}
        />

        <View style={styles.content}>
          <View style={styles.confirmation}>
            <View style={styles.successHalo}>
              <View style={styles.successCircle}>
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path d="m6.5 12.5 3.6 3.6 7.5-8" fill="none" stroke="#86efc2" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusIcon}><Text style={styles.statusIconText}>↻</Text></View>
              <Text style={styles.statusText}>AUTHENTICATION STATE</Text>
            </View>

            <Text style={styles.title}>Password updated</Text>
            <Text style={styles.description}>
              Your password has been updated. You can{`\n`}now sign in with your new credentials.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            style={styles.signInButton}
            onPress={() => router.replace('/login' as never)}
          >
            <Text style={styles.signInText}>Sign in  →</Text>
          </Pressable>

          <View style={styles.footer}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Where People &amp; Spaces Connect.</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fbf9ff' },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#fbf9ff', paddingHorizontal: 7 },
  webScreen: { shadowColor: '#1a1722', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  logo: { width: 62, height: 22, marginTop: 4, marginLeft: 1 },
  content: { flex: 1, alignItems: 'center' },
  confirmation: { alignItems: 'center', marginTop: 20 },
  successHalo: { width: 58, height: 58, borderRadius: 30, backgroundColor: '#c9efdf', alignItems: 'center', justifyContent: 'center' },
  successCircle: { width: 37, height: 37, borderRadius: 20, backgroundColor: '#0a3a2e', alignItems: 'center', justifyContent: 'center' },
  statusBadge: { height: 19, borderRadius: 11, paddingHorizontal: 9, backgroundColor: '#e7eaff', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 17 },
  statusIcon: { width: 10, height: 10, borderRadius: 6, backgroundColor: '#fff1df', alignItems: 'center', justifyContent: 'center' },
  statusIconText: { color: '#d77a3e', fontSize: 8, fontWeight: '700', lineHeight: 10 },
  statusText: { color: '#d06435', fontSize: 7, fontWeight: '700', letterSpacing: 0.65 },
  title: { color: '#101b2b', fontSize: 20, lineHeight: 26, fontWeight: '500', textAlign: 'center', marginTop: 10 },
  description: { color: '#64768a', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  signInButton: { height: 38, width: '100%', borderRadius: 9, backgroundColor: '#104537', alignItems: 'center', justifyContent: 'center', marginTop: 62 },
  signInText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 'auto', paddingBottom: 4 },
  footerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#deb756', marginBottom: 8 },
  footerText: { color: '#77869a', textAlign: 'center', fontSize: 8 },
});
