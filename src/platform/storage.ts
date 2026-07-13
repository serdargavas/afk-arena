import { invoke } from '@tauri-apps/api/core';

// Thin wrapper over the Rust save/load commands. Kept separate from game/save.ts
// (pure serialization) so the sim stays Tauri-free and testable.

export async function loadRaw(): Promise<string | null> {
  try {
    return await invoke<string | null>('load_game');
  } catch (e) {
    // Corrupt/unreadable save → start fresh rather than crash.
    console.error('[storage] load_game failed:', e);
    return null;
  }
}

export async function saveRaw(data: string): Promise<void> {
  try {
    await invoke('save_game', { data });
  } catch (e) {
    // Non-fatal: the next autosave retries. Surfaced in the console, not swallowed.
    console.error('[storage] save_game failed:', e);
  }
}
