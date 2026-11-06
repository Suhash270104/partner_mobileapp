import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Same two families as the main Kraftnex app. Passed to useFonts() once in the root layout.
// Until they load, text falls back to the system font.
export const fontAssets = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

// React Native picks a weight by font family name, so each weight is its own family.
export const fonts = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  label: 'PlusJakartaSans_500Medium',
  labelSemiBold: 'PlusJakartaSans_600SemiBold',
  heading: 'PlusJakartaSans_700Bold',
  headingHeavy: 'PlusJakartaSans_800ExtraBold',
} as const;

// Maps a style's fontWeight onto the matching loaded family: regular and medium text is DM Sans,
// semibold and heavier is Plus Jakarta Sans, as in the main app (body vs headings and labels).
export function fontFamilyForWeight(weight: string | number | undefined): string {
  const value = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight) || 400;
  if (value >= 800) return fonts.headingHeavy;
  if (value >= 700) return fonts.heading;
  if (value >= 600) return fonts.labelSemiBold;
  if (value >= 500) return fonts.bodyMedium;
  return fonts.body;
}
