import { StyleSheet, View } from 'react-native';
import { LIMITS, QUESTION_TYPE_OPTIONS } from '../../../lib/marketplace/constants';
import { FormField, IconButton, SelectField, Text, ToggleRow, palette } from '../../ui';

export interface QuestionDraft { label: string; type: string; options: string; required: boolean; _id?: string }

/** One enquiry-form question: text, answer type, dropdown options, required switch, and reorder / remove controls. */
export function QuestionEditorCard({ index, question, error, canMoveUp, canMoveDown, onChange, onMove, onRemove }: {
  index: number; question: QuestionDraft; error?: string; canMoveUp: boolean; canMoveDown: boolean;
  onChange: (change: Partial<QuestionDraft>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void;
}) {
  return <View style={s.card}>
    <View style={s.head}>
      <Text style={s.title}>Question {index + 1}</Text>
      <View style={s.tools}>
        <IconButton icon="chevronDown" label="Move down" disabled={!canMoveDown} onPress={() => onMove(1)} />
        <IconButton icon="chevronRight" label="Move up" disabled={!canMoveUp} onPress={() => onMove(-1)} />
        <IconButton icon="trash" label="Remove question" tone="danger" onPress={onRemove} />
      </View>
    </View>
    <View style={{ gap: 14 }}>
      <FormField label="Question" value={question.label} onChangeText={label => onChange({ label })} maxLength={LIMITS.questionLabel.max} error={error} />
      <SelectField label="Answer type" value={question.type} options={QUESTION_TYPE_OPTIONS} onChange={type => onChange({ type })} />
      {question.type === 'select' ? <FormField label="Dropdown options" value={question.options} onChangeText={options => onChange({ options })} helper={`Separate with commas. ${LIMITS.questionOptions.min}–${LIMITS.questionOptions.max} options.`} /> : null}
      <ToggleRow label="Required" value={question.required} onChange={required => onChange({ required })} />
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: palette.ink, fontSize: 15, fontWeight: '800' }, tools: { flexDirection: 'row' },
});
