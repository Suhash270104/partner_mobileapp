import { Pressable, StyleSheet, View } from 'react-native';
import { LIMITS, QUESTION_TYPE_OPTIONS } from '../../../lib/marketplace/constants';
import { FormField, Icon, IconButton, SelectField, Text, ToggleRow, palette } from '../../ui';

export interface QuestionDraft { label: string; type: string; options: string; required: boolean; _id?: string; key: string }

/** One enquiry-form question: text, answer type, dropdown options, required switch, and collapse / reorder / remove controls. */
export function QuestionEditorCard({ index, question, error, collapsed, onToggle, canMoveUp, canMoveDown, onChange, onMove, onRemove }: {
  index: number; question: QuestionDraft; error?: string; collapsed: boolean; onToggle: () => void; canMoveUp: boolean; canMoveDown: boolean;
  onChange: (change: Partial<QuestionDraft>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void;
}) {
  return <View style={s.card}>
    <View style={s.head}>
      <Pressable onPress={onToggle} style={s.heading} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} question ${index + 1}`}>
        <Text style={s.title}>Question {index + 1}</Text>
        {collapsed ? <Icon name="arrowRight" size={18} color={palette.muted} /> : null}
      </Pressable>
      <View style={s.tools}>
        <IconButton icon={collapsed ? 'chevronDown' : 'chevronUp'} label={collapsed ? 'Expand question' : 'Collapse question'} onPress={onToggle} />
        <IconButton icon="arrowUp" label="Move up" disabled={!canMoveUp} onPress={() => onMove(-1)} />
        <IconButton icon="arrowDown" label="Move down" disabled={!canMoveDown} onPress={() => onMove(1)} />
        <IconButton icon="trash" label="Remove question" tone="danger" onPress={onRemove} />
      </View>
    </View>
    {collapsed ? <Text style={s.summary} numberOfLines={2}>{question.label.trim() || 'No question text yet'}</Text> : <View style={{ gap: 14 }}>
      <FormField label="Question" value={question.label} onChangeText={label => onChange({ label })} maxLength={LIMITS.questionLabel.max} error={error} />
      <SelectField label="Answer type" value={question.type} options={QUESTION_TYPE_OPTIONS} onChange={type => onChange({ type })} />
      {question.type === 'select' ? <FormField label="Dropdown options" value={question.options} onChangeText={options => onChange({ options })} helper={`Separate with commas. ${LIMITS.questionOptions.min}–${LIMITS.questionOptions.max} options.`} /> : null}
      <ToggleRow label="Required" value={question.required} onChange={required => onChange({ required })} />
    </View>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: palette.ink, fontSize: 14.5, fontWeight: '800' }, tools: { flexDirection: 'row' },
  heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }, summary: { color: palette.body, fontSize: 12.5, lineHeight: 18 },
});
