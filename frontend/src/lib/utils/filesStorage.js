// fileStore.js
import { writable } from 'svelte/store';

export const filesStore = writable([]); // stores array of File objects