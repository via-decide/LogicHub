export function sortByKey<T>(arr: T[], keyFn: (item: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function sortByKeys<T>(arr: T[], keyFns: Array<(item: T) => string | number>): T[] {
  return [...arr].sort((a, b) => {
    for (const keyFn of keyFns) {
      const ka = keyFn(a);
      const kb = keyFn(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
    }
    return 0;
  });
}

export function sortStrings(arr: string[]): string[] {
  return [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function sortedRecord<V>(record: Record<string, V>): Record<string, V> {
  const result: Record<string, V> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = record[key];
  }
  return result;
}
