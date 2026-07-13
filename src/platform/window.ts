import { invoke } from '@tauri-apps/api/core';

// Window controls implemented as Rust commands (guaranteed to run regardless of
// JS capability config). See src-tauri/src/lib.rs.

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  try {
    await invoke('set_always_on_top', { on });
  } catch (e) {
    console.error('[window] set_always_on_top failed:', e);
  }
}

export async function setOverFullscreen(on: boolean): Promise<void> {
  try {
    await invoke('set_over_fullscreen', { on });
  } catch (e) {
    console.error('[window] set_over_fullscreen failed:', e);
  }
}
