export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(text: string | null | undefined): T | undefined {
  if (text == null) return undefined;
  return JSON.parse(text) as T;
}

export function fromJsonRequired<T>(text: string | null | undefined): T {
  if (text == null) throw new Error('Expected JSON column to be non-null');
  return JSON.parse(text) as T;
}
