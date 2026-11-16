import { useCallback, useState } from "react";

/** Multi-select facet state (client-side filters) for DataTable toolbars. */
export function useFacets<K extends string>(keys: readonly K[]) {
  const empty = () => Object.fromEntries(keys.map((k) => [k, [] as string[]])) as Record<K, string[]>;
  const [values, setValues] = useState<Record<K, string[]>>(empty);
  const set = useCallback((k: K) => (v: string[]) => setValues((s) => ({ ...s, [k]: v })), []);
  const reset = useCallback(() => setValues(empty()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const match = (k: K, value: string) => values[k].length === 0 || values[k].includes(value);
  return { values, set, reset, match };
}

export const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
