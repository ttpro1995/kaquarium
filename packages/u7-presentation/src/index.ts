// @aquarium/u7-presentation — Svelte 5 UI + PixiJS 8 tank canvas over the
// read-only store and command bus (all screens W36–W49).
export { createShellStore, buildSnapshot, deepFreeze, type ShellStore, type ShellSnapshot } from './shell/store.js';
export { createAppKernel, readSeed, type AppKernel, type BootOptions } from './shell/boot.js';
export { buildSettingsUpdate, type SettingsPatch } from './shell/settings.js';
export * from './shell/selectors.js';
export { errorMessage, outcomeMessage } from './shell/outcomes.js';
export { runAwaySequence, resumeFromAway, type AwaySummary } from './shell/away.js';
export { checkFault, watchFaults, notifyFault, driveTick, reloadToAutosave, type FaultInfo } from './shell/fault.js';
export { mountTankCanvas, type PixiAppLike, type PixiFactories } from './tank/pixiStage.js';
export { createBoidsWorld, stepBoids, type BoidsWorld, type BoidsParams } from './tank/steering.js';
export { tintFor, snappedTint, tintHex, type Tint } from './tank/lighting.js';
export { spriteFor, type SpriteToken } from './tank/sprites.js';
export {
  toggleInSet,
  selectAll,
  clearSelection,
  formatMoney,
  formatCountdown,
  formatGameTime,
  previewBulkSale,
  previewOrderReward,
  previewGrade,
} from './panels/helpers.js';
export * from './panels/actions.js';
export * from './save/menu.js';
