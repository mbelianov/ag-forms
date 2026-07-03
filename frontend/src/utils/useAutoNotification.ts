import { useEffect } from 'react';

/**
 * Auto-clears a non-null notification value after `ms` milliseconds.
 * Call it with a setter and the current value; it will fire clearFn when the value becomes truthy.
 *
 * @example
 * const [successMessage, setSuccessMessage] = useState<string | null>(null);
 * useAutoNotification(successMessage, () => setSuccessMessage(null));
 */
export function useAutoNotification(
  value: string | null | undefined,
  clearFn: () => void,
  ms = 5000
): void {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(clearFn, ms);
    return () => clearTimeout(timer);
  }, [value, clearFn, ms]);
}

// Made with Bob
