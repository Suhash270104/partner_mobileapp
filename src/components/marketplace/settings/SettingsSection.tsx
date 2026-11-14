import { ReactNode, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '../../../lib/marketplace/errors';
import { PillButton, SectionCard, Text, palette } from '../../ui';

/**
 * A settings card with its own Save button. `onSave` may return a validation sentence to show instead of saving,
 * or throw to surface a server error. Read-only roles see the fields without the button.
 */
export function SettingsSection({ title, subtitle, readOnly = false, saveLabel = 'Save changes', onSave, children }: {
  title: string; subtitle?: string; readOnly?: boolean; saveLabel?: string; onSave: () => Promise<string | void>; children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const problem = await onSave();
      setMessage(problem ? { kind: 'error', text: problem } : { kind: 'ok', text: 'Saved.' });
    } catch (cause) { setMessage({ kind: 'error', text: errorMessage(cause, 'Could not save these changes.') }); }
    finally { setBusy(false); }
  };

  return <SectionCard title={title} subtitle={subtitle}>
    <View style={{ gap: 14, paddingTop: 4 }}>
      {children}
      {message ? <Text style={{ color: message.kind === 'ok' ? palette.greenText : palette.red, fontSize: 13, fontWeight: '700' }}>{message.text}</Text> : null}
      {!readOnly ? <PillButton title={saveLabel} loading={busy} onPress={() => void save()} /> : null}
    </View>
  </SectionCard>;
}
