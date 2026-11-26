// canonicalJson — pinned canonical form (security-design NFR4.3, Q1-A).
// Recursive key sort at every object depth, UTF-8, no whitespace,
// numbers via shortest round-trip text. The same function feeds both
// digest paths (write + import) so the two can never drift.

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(n);
  }
  if (t === 'string') return JSON.stringify(value as string);
  if (Array.isArray(value)) {
    return `[${(value as unknown[]).map((v) => serialize(v)).join(',')}]`;
  }
  if (t === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${serialize(record[k])}`);
    return `{${parts.join(',')}}`;
  }
  throw new Error(`canonicalJson: unsupported type ${t}`);
}
