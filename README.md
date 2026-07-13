# AFK Arena

A low-footprint **AFK roguelite idle** game that lives in the corner of your
screen. Heroes auto-battle waves of enemies for gold while you're away; you drop
in occasionally to spend it. Built to sip CPU/RAM, not gulp it.

> **Stack:** Tauri v2 (Rust + system WebView) · React 19 + TypeScript + Vite ·
> Zustand · single `<canvas>` renderer. See [PLAN.md](./PLAN.md) for the full
> architecture and performance strategy.

## Status

**Phase 1 — Skeleton** ✅ Frameless corner window, fixed-timestep sim (10 tick/s),
auto-battle "kill enemy → gold" loop, canvas hero vs. enemy with juice
(damage numbers, crits, hit-flash), save/load + offline progress.

Roadmap: `2` roguelite (biomes, relics, bosses) · `3` rebirth/prestige ·
`4` variety & juice (classes, particles, audio) · `5` release (icon, notarize).

## Develop

```bash
pnpm install
pnpm test          # run the pure-sim unit tests (Vitest)
pnpm tauri dev     # run the app (requires Rust — see below)
pnpm tauri build   # produce a .app / .dmg
```

### Prerequisites

- **Node** + **pnpm**
- **Rust** (stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Xcode Command Line Tools** (macOS)

## Layout

```
src/game/     Pure TS simulation (framework-free, unit-tested)
src/render/   Canvas renderer + object-pooled particles
src/store/    Zustand store (sim ↔ UI bridge)
src/platform/ Tauri save/load bridge
src/ui/       React components (HUD, title bar, offline modal)
src/loop.ts   Fixed-timestep loop orchestrator
src-tauri/    Window config, fs commands, capabilities
```
