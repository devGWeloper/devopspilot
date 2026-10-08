export interface DiffItem {
  key: string;
  before: unknown;
  after: unknown;
}

export function shallowDiff(before: Record<string, unknown>, after: Record<string, unknown>): DiffItem[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ key: k, before: before[k], after: after[k] }));
}
