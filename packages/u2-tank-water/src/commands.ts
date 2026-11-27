// commands — U2 command handlers (W9, W10, BR8.4, BR9.1–BR9.2).
// Each unit declares its command payloads/results by augmenting U1's
// CommandMap (type side) and registering the handler (runtime side).
// Handlers validate first, then mutate, then emit: a rejection leaves the
// store untouched by construction, never by rollback. Money moves only
// under the C2 purchase-path exception (deduct + moneyChanged, atomic).
import type { GameState } from '@aquarium/u1-sim-foundation/state';
import {
  declareCommandType,
  type CommandError,
  type CommandHandler,
} from '@aquarium/u1-sim-foundation/commands';
import type { Registry, SimEvent } from '@aquarium/u1-sim-foundation';
import { tierVolumeL } from '@aquarium/u1-sim-foundation/state';
import { FILTER_CONVERSION } from './water.js';
import './events.js';

export type EquipmentKind = 'filter' | 'heater' | 'light' | 'autoFeeder';

export interface WaterChangePayload {
  portionPct: number;
}

export interface WaterChangeResult {
  fee: number;
  waste: number;
  nitrate: number;
}

export interface BuyEquipmentPayload {
  kind: EquipmentKind;
  level: number;
}

export interface BuyEquipmentResult {
  kind: EquipmentKind;
  level: number;
  price: number;
}

export interface UpgradeTierPayload {
  tier: number;
}

export interface UpgradeTierResult {
  tier: number;
  volumeL: number;
  price: number;
}

declare module '@aquarium/u1-sim-foundation/commands' {
  interface CommandMap {
    'tank.waterChange': { payload: WaterChangePayload; result: WaterChangeResult };
    'tank.buyEquipment': { payload: BuyEquipmentPayload; result: BuyEquipmentResult };
    'tank.upgradeTier': { payload: UpgradeTierPayload; result: UpgradeTierResult };
  }
}

declareCommandType('tank.waterChange');
declareCommandType('tank.buyEquipment');
declareCommandType('tank.upgradeTier');

/** Shop prices in $FISH (W10). Level 1 is the free starter kit; downgrades are not sold. */
const EQUIPMENT_PRICES: Record<EquipmentKind, Partial<Record<number, number>>> = {
  filter: { 2: 150, 3: 400 },
  heater: { 1: 120 },
  light: { 2: 80, 3: 200 },
  autoFeeder: { 1: 150 },
};

/**
 * U2-gated progression unlock ids (canonical source; U6 progression awards
 * these — see the unlock-ID table in contract-summary C1/C4 and the
 * u6-commerce unlocks-crosscheck test, which asserts every id here is a
 * subset of U6's UNLOCKS awards).
 */
export const EQUIPMENT_UNLOCKS: Record<EquipmentKind, Partial<Record<number, string>>> = {
  filter: { 2: 'equipment.filter2', 3: 'equipment.filter3' },
  heater: { 1: 'equipment.heater' },
  light: { 2: 'equipment.light2', 3: 'equipment.light3' },
  autoFeeder: { 1: 'equipment.autofeeder' },
};

/** Tier unlock ids gated by tank.upgradeTier (canonical source; awarded by U6). */
export const TIER_UNLOCKS: Partial<Record<number, string>> = { 2: 'tier.2', 3: 'tier.3' };

const TIER_PRICES: Partial<Record<number, number>> = { 2: 300, 3: 800 };

function isValidLevel(kind: EquipmentKind, level: number): boolean {
  if (!Number.isInteger(level)) return false;
  if (kind === 'filter' || kind === 'light') return level >= 1 && level <= 3;
  return level === 1;
}

function currentLevel(state: GameState, kind: EquipmentKind): number {
  switch (kind) {
    case 'filter':
      return state.tank.equipment.filter.level;
    case 'light':
      return state.tank.equipment.light.level;
    case 'heater':
      return state.tank.equipment.heater.installed ? 1 : 0;
    case 'autoFeeder':
      return state.tank.equipment.autoFeeder.installed ? 1 : 0;
  }
}

/** Shared funds gate: returns the rejection, or null when affordable. */
function checkFunds(state: GameState, price: number, what: string): CommandError | null {
  if (state.money < price) {
    return { code: 'INSUFFICIENT_FUNDS', message: `Not enough $FISH for ${what}.` };
  }
  return null;
}

/** Shared unlock gate: returns the rejection, or null when unlocked. */
function checkUnlock(state: GameState, unlockId: string, what: string): CommandError | null {
  if (!state.progression.unlocks.includes(unlockId)) {
    return { code: 'NOT_AVAILABLE', message: `${what} is not unlocked yet.` };
  }
  return null;
}

/** Shared money move: deduct then emit moneyChanged on the U6 shape (C2 exception). */
function spend(state: GameState, events: SimEvent[], price: number): void {
  state.money -= price;
  events.push({ kind: 'moneyChanged', delta: -price, balance: state.money });
}

/**
 * W9: dilute waste and nitrate for a volume-proportional fee.
 * Rejects INVALID_QUANTITY outside 10-50% and INSUFFICIENT_FUNDS below the fee.
 */
