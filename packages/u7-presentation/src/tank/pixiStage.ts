// pixiStage — PixiJS tank stage owned ONLY by TankCanvas mount (W36).
// The Application/stage lives and dies inside mountTankCanvas: tests inject
// fake factories (no WebGL needed), production lazily imports pixi.js, and
// any failure — missing WebGL, missing canvas, failed init — soft-fails to
// a fallback panel instead of crashing boot.
export interface PixiAppLike {
  canvas?: unknown;
  destroy?: () => void;
}

export interface PixiCreateOptions {
  width: number;
  height: number;
  background: string;
}

export interface PixiFactories {
  createApplication: (opts: PixiCreateOptions) => PixiAppLike | Promise<PixiAppLike>;
}

export interface TankMountOptions {
  background: string;
  width?: number;
  height?: number;
  factories?: PixiFactories;
}

export interface TankMount {
  app: PixiAppLike | null;
  fallback: boolean;
}

async function defaultFactories(): Promise<PixiFactories | null> {
  try {
    const modName = 'pixi.js';
    const mod = (await import(/* @vite-ignore */ modName)) as {
      Application: new () => {
        init: (opts: { width: number; height: number; background: string }) => Promise<void>;
        canvas?: unknown;
        destroy?: () => void;
      };
    };
    return {
      createApplication: async (opts) => {
        const app = new mod.Application();
        await app.init({ width: opts.width, height: opts.height, background: opts.background });
        return app;
      },
    };
  } catch {
    return null;
  }
}

export async function mountTankCanvas(el: Element, opts: TankMountOptions): Promise<TankMount> {
  const factories = opts.factories ?? (await defaultFactories());
  if (factories === null) return { app: null, fallback: true };
  try {
    const app = await factories.createApplication({
      width: opts.width ?? 800,
      height: opts.height ?? 450,
      background: opts.background,
    });
    const canvas = (app as { canvas?: unknown }).canvas;
    if (canvas instanceof Element) el.appendChild(canvas);
    return { app, fallback: false };
  } catch {
    return { app: null, fallback: true };
  }
}
