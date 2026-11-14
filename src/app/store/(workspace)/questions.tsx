import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { QuestionDraft, QuestionEditorCard } from '../../../components/marketplace/questions/QuestionEditorCard';
import { AlertBanner, EmptyState, PillButton, Screen, StickyActionBar } from '../../../components/ui';
import { useAction } from '../../../hooks/useAction';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { merchantApi } from '../../../lib/marketplace/api';
import { LIMITS } from '../../../lib/marketplace/constants';
import { splitList } from '../../../lib/marketplace/validation';
import type { EnquiryQuestion } from '../../../lib/marketplace/types';

const blank = (): QuestionDraft => ({ label: '', type: 'text', options: '', required: false });

/** The questions every buyer answers when they send an enquiry. Saving replaces the whole list (hand-off §9). */
export default function QuestionsScreen() {
  const { run, isBusy } = useAction();
  const loaded = useAsyncData(() => merchantApi.enquiryQuestions(), []);
  // Edits live in `edits` once the person changes anything; until then the saved list from the server is shown.
  const [edits, setEdits] = useState<QuestionDraft[] | null>(null);
  const saved_ = useMemo<QuestionDraft[]>(() => (loaded.data ?? []).map(q => ({ _id: q._id, label: q.label, type: q.type, options: (q.options ?? []).join(', '), required: !!q.required })), [loaded.data]);
  const questions = edits ?? saved_;
  const update = (fn: (list: QuestionDraft[]) => QuestionDraft[]) => { setSaved(false); setEdits(fn(questions)); };
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const patch = (index: number, change: Partial<QuestionDraft>) => update(list => list.map((q, i) => (i === index ? { ...q, ...change } : q)));
  const move = (index: number, direction: -1 | 1) => update(list => { const to = index + direction; if (to < 0 || to >= list.length) return list; const copy = [...list]; [copy[index], copy[to]] = [copy[to], copy[index]]; return copy; });

  const save = async () => {
    const found: Record<number, string> = {};
    const payload: EnquiryQuestion[] = questions.map((q, index) => {
      const options = splitList(q.options);
      if (q.label.trim().length < LIMITS.questionLabel.min) found[index] = `Write the question (at least ${LIMITS.questionLabel.min} characters).`;
      else if (q.type === 'select' && (options.length < LIMITS.questionOptions.min || options.length > LIMITS.questionOptions.max)) found[index] = `A dropdown needs ${LIMITS.questionOptions.min}–${LIMITS.questionOptions.max} options.`;
      return { ...(q._id ? { _id: q._id } : {}), label: q.label.trim(), type: q.type, options: q.type === 'select' ? options : [], required: q.required };
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    const ok = await run('save', () => merchantApi.saveEnquiryQuestions(payload));
    if (ok) setSaved(true);
  };

  return <Screen title="Enquiry form" subtitle={`Questions buyers answer when they enquire (up to ${LIMITS.questions})`} onBack={() => router.back()}
    loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.reload()} footer={<StickyActionBar actions={[{ title: 'Save enquiry form', loading: isBusy('save'), onPress: () => void save() }]} />}>
    {saved ? <AlertBanner tone="green" icon="check" title="Enquiry form saved" message="New enquiries will include these questions." /> : null}
    {questions.length === 0 ? <EmptyState icon="fileText" title="No custom questions" message="Add questions such as thickness, colour or delivery pincode to get better enquiries." /> : null}
    {questions.map((question, index) => <QuestionEditorCard key={question._id ?? index} index={index} question={question} error={errors[index]}
      canMoveUp={index > 0} canMoveDown={index < questions.length - 1} onChange={change => patch(index, change)} onMove={direction => move(index, direction)}
      onRemove={() => update(list => list.filter((_, i) => i !== index))} />)}
    {questions.length < LIMITS.questions ? <PillButton variant="soft" icon="plus" title="Add a question" onPress={() => update(list => [...list, blank()])} /> : null}
  </Screen>;
}
