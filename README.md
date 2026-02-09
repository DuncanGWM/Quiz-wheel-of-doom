# Quiz Wheel

Quiz Wheel is a polished, deployable React + Vite web app that picks the next quiz runner with a Wheel-of-Fortune style spin.

## Features

- **Flexible name input**: paste one-per-line or comma-separated names.
- **Validation + cleanup**: trims whitespace, removes empties, optional de-duplication (default ON).
- **Wheel rendering**: responsive SVG wheel with high-contrast red/black/white/grey segment palette.
- **Random winner selection**:
  - Default: unbiased crypto randomness (`window.crypto.getRandomValues` with rejection sampling).
  - Optional deterministic mode: seeded Mulberry32 PRNG for reproducible debugging.
- **Spin behavior**:
  - 4–8 full turns.
  - Ease-out animation.
  - Precise landing on one segment under a fixed top pointer.
- **Game-show polish**:
  - Mute toggle (default muted ON).
  - Lightweight celebration confetti.
  - Winner card + recent winner history.
- **Winner lifecycle options**:
  - Remove winner after spin toggle.
  - Manual remove winner action.
  - Shuffle order without affecting randomness quality.
- **Logo handling**:
  - Logo in header top-left.
  - Faint watermark centered behind wheel.
  - Graceful fallback: watermark auto-hides if image fails to load.

## Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3

## Project Structure

- `public/logo.svg` – deploy-safe logo asset (`/logo.svg`).
- `src/App.tsx` – core UI, wheel rendering, spin logic, randomness, interactions.
- `src/styles.css` – Tailwind setup + custom component styles/animations.

## Setup

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Deployment

### Vercel

1. Import this repo in Vercel.
2. Framework preset: **Vite** (auto-detected).
3. Build command: `npm run build`
4. Output directory: `dist`

### Netlify

1. Create site from this repo.
2. Build command: `npm run build`
3. Publish directory: `dist`

## Logo Notes

- Current file path is `public/logo.svg`.
- If you want to use a provided PNG/JPG/SVG instead, place it at `public/logo.png` or `public/logo.jpg` and update the two `src="/logo.svg"` references in `src/App.tsx`.
- For zero-code swap, you can also rename your provided logo to `logo.svg` and overwrite the existing file.

## Randomness Details

- **Unbiased selection** uses rejection sampling over `Uint32` values to avoid modulo bias.
- **Seeded mode** uses Mulberry32 with an FNV-style hash from the seed string.
- Seeded mode is deterministic for debugging and demos; clear the seed for cryptographic entropy mode.

## Accessibility + Responsiveness

- Keyboard-usable controls and native inputs.
- `aria-label` on wheel and `aria-live` winner updates.
- Layout adapts from two-column desktop to stacked mobile.

## Assumptions

- The provided logo image in prompt context is represented as `public/logo.svg` in this project.
- Sound effects are generated with the Web Audio API (no external audio files required).
- In browsers blocking audio autoplay, sound starts after first user interaction as expected.

## Final Checklist

- [x] Logo appears in header (top-left) and as faint wheel watermark.
- [x] Watermark degrades gracefully on load failure.
- [x] Winner selection is unbiased in default mode.
- [x] Optional seed-based deterministic spin is implemented/documented.
- [x] App includes local dev/build scripts for deployment workflows.
