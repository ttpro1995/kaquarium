// settings — changed-fields diff for `settings.update` (W38, W49).
// The Settings tab sends only what the player actually changed; an empty
// diff returns null so callers skip the dispatch entirely (no version bump,
// no refresh for a no-op edit).
import type { Settings } from '@aquarium/u1-sim-foundation/state';

export interface SettingsPatch {
  reducedMotion?: boolean;
  autoPauseCritical?: boolean;
  volume?: { master?: number; sfx?: number };
}

/** Pure diff: the subset of `patch` that differs from `current`, or null. */
export function buildSettingsUpdate(current: Settings, patch: SettingsPatch): SettingsPatch | null {
  const out: SettingsPatch = {};
  if (patch.reducedMotion !== undefined && patch.reducedMotion !== current.reducedMotion) {
    out.reducedMotion = patch.reducedMotion;
  }
  if (patch.autoPauseCritical !== undefined && patch.autoPauseCritical !== current.autoPauseCritical) {
    out.autoPauseCritical = patch.autoPauseCritical;
  }
  if (patch.volume !== undefined) {
    const volume: { master?: number; sfx?: number } = {};
    if (patch.volume.master !== undefined && patch.volume.master !== current.volume.master) {
      volume.master = patch.volume.master;
    }
    if (patch.volume.sfx !== undefined && patch.volume.sfx !== current.volume.sfx) {
      volume.sfx = patch.volume.sfx;
    }
    if (volume.master !== undefined || volume.sfx !== undefined) {
      out.volume = volume;
    }
  }
  if (
    out.reducedMotion === undefined &&
    out.autoPauseCritical === undefined &&
    out.volume === undefined
  ) {
    return null;
  }
  return out;
}
