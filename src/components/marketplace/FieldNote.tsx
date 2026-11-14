import { Text, palette } from '../ui';

/** Inline error under pickers, which have no built-in error slot. Pulled up to sit against the control above it. */
export function FieldNote({ text }: { text?: string }) {
  return text ? <Text style={{ color: palette.red, fontSize: 12, fontWeight: '700', marginTop: -8 }}>{text}</Text> : null;
}
