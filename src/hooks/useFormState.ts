import { useCallback, useState } from 'react';
import type { FieldErrors } from '../lib/marketplace/validation';

/** Form values plus per-field errors. Editing a field clears that field's error, so messages never linger after a fix. */
export function useFormState<T extends object>(initial: T | (() => T)) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { if (!previous[key as string]) return previous; const { [key as string]: _removed, ...rest } = previous; return rest; });
  }, []);

  return { form, setForm, errors, setErrors, set };
}
