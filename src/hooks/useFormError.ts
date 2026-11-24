import { useCallback, useState } from 'react';

/**
 * Form error state plus a counter that goes up every time an error is set, even to the same text.
 * Screens pass the counter to their scroll view so a failed submit always scrolls the message into view.
 */
export function useFormError(): [string, (message: string) => void, number] {
  const [state, setState] = useState({ message: '', tick: 0 });
  const setError = useCallback((message: string) => setState(previous => ({ message, tick: message ? previous.tick + 1 : previous.tick })), []);
  return [state.message, setError, state.tick];
}
