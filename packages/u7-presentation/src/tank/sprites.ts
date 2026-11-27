// sprites — procedural sprite mapping, one token per fish (W36).
// Pure mapping from catalogue tokens (palette/pattern/fin) plus a stable
// per-fish variant. Never touches Pixi: the canvas stage resolves tokens
// to textures; tests pin the token map against the catalogue snapshot.
export interface SpriteSpecies {
  palette: Record<string, unknown>;
  pattern: string;
  fin: string;
  layer: string;
}

export interface SpriteToken {
  body: string;
  pattern: string;
  fin: string;
  layer: string;
  variant: number;
  key: string;
}

function variantOf(fishId: string): number {
  let h = 5381;
  for (let i = 0; i < fishId.length; i++) {
    h = ((h * 33 + fishId.charCodeAt(i)) >>> 0) as number;
  }
  return h % 5;
}

export function spriteFor(species: SpriteSpecies, fishId: string): SpriteToken {
  const body = String(species.palette['body'] ?? 'plain');
  const variant = variantOf(fishId);
  return {
    body,
    pattern: species.pattern,
    fin: species.fin,
    layer: species.layer,
    variant,
    key: `${body}:${species.pattern}:${species.fin}:${variant}`,
  };
}
