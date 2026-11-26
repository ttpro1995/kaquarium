// species — content catalogue (C5). Content, not code: one JSON file per
// species, validated at build and at boot. Full validation (BR5.1) lands
// with the persistence layer; this file owns the read surface the tick
// context and handlers share.
import type { Species } from './types.js';

export interface SpeciesCatalog {
  get(id: string): Species | undefined;
  all(): readonly Species[];
  readonly size: number;
}

export class MemoryCatalog implements SpeciesCatalog {
  private readonly entries: Map<string, Species>;

  constructor(entries: readonly Species[] = []) {
    this.entries = new Map(entries.map((e) => [e.id, e]));
  }

  get(id: string): Species | undefined {
    return this.entries.get(id);
  }

  all(): readonly Species[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }
}

export type CatalogMode = 'build' | 'dev' | 'prod';

export interface CatalogLogger {
  warn(message: string): void;
  info(message: string): void;
}

const ARCHETYPES = new Set(['livebearer', 'scatter', 'plant', 'cave', 'bubbleNester', 'annual', 'hardBreed']);
const LAYERS = new Set(['top', 'middle', 'bottom']);

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyCatalog(): SpeciesCatalog {
  return new MemoryCatalog();
}

/** Field-level validation of one species entry (C5, BR5.1). Empty = valid. */
export function validateSpeciesEntry(entry: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(entry)) return ['entry must be an object'];
  if (typeof entry.id !== 'string' || entry.id.length === 0) errors.push('id must be a non-empty string');
  if (!isRecord(entry.name) || Object.keys(entry.name).length === 0) {
    errors.push('name must be an object keyed by locale');
  } else {
    for (const [locale, text] of Object.entries(entry.name)) {
      if (typeof text !== 'string' || text.length === 0) errors.push(`name.${locale} must be a non-empty string`);
    }
  }
  if (typeof entry.archetype !== 'string' || !ARCHETYPES.has(entry.archetype)) {
    errors.push('archetype must be one of livebearer | scatter | plant | cave | bubbleNester | annual | hardBreed');
  }
  if (entry.tier !== 1 && entry.tier !== 2 && entry.tier !== 3) errors.push('tier must be 1 | 2 | 3');
  if (!isInt(entry.care) || (entry.care as number) < 1 || (entry.care as number) > 5) {
    errors.push('care must be an integer 1..5');
  }
  if (!isInt(entry.buyPrice) || (entry.buyPrice as number) < 0) errors.push('buyPrice must be an integer >= 0');
  if (!isInt(entry.sellBase) || (entry.sellBase as number) < 0) errors.push('sellBase must be an integer >= 0');
  if (typeof entry.adultSizeCm !== 'number' || !(entry.adultSizeCm > 0)) {
    errors.push('adultSizeCm must be a number > 0');
  }
  for (const field of ['lifespanDays', 'maturityDays', 'juvenileDays'] as const) {
    if (!isInt(entry[field]) || (entry[field] as number) <= 0) errors.push(`${field} must be an integer > 0`);
  }
  if (!isRecord(entry.diet) || typeof entry.diet.type !== 'string' || typeof entry.diet.firstFoodRequired !== 'boolean') {
    errors.push('diet must be { type: string, firstFoodRequired: boolean }');
  }
  if (!isRecord(entry.genes)) errors.push('genes must be a locus map object');
  if (!isRecord(entry.palette)) errors.push('palette must be a colour token object');
  if (typeof entry.pattern !== 'string' || entry.pattern.length === 0) errors.push('pattern must be a non-empty string');
  if (typeof entry.fin !== 'string' || entry.fin.length === 0) errors.push('fin must be a non-empty string');
  for (const field of ['schooling', 'territorial'] as const) {
    if (typeof entry[field] !== 'number' || (entry[field] as number) < 0 || (entry[field] as number) > 1) {
      errors.push(`${field} must be a number 0..1`);
    }
  }
  if (typeof entry.layer !== 'string' || !LAYERS.has(entry.layer)) {
    errors.push('layer must be top | middle | bottom');
  }
  return errors;
}

/**
 * Content loading (BR5.1): build/dev fail loudly naming file+field;
 * production excludes the invalid entry, logs it, and keeps the catalogue.
 */
export function loadSpeciesCatalog(
  files: ReadonlyArray<{ file: string; data: unknown }>,
  opts: { mode: CatalogMode; logger?: CatalogLogger },
): SpeciesCatalog {
  const valid: Species[] = [];
  for (const { file, data } of files) {
    const errors = validateSpeciesEntry(data);
    if (errors.length === 0) {
      valid.push(data as Species);
      continue;
    }
    const message = `invalid species in ${file}: ${errors.join('; ')}`;
    if (opts.mode === 'prod') {
      opts.logger?.warn(message);
      continue;
    }
    throw new Error(message);
  }
  return new MemoryCatalog(valid);
}