export const waterChange: CommandHandler<WaterChangePayload, WaterChangeResult> = (
  state,
  payload,
  ctx,
) => {
  const portionPct = (payload as Partial<WaterChangePayload> | null)?.portionPct;
  if (typeof portionPct !== 'number' || !(portionPct >= 10 && portionPct <= 50)) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Water change must be 10-50%.' } };
  }
  const fee = Math.ceil(((state.tank.volumeL * portionPct) / 100 / 2));
  const short = checkFunds(state, fee, 'the water change');
  if (short) return { ok: false, error: short };
  const before = state.tank.water.waste;
  const keep = 1 - portionPct / 100;
  state.tank.water.waste *= keep;
  state.tank.water.nitrate *= keep;
  ctx.events.push({ kind: 'waterChanged', wasteDelta: before - state.tank.water.waste });
  spend(state, ctx.events, fee);
  return { ok: true, value: { fee, waste: state.tank.water.waste, nitrate: state.tank.water.nitrate } };
};

/**
 * W10: install equipment. Unknown kind/level -> UNKNOWN_ENTITY; locked ->
 * NOT_AVAILABLE; short funds -> INSUFFICIENT_FUNDS (atomic). Re-buying the
 * installed level or downgrading -> INVALID_QUANTITY (level 1 is the free
 * starter kit; downgrades are not sold). A filter-level change resets
 * biofilter maturity (BR8.3).
 */
export const buyEquipment: CommandHandler<BuyEquipmentPayload, BuyEquipmentResult> = (
  state,
  payload,
  ctx,
) => {
  const kind = (payload as Partial<BuyEquipmentPayload> | null)?.kind;
  const level = (payload as Partial<BuyEquipmentPayload> | null)?.level;
  if (
    (kind !== 'filter' && kind !== 'heater' && kind !== 'light' && kind !== 'autoFeeder') ||
    typeof level !== 'number' ||
    !isValidLevel(kind, level)
  ) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown equipment or level.' } };
  }
  if (level <= currentLevel(state, kind)) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'That level is already installed; downgrades are not sold.' } };
  }
  const price = EQUIPMENT_PRICES[kind][level];
  if (price === undefined) {
    return { ok: false, error: { code: 'UNKNOWN_ENTITY', message: 'Unknown equipment or level.' } };
  }
  const unlockId = EQUIPMENT_UNLOCKS[kind][level];
  if (unlockId !== undefined) {
    const locked = checkUnlock(state, unlockId, `${kind} ${String(level)}`);
    if (locked) return { ok: false, error: locked };
  }
  const short = checkFunds(state, price, `${kind} ${String(level)}`);
  if (short) return { ok: false, error: short };
  if (kind === 'filter') {
    state.tank.equipment.filter = { level: level as 1 | 2 | 3, conversionRate: FILTER_CONVERSION[level as 1 | 2 | 3] };
    state.tank.biofilterMaturity = 0;
  } else if (kind === 'light') {
    state.tank.equipment.light = { level: level as 1 | 2 | 3 };
  } else if (kind === 'heater') {
    state.tank.equipment.heater = { installed: true };
  } else {
    state.tank.equipment.autoFeeder = { installed: true };
  }
  ctx.events.push({ kind: 'equipmentUpgraded', equipment: `${kind}:${String(level)}` });
  spend(state, ctx.events, price);
  return { ok: true, value: { kind, level, price } };
};

/**
 * W10: move to a bigger tier. tier <= current or outside 2..3 ->
 * INVALID_QUANTITY; locked -> NOT_AVAILABLE; short funds ->
 * INSUFFICIENT_FUNDS (atomic). Carries equipment and keeps a still-valid
 * filter mature (BR9.2).
 */
export const upgradeTier: CommandHandler<UpgradeTierPayload, UpgradeTierResult> = (
  state,
  payload,
  ctx,
) => {
  const tier = (payload as Partial<UpgradeTierPayload> | null)?.tier;
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 2 || tier > 3 || tier <= state.tank.tier) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Tier must be 2 or 3 and above the current tier.' } };
  }
  const unlockId = TIER_UNLOCKS[tier];
  if (unlockId !== undefined) {
    const locked = checkUnlock(state, unlockId, `tier ${String(tier)}`);
    if (locked) return { ok: false, error: locked };
  }
  const price = TIER_PRICES[tier];
  if (price === undefined) {
    return { ok: false, error: { code: 'INVALID_QUANTITY', message: 'Tier must be 2 or 3 and above the current tier.' } };
  }
  const short = checkFunds(state, price, `tier ${String(tier)}`);
  if (short) return { ok: false, error: short };
  state.tank.tier = tier;
  state.tank.volumeL = tierVolumeL(tier);
  ctx.events.push({ kind: 'tierUpgraded', tier });
  spend(state, ctx.events, price);
  return { ok: true, value: { tier, volumeL: state.tank.volumeL, price } };
};

export function registerCommands(registry: Registry): void {
  registry.registerCommand('tank.waterChange', waterChange);
  registry.registerCommand('tank.buyEquipment', buyEquipment);
  registry.registerCommand('tank.upgradeTier', upgradeTier);
}
