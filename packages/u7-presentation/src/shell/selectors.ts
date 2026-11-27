// selectors — named, module-level views over the shell snapshot (W38).
// Panels and App bind THESE functions — never inline closures — so the
// store's version-keyed memoization cannot be defeated by a fresh closure
// per render. Every selector is pure and returns stable sub-references of
// the frozen snapshot.
import type { ShellSnapshot } from './store.js';

export function selectHud(snap: Readonly<ShellSnapshot>) {
  return {
    money: snap.money,
    level: snap.level,
    xp: snap.xp,
    xpToNext: snap.xpToNext,
    gameDay: snap.gameDay,
    gameHour: snap.gameHour,
    speed: snap.speed,
    paused: snap.paused,
    unreadCount: snap.unreadCount,
  };
}

export function selectFishList(snap: Readonly<ShellSnapshot>) {
  return snap.fish;
}

export function selectRoster(snap: Readonly<ShellSnapshot>) {
  return snap.fish;
}

export function selectStoreContext(snap: Readonly<ShellSnapshot>) {
  return { money: snap.money, level: snap.level };
}

export function selectFeeding(snap: Readonly<ShellSnapshot>) {
  return { foodStacks: snap.foodStacks, feederInstalled: snap.feederInstalled };
}

export function selectBreeding(snap: Readonly<ShellSnapshot>) {
  return { pairs: snap.pairs, cohorts: snap.cohorts };
}

export function selectOrders(snap: Readonly<ShellSnapshot>) {
  return snap.orders;
}

export function selectTank(snap: Readonly<ShellSnapshot>) {
  return snap.water;
}

export function selectSettings(snap: Readonly<ShellSnapshot>) {
  return snap.settings;
}

export function selectBell(snap: Readonly<ShellSnapshot>) {
  return { notifications: snap.notifications, unreadCount: snap.unreadCount };
}

export function selectTankScene(snap: Readonly<ShellSnapshot>) {
  return {
    fish: snap.fish,
    reducedMotion: snap.settings.reducedMotion,
    gameDay: snap.gameDay,
    gameHour: snap.gameHour,
  };
}

export function selectSaveContext(snap: Readonly<ShellSnapshot>) {
  return { gameDay: snap.gameDay, gameHour: snap.gameHour, money: snap.money, level: snap.level };
}
