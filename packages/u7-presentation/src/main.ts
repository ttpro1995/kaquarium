// main — browser entry (W47). Boots the kernel (all six sim units), mounts
// the Svelte shell to the index.html root.
import { mount } from 'svelte';
import App from './App.svelte';
import { createAppKernel } from './shell/boot.js';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('kaquarium: missing #app mount root in index.html');
}

const { kernel, store } = createAppKernel();

mount(App, {
  target,
  props: { store, kernel },
});

export { kernel, store };
