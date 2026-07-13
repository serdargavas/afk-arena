// True only inside the Tauri webview. Lets the same build render in a plain
// browser (for visual iteration) without the Tauri-only calls crashing on load.
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
