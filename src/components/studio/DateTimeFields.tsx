import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { Icon } from '../Icon';
import { c } from '../professional/onboardingUi';

// Popup pickers for the studio forms, so nobody has to type "25-12-2026" or "14:30" by hand.
// Values stay in the formats the forms already use: DD-MM-YYYY for dates, HH:MM (24 h) for times.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIME_STEP_MINUTES = 30;

const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatDate(date: Date): string {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function parseDate(value: string): Date | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return date.getDate() === Number(m[1]) && date.getMonth() === Number(m[2]) - 1 ? date : null;
}

export function to12Hour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

function FieldBox({ label, text, placeholder, icon, onPress, required }: { label: string; text: string; placeholder: string; icon: 'calendar' | 'clock'; onPress: () => void; required?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}{required ? ' *' : ''}</Text>
      <Pressable style={s.box} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${text || placeholder}`}>
        <Text style={[s.boxText, !text && { color: '#98a59f' }]}>{text || placeholder}</Text>
        <Icon name={icon} size={18} color={c.green} />
      </Pressable>
    </View>
  );
}

function Popup({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => undefined}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>{title}</Text>
            <Pressable onPress={onClose} style={s.close} accessibilityLabel="Close"><Text style={s.closeText}>×</Text></Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// A date field that opens a month calendar. Days before `minDate` (default today) cannot be chosen.
export function DateField({ label, value, onChange, placeholder = 'Select a date', required, minDate }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; minDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const earliest = useMemo(() => startOfDay(minDate || new Date()), [minDate]);
  const selected = parseDate(value);
  const [cursor, setCursor] = useState(() => selected || earliest);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
  }, [year, month]);

  const atEarliestMonth = year === earliest.getFullYear() && month === earliest.getMonth();
  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));

  function openPicker() {
    setCursor(parseDate(value) || earliest);
    setOpen(true);
  }

  return (
    <>
      <FieldBox label={label} text={value} placeholder={placeholder} icon="calendar" onPress={openPicker} required={required} />
      <Popup visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={s.monthRow}>
          <Pressable onPress={() => shift(-1)} disabled={atEarliestMonth} style={[s.nav, atEarliestMonth && { opacity: 0.3 }]} accessibilityLabel="Previous month"><Text style={s.navText}>‹</Text></Pressable>
          <Text style={s.monthText}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={() => shift(1)} style={s.nav} accessibilityLabel="Next month"><Text style={s.navText}>›</Text></Pressable>
        </View>
        <View style={s.weekRow}>{WEEKDAYS.map((d, i) => <Text key={`${d}${i}`} style={s.weekday}>{d}</Text>)}</View>
        <View style={s.grid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={s.cell} />;
            const date = new Date(year, month, day);
            const disabled = date < earliest;
            const on = !!selected && selected.getTime() === date.getTime();
            const today = date.getTime() === startOfDay(new Date()).getTime();
            return (
              <Pressable key={day} disabled={disabled} style={s.cell} onPress={() => { onChange(formatDate(date)); setOpen(false); }}>
                <View style={[s.day, on && s.dayOn, !on && today && s.dayToday]}>
                  <Text style={[s.dayText, on && { color: '#fff' }, disabled && { color: '#c2cbc7' }]}>{day}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Popup>
    </>
  );
}

const SLOTS = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, i) => {
  const minutes = i * TIME_STEP_MINUTES;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

// A time field that opens a list of times in 30-minute steps, shown in 12-hour form and stored as HH:MM.
export function TimeField({ label, value, onChange, placeholder = 'Select a time', required }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FieldBox label={label} text={value ? to12Hour(value) : ''} placeholder={placeholder} icon="clock" onPress={() => setOpen(true)} required={required} />
      <Popup visible={open} title={label} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator>
          {SLOTS.map(slot => (
            <Pressable key={slot} style={[s.slot, slot === value && s.slotOn]} onPress={() => { onChange(slot); setOpen(false); }}>
              <Text style={[s.slotText, slot === value && { color: c.green, fontWeight: '800' }]}>{to12Hour(slot)}</Text>
              {slot === value ? <Icon name="check" size={18} color={c.green} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Popup>
    </>
  );
}

const s = StyleSheet.create({
  label: { color: c.ink, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  box: { minHeight: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxText: { color: c.ink, fontSize: 14.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,24,18,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800', flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: c.ink, fontSize: 20, lineHeight: 22 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  navText: { color: c.ink, fontSize: 22, lineHeight: 24 },
  monthText: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', color: c.muted, fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: c.green },
  dayToday: { borderWidth: 1.5, borderColor: c.green },
  dayText: { color: c.ink, fontSize: 13.5, fontWeight: '700' },
  slot: { minHeight: 46, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotOn: { backgroundColor: c.greenSoft },
  slotText: { color: c.ink, fontSize: 14.5 },
});
