// Ambient declarations for Svelte single-file components under tsc.
// tsc never type-checks .svelte bodies (vitest compiles them when mounting
// the real shell); this keeps `import App from './App.svelte'` well-typed.
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component;
  export default component;
}
