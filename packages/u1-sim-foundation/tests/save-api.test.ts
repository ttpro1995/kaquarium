import { describe, expect, it } from 'vitest';
import { createKernel } from '../src/kernel.js';
import { MemoryStorage } from '../src/persistence/persistence.js';
import { createInitialState } from '../src/types.js';

function tickNow() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 5, 1, 12, 0, n++)).toISOString();
}

describe('SaveLoadApi surface + selectors (US9.1-US9.3)', () => {
  it('boots a runnable kernel from the factory', () => {
    const kernel = createKernel(7, { now: tickNow() });
    expect(kernel.dispatch('settings.update', { reducedMotion: true }).ok).toBe(true);
    kernel.tick();
    expect(kernel.store.state.clock.gameHour).toBe(9);
    expect(kernel.store.version).toBe(2);
  });

  it('overwrites a manual slot on repeated saveToSlot', () => {
    const kernel = createKernel(7, { now: tickNow() });
    const first = kernel.saves.saveToSlot('pond');
    const second = kernel.saves.saveToSlot('pond');
    expect(first.ok && second.ok).toBe(true);
    const slots = kernel.saves.listSlots();
    expect(slots.length).toBe(1);
    if (first.ok && second.ok) expect(second.savedAt > first.savedAt).toBe(true);
  });

  it('lists SlotInfo rows with level, money, playtime, ref', () => {
    const kernel = createKernel(7, { now: tickNow() });
    kernel.store.state.money = 432;
    kernel.saves.saveToSlot('pond');
    kernel.saves.autosave();
    const slots = kernel.saves.listSlots();
    expect(slots.length).toBe(2);
    const manual = slots.find((s) => s.ref.kind === 'manual');
    expect(manual).toMatchObject({ level: 1, money: 432, playtimeMs: 0 });
    expect(typeof manual?.savedAt).toBe('string');
  });

  it('load replaces in-memory state and reports SLOT_NOT_FOUND when missing', () => {
    const kernel = createKernel(7, { now: tickNow() });
    kernel.store.state.money = 900;
    kernel.saves.saveToSlot('rich');
    kernel.store.state.money = 0;
    const loaded = kernel.saves.load({ kind: 'manual', name: 'rich' });
    expect(loaded).toMatchObject({ ok: true, stale: false });
    expect(kernel.store.state.money).toBe(900);
    expect(kernel.saves.load({ kind: 'manual', name: 'ghost' })).toMatchObject({
      ok: false,
      error: { code: 'SLOT_NOT_FOUND' },
    });
  });

  it('export writes no slot and re-read reflects the loaded state', () => {
    const kernel = createKernel(7, { now: tickNow() });
    kernel.saves.saveToSlot('a');
    const text = kernel.saves.exportFile();
    expect(kernel.saves.listSlots().length).toBe(1);
    expect(JSON.parse(text).state.seed).toBe(7);
    kernel.store.state.money = 5;
    const imported = kernel.saves.importFile(text);
    expect(imported.ok).toBe(true);
    expect(kernel.store.state.money).toBe(createInitialState(7).money);
    expect(kernel.saves.saveToSlot('b').ok).toBe(true);
    expect(kernel.saves.listSlots().length).toBe(2);
  });

  it('deletes an auto slot while the loaded state stays untouched', () => {
    const primary = new MemoryStorage();
    const kernel = createKernel(7, { now: tickNow(), primary });
    kernel.saves.autosave();
    expect(kernel.saves.listSlots().length).toBe(1);
    kernel.store.state.money = 1234;
    expect(kernel.saves.deleteSlot({ kind: 'auto', index: 1 }).ok).toBe(true);
    expect(kernel.saves.listSlots().length).toBe(0);
    expect(kernel.store.state.money).toBe(1234);
  });
});
