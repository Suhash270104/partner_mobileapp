import type { ComponentProps } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import { fontFamilyForWeight } from '../theme/typography';

// Drop-in replacements for react-native's Text and TextInput that render in the app fonts
// (DM Sans / Plus Jakarta Sans). Each weight is its own loaded family, so the style's fontWeight
// picks the family and is then removed so Android does not fake-bold it a second time.
function withAppFont<T>(style: T): T | undefined {
  if (style === undefined || style === null) return style;
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
  if (!flat) return style;
  if (flat.fontFamily) return style;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: fontFamilyForWeight(fontWeight as string | number | undefined) } as unknown as T;
}

export function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText {...props} style={withAppFont(props.style)} />;
}

export function TextInput(props: ComponentProps<typeof NativeTextInput>) {
  return <NativeTextInput {...props} style={withAppFont(props.style)} />;
}
