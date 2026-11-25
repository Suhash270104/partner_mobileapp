import { useCallback, useState, type ReactNode } from 'react';
import { Alert as NativeAlert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '../AppText';
import { Sheet } from '../studio/Sheet';
import { Alert, Btn, errorText, pm, usePmLoad } from './PmUi';
import { pmApi, type ProjectRole } from '../../lib/pm/api';

/** Loads a module's data together with the caller's role on the project (the role decides which controls show). */
export function usePmModule<T>(loader: (id: string) => Promise<T>) {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId || '');
  const state = usePmLoad(async () => {
    const [data, overview] = await Promise.all([loader(id), pmApi.overview(id)]);
    return { data, role: overview.role as ProjectRole, started: overview.started };
  }, [id]);
  return { id, ...state, role: state.data?.role, payload: state.data?.data as T | undefined, started: state.data?.started };
}

/** Runs one write at a time: tracks which item is busy, surfaces the server message and reloads the list on success. */
export function useRunner(reload: () => Promise<void>) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const run = useCallback(async (key: string, work: () => Promise<unknown>, fallback: string) => {
    setBusyId(key); setError('');
    try { await work(); await reload(); return true; } catch (e) { setError(errorText(e, fallback)); return false; } finally { setBusyId(''); }
  }, [reload]);
  return { busyId, error, run, clear: () => setError('') };
}

export function confirmAction(title: string, message: string, label: string, onConfirm: () => void, destructive = true) {
  NativeAlert.alert(title, message, [{ text: 'Back', style: 'cancel' }, { text: label, style: destructive ? 'destructive' : 'default', onPress: onConfirm }]);
}

/** A bottom-sheet form with a shared error line and one submit button. `submit` returns an error message, or nothing when it worked. */
export function FormSheet({ visible, title, eyebrow, submitLabel, onClose, submit, children, kind }: {
  visible: boolean; title: string; eyebrow?: string; submitLabel: string; onClose: () => void; kind?: 'primary' | 'green' | 'danger';
  submit: () => Promise<string | void> | string | void; children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true); setError('');
    try {
      const problem = await submit();
      if (problem) setError(problem);
    } catch (e) { setError(errorText(e, 'Could not save. Please try again.')); } finally { setBusy(false); }
  }
  return (
    <Sheet visible={visible} title={title} eyebrow={eyebrow} onClose={() => { setError(''); onClose(); }} locked={busy}>
      <View style={{ gap: 10 }}>
        {children}
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label={submitLabel} kind={kind} busy={busy} onPress={() => void go()} />
      </View>
    </Sheet>
  );
}

export const FieldLabel = ({ children }: { children: ReactNode }) => <Text style={s.label}>{children}</Text>;
export const RowBetween = ({ children }: { children: ReactNode }) => <View style={s.row}>{children}</View>;
export const Title = ({ children }: { children: ReactNode }) => <Text style={s.title}>{children}</Text>;
export const Body = ({ children }: { children: ReactNode }) => <Text style={s.body}>{children}</Text>;
export const Actions = ({ children }: { children: ReactNode }) => <View style={s.actions}>{children}</View>;

/** "snake_case" or "bank_transfer" -> "Bank transfer". */
export const labelOf = (value?: string) => (value ? value.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase()) : '');
/** Option list for Chips built from the allowed values. */
export const optionsOf = <T extends string>(values: readonly T[]) => values.map(value => ({ key: value, label: labelOf(value) }));
/** Whole number from a text field, or undefined when empty/invalid. */
export const wholeNumber = (text: string): number | undefined => { const n = Number(text.trim()); return text.trim() && Number.isInteger(n) ? n : undefined; };
/** Rupee amount from a text field (commas allowed), or undefined when empty/invalid. */
export const rupees = (text: string): number | undefined => { const n = Number(text.replace(/,/g, '').trim()); return text.trim() && Number.isFinite(n) ? n : undefined; };

const s = StyleSheet.create({
  label: { color: pm.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: pm.ink, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  body: { color: pm.ink, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
