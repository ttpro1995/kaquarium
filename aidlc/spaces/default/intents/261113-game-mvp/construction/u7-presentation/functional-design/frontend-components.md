# Frontend Components — u7-presentation

> Component hierarchy, props/state, interaction flows, and validation for the Svelte 5 + PixiJS 8 shell. Implements the screens in `functional-spec.md` (W36–W47). All sim reads go through selectors; all writes through `dispatch`. No component holds a copy of `GameState` — components hold the store reference plus local UI state (selected tab, dialog open, bulk-selection set).

```yaml
hierarchy:
  - name: App
    children: [Hud, Toolbar, TankCanvas, Panels, Modals, FaultBoundary]
    state: [store, version, activeTab]
  - name: Hud
    props: { money, level, xp, xpToNext, gameDay, gameHour, speed, paused, unreadCount }
    actions: [setSpeed, togglePause, openBell]
    commands: { setSpeed: "clock.setSpeed { speed }", togglePause: "clock.setPaused { paused }" }
  - name: Toolbar
    props: { activeTab }
    actions: [switchTab]
    notes: "tabs: Tank, Store, Feeding, Breeding, Orders, Roster, Save, Settings"
  - name: TankCanvas
    props: { fish: Fish[], waterBand, lightLevel, reducedMotion }
    owns: [sprites, steering, particles]
    notes: "PixiJS stage; render state local and transient (W36/W37)"
  - name: Panels
    children: [FishPanel, RosterPanel, StorePanel, FeedingPanel, BreedingPanel, OrdersPanel, TankPanel, SavePanel, SettingsPanel, BellPanel]
  - name: FishPanel
    props: { fish, sellPreview }
    actions: [sellFish]
    validation: "Sell disabled with reason text when health < 40 (sick unsellable previewed, enforced by handler)"
  - name: RosterPanel
    props: { fish: Fish[], bulkPreview }
    actions: [selectMany, bulkSell]
  - name: StorePanel
    props: { species: BuyableSpecies[] }
    actions: [buyFish, buyEquipment, upgradeTier]
    validation: "Locked entries disabled with requirement text; funds checked pre-dispatch for messaging, enforced by handler"
  - name: BreedingPanel
    props: { pairs: BreedingReadiness[], cohorts: CohortGradePreview[] }
    actions: [pairFish, unpair, gradeCohort]
  - name: FeedingPanel
    props: { stock: FoodStock[], program: FeedingProgram }
    actions: [buyFood, feedFish, feedFry, setAutoFeeder]
    validation: "device-gated rows disabled with requirement text; fry cohort picker lists fry-stage cohorts only"
  - name: TankPanel
    props: { water: WaterChemistry, quality: number, bioload: number, capacity: number }
    actions: [waterChange, buyEquipment, upgradeTier]
    validation: "fee shown pre-dispatch; locked equipment shows unlock requirement"
  - name: SettingsPanel
    props: { reducedMotion, autoPauseCritical, volume }
    actions: [updateSettings]
    notes: "dispatches settings.update with changed fields only; applies live"
  - name: OrdersPanel
    props: { orders: Order[], fulfilPreview }
    actions: [fulfilOrder]
  - name: SavePanel
    props: { slots: SlotInfo[] }
    actions: [saveToSlot, loadSlot, deleteSlot, exportFile, importFile]
    validation: "Import validates before touching current save (C6); STALE_SAVE opens confirm dialog"
    validation: "Import validates before touching current save (C6); STALE_SAVE opens confirm dialog"
  - name: BellPanel
    props: { notifications: Notification[] }
    actions: [focusSubject, dismissNotification]
  - name: Modals
    children: [AwaySummaryModal, ConfirmDialog]
  - name: FaultBoundary
    props: { error }
    actions: [reloadToAutosave]
    notes: "catches render faults and tick-abort surfacing (W46)"

interaction_flows:
  - "Bell click → BellPanel → focusSubject → Tank tab + camera focus + FishPanel open (W43)"
  - "Store buy → dispatch → ok: refresh from version bump; err: inline message at item (W40)"
  - "Away modal → Resume dispatches clock.setPaused { paused: false } → speed 1, modal closes (W45)"
  - "Speed control → clock.setSpeed / clock.setPaused → HUD reflects new clock (W38)"

api_integration:
  selectors: [money, levelProgress, fishById, fishInTank, sellPrice, bulkPreview, buyableSpecies, pairsInTank, cohortsInTank, breedingReadiness, gradePreview, orderRewardPreview, notificationQueue, tankWater, waterQuality, bioloadOf, foodStock, feedingProgram]
  commands: [commerce.buyFish, commerce.sellFish, commerce.sellBulk, orders.fulfil, notifications.dismiss, breeding.pair, breeding.unpair, breeding.grade, tank.upgradeTier, tank.buyEquipment, tank.waterChange, feeding.buyFood, feeding.feedFish, feeding.feedFry, feeding.setAutoFeeder, settings.update, clock.setSpeed, clock.setPaused]
  save_api: [autosave, saveToSlot, listSlots, load, deleteSlot, exportFile, importFile]
  save_note: "save_api entries are direct SaveLoadApi calls, never command-bus dispatches (W44)"
```
