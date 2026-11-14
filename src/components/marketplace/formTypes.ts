import type { FieldErrors } from '../../lib/marketplace/validation';

/** Props every form section receives: the form value, its per-field errors and a typed setter. */
export interface SectionProps<T> {
  form: T;
  errors: FieldErrors;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
}
