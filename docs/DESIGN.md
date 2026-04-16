# Kids Stopwatch — Design Reference

> Snapshot of the web app as of commit `2f3235b` (Firebase sync + config externalisation). This document is the ground-truth reference for how the app is architected; update it when the architecture changes, not when minor features ship.

---

## 1. Overview

**Kids Stopwatch** is a PWA that tracks exercise sessions for a small number of named children (currently two: Isabella and Viviana), gamifies consistency through streaks, achievements, and a gem economy, and syncs across devices so a parent can record a session on the phone and see it on a tablet.

**Users**
- Primary: a parent operating the app on behalf of the kids.
- Secondary: the kids themselves, viewing the Achievements tab to see what they've unlocked.

**Tech stack**
- Vanilla HTML, CSS, and JavaScript — no framework, no bundler, no transpiler.
- Static site hosted on Netlify.
- Firebase Realtime Database for optional cross-device sync (compat SDK v10.12.0 via CDN).
- Installable PWA with offline app shell via service worker.

**Why no framework.** The app is ~1,500 lines of JS across 8 files. A framework would dominate the bundle size, add a build step to an otherwise zero-build project, and obscure what the code actually does. The IIFE + globals pattern used here is deliberate and well-suited to this size.

---

## 2. File Layout

```
KidsStopwatchWeb/
├── index.html              # Single-page app, three tabs + sync modal
├── manifest.json           # PWA manifest (standalone, maskable icons)
├── sw.js                   # Service worker — cache-first app shell
├── netlify.toml            # Deploy config + Firebase config injection
├── .gitignore              # Ignores js/firebase-config.js
├── serve.sh                # Local dev helper (gitignored)
├── css/
│   └── styles.css          # All styles. Tokens via CSS custom properties.
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── js/
│   ├── storage.js          # localStorage wrapper (5 keys + sync hook)
│   ├── sync.js             # Firebase Realtime DB sync
│   ├── clock.js            # SVG analog clock creation + hand updates
│   ├── confetti.js         # Canvas particle celebration
│   ├── stopwatch.js        # Time formatting + streak/freeze math
│   ├── achievements.js     # 21 achievement defs, gem award, purchase freeze
│   ├── history.js          # Weekly grid + history list rendering
│   ├── app.js              # Entry point, UI orchestration, sync wiring
│   └── firebase-config.js  # Generated at Netlify build (gitignored)
└── docs/
    ├── DESIGN.md           # ← this file
    └── IMPROVEMENTS.md     # prioritized improvement backlog
```

---

## 3. Module Architecture

### Pattern

Two module styles coexist:

1. **IIFE-exposed singletons** — `Storage`, `Sync`, `Confetti`. These own long-lived state (localStorage cache, Firebase handle, canvas/particles) and expose a tight API.
2. **Plain functions** — timer math (`formatTime`, `streakInfo`), rendering (`renderHistoryList`, `renderAchievementsView`), SVG builders (`createClock`, `updateClock`). These are stateless and operate on arguments passed in.

### Orchestrator: `app.js`

`app.js` owns the runtime state and is the only module that knows about all other modules. Its responsibilities:

- Define the kid config (`KIDS` array).
- Hold the `stopwatches[]` runtime array (one entry per kid: `{ time, isRunning, startedAt, accumulatedTime, clock, elements }`).
- Cache `history` in memory (reloaded from `Storage` after sync-driven updates).
- Wire tab switching, dark-mode listener, scroll-fade hint, and sync callbacks.
- Register the service worker.

### Script Load Order

Order matters because of IIFE dependencies and DOM-ready timing:

```html
<script src="https://.../firebase-app-compat.js"></script>     <!-- Firebase SDK (global firebase) -->
<script src="https://.../firebase-database-compat.js"></script>
<script src="js/firebase-config.js"></script>                  <!-- sets window.FIREBASE_CONFIG -->
<script src="js/storage.js"></script>                          <!-- defines Storage -->
<script src="js/sync.js"></script>                             <!-- defines Sync, uses window.FIREBASE_CONFIG -->
<script src="js/clock.js"></script>                            <!-- pure functions -->
<script src="js/confetti.js"></script>                         <!-- defines Confetti -->
<script src="js/stopwatch.js"></script>                        <!-- uses Storage -->
<script src="js/achievements.js"></script>                     <!-- uses Storage, stopwatch funcs -->
<script src="js/history.js"></script>                          <!-- uses stopwatch funcs -->
<script src="js/app.js"></script>                              <!-- wires everything, DOMContentLoaded -->
```

Notes:
- `storage.js` must precede `sync.js` because `Storage._sync()` uses the typeof-guard `if (typeof Sync !== 'undefined')` — early writes (e.g. `ensureFreezeTrackingStart` called from `streakInfo`) are allowed to no-op silently.
- `firebase-config.js` may be absent in local dev; `sync.js` handles the missing config gracefully.
- All DOM-touching work is deferred to `init()` behind `DOMContentLoaded`.

---

## 4. Data Model

All persistence flows through the `Storage` module; Firebase sync is a mirror of the same state.

### localStorage keys

| Key | Type | Shape | Purpose |
|---|---|---|---|
| `stopwatchHistory` | JSON array | `[{ id, childName, duration, timestamp }, …]` | Flat list of all saved sessions across all kids, newest first by convention. |
| `unlockedAchievements` | JSON map | `{ "Isabella": ["streak_3", "sess_1"], "Viviana": […] }` | Per-kid set of unlocked achievement IDs. |
| `gemBalance` | JSON map | `{ "Isabella": 25, "Viviana": 10 }` | Per-kid gem count. |
| `purchasedFreezes` | JSON map | `{ "Isabella": 1, "Viviana": 0 }` | Per-kid count of streak freezes bought with gems. |
| `freezeTrackingStart` | ISO-8601 string | `"2026-01-15T00:00:00.000Z"` | Anchor date for freeze accounting (set once on first ever load). |
| `syncRoomCode` | string | `"KFX7Q2"` | Local-only: remembers which Firebase room to re-join on next load. |

### Example history entry

```json
{ "id": "m8f3q2p7", "childName": "Isabella", "duration": 847.3, "timestamp": 1739567890000 }
```

### Per-kid map helpers

`storage.js` uses internal `_loadMap(key)` / `_saveMap(key, map)` helpers so that each kid-scoped value (achievements, gems, freezes) lives under a single top-level key. This keeps the Firebase document shape flat and lets a new kid be added without migrating existing data.

---

## 5. Core Domain Logic

### 5.1 Timer (drift-free)

Timer state on each stopwatch card is `{ accumulatedTime, startedAt, isRunning }`. When running, elapsed time is computed live as `(Date.now() - startedAt) / 1000 + accumulatedTime`. A single `setInterval(tick, 100)` in `app.js` drives all cards.

Using `Date.now()` deltas instead of `time += 0.1` prevents drift when the browser throttles background tabs and avoids cumulative floating-point error.

### 5.2 Streak & Freeze Algorithm (`js/stopwatch.js`)

The streak answers: *how many consecutive exercise days leading up to today, with allowances for a limited number of "freezes" to bridge missed days?*

```
freezesAvailable = 2 (starter) + Storage.getPurchasedFreezes(kid)

startingDay = today if today has an entry, else yesterday
walk backwards day-by-day:
  if day has an entry → streak++
  else if freezesLeft > 0 → freezesLeft--  (skip, streak continues)
  else → break
```

`streakInfo(kidName, history)` returns `{ streak, freezesLeft }` where `freezesLeft` only counts freezes that have NOT yet been spent walking backwards from today to the `freezeTrackingStart` anchor. The hard cap of 3,650 iterations is a safety rail.

### 5.3 Freeze Economy

- Every kid starts with 2 freezes (constant in code).
- Freezes are purchased with gems: `FREEZE_COST = 15` in `achievements.js`.
- `purchaseFreeze(kidName)` deducts 15 gems and increments `purchasedFreezes[kidName]`.
- There is no upper bound on owned freezes; a long vacation could be fully covered with enough gems.

### 5.4 Achievements (21 total)

Defined in `js/achievements.js` as `ACHIEVEMENT_DEFS`. Each entry:

```js
{ id: 'streak_7', cat: 'streak', icon: '🔥', name: 'Week Warrior',
  desc: '7-day streak', gems: 10,
  stat: 'streak', target: 7,              // drives progress hints
  check: (s) => s.streak >= 7 }
```

Categories and counts:

| Category | Count | Stat | Gems range |
|---|---|---|---|
| `streak` | 6 | streak (days) | 5–100 |
| `session` | 5 | total sessions | 5–60 |
| `time` | 6 | totalTime (sec) | 5–80 |
| `single` | 4 | longestSession (sec) | 5–30 |

**Unlock flow** (`checkAchievements`):

1. Compute stats: `{ streak, sessions, totalTime, longestSession }` for the kid.
2. For each def not yet in `unlockedAchievements[kid]`, run `check(stats)`; if true:
   - Append ID to the set.
   - `Storage.addGems(kid, def.gems)`.
3. Persist the updated set.
4. Return the array of newly unlocked defs for toast + confetti.

### 5.5 Milestone Confetti

`Confetti.isMilestone(streak)` checks against `[3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365]`. When a session save causes the streak to cross one of these thresholds (detected by comparing `prevStreaks[kid]` before/after), `Confetti.launch()` fires — a 3-second canvas overlay with 80 particles in seven colours, wobble and gravity physics.

---

## 6. Rendering Pipeline

### 6.1 Tab Switching

`setupTabs()` in `app.js` attaches click handlers to `.tab` buttons. On click:

- Toggles `.active` on the clicked tab and its matching `.view`.
- For `history`: calls `renderHistory(history, KIDS, deleteHistoryEntry)`.
- For `achievements`: calls `renderAchievementsView(KIDS, history)`.

The **Timers** tab has no "re-render on entry" — its stopwatch cards are created once at init by `renderStopwatchCards()` and then updated in place by `updateTimeDisplay` / `updateClock` / `updateStreakDisplay`.

### 6.2 Stopwatch Card

Each card is built as raw `innerHTML` with inline styles for the kid-coloured gradient background, then the clock SVG is appended via `createClock(color)`. Per-card runtime references are cached in `stopwatch.elements`:

```js
elements: {
  timeDisplay, startBtn, resetBtn, addBtn,
  streakCount, freezeCount, statusBadge, clockContainer
}
```

The `.stopwatch-card.running` class toggles a CSS `pulseGlow` animation that references a per-card `--glow-color` CSS custom property derived from the kid's colour.

### 6.3 History Tab

`renderHistory()` calls two sub-renders:

- **`renderWeeklyGrid`** — Computes the current Monday–Sunday interval, filters history, sums duration per kid. One card per kid, showing the week total time and session count.
- **`renderHistoryList`** — Sorted newest-first (by convention; see Improvements). Groups entries by day with sticky headers: `Today`, `Yesterday`, or `Wednesday, Jan 15`. Each row has a kid-coloured left accent bar and a kid-coloured duration badge.

### 6.4 Achievements Tab

Per kid, `renderAchievementsView` builds:

1. **Kid header** with colour dot and name, on a faint gradient in the kid's colour.
2. **Gem hero** — a large 3.5rem number with a text-shadow glow in the kid's colour.
3. **Buy Freeze button** (disabled under 15 gems) + freezes-owned label.
4. **Progress bar** showing `N of 21 unlocked` in the kid's full-opacity colour (9 px tall).
5. **Four category sections**, each with a grid of achievement cards. Locked cards show a `🔒`, the achievement's gem reward, and (if applicable) a progress hint like `2 more days`. Unlocked cards show the icon and a `✅` badge.

A **scroll-fade hint** element (`position: sticky; bottom: 80px`) at the end of `#achievements-content` indicates more content below; it hides itself via JS scroll listener when within 80 px of the document bottom.

---

## 7. Cross-Device Sync (Firebase)

### 7.1 Data shape

Everything lives under `/rooms/{ROOMCODE}/`:

```json
{
  "history": [ { "id": "…", "childName": "Isabella", "duration": 847.3, "timestamp": 1739567890000 } ],
  "achievements": { "Isabella": ["streak_3"], "Viviana": [] },
  "gems": { "Isabella": 25, "Viviana": 10 },
  "freezes": { "Isabella": 1, "Viviana": 0 },
  "freezeStart": "2026-01-15T00:00:00.000Z",
  "updatedAt": 1739567890500
}
```

### 7.2 Room code generator

```
alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 32 chars — no 0/O/1/I/L
length   = 6
entropy  = log2(32^6) = 30 bits
```

Sufficient for a private family sharing code; not cryptographically secure against brute-force scanning of the whole database (see IMPROVEMENTS P0).

### 7.3 Sequence — create room

```
User clicks "Create new room"
  → Sync.createRoom()
      → code = _generateCode()
      → _attachRoom(code, pullFirst=false)
          → detach any previous listener
          → currentRoom = code
          → localStorage['syncRoomCode'] = code
          → _setStatus('synced')
          → _startListener(ref)          // real-time listener attached
      → _pushNow()                       // upload current local data
```

### 7.4 Sequence — join room

```
User pastes code and clicks Join
  → Sync.joinRoom(code)
      → _attachRoom(code.toUpperCase(), pullFirst=true)
          → _setStatus('connecting')
          → ref.once('value') →
              → _applyRemote(snapshot)   // overwrite local from Firebase
              → onRemoteUpdate()         // re-render active tab
              → _setStatus('synced')
              → _startListener(ref)
```

### 7.5 Sequence — local write → remote push

```
Storage.saveHistory(history)
  → localStorage.setItem(...)
  → Storage._sync()
      → Sync.push()
          → debounce 600 ms (any subsequent push within 600 ms resets the timer)
          → _pushNow()
              → ignoreNextRemote = true
              → _setStatus('syncing')
              → ref.set(_gatherLocal())
                  → success → _setStatus('synced')
                            → 1500 ms later → ignoreNextRemote = false
```

### 7.6 Sequence — remote update from another device

```
Other device pushes → our onValue listener fires
  → if ignoreNextRemote: return              // suppress echo of our own push
  → _applyRemote(data)                       // overwrite localStorage
  → onRemoteUpdate()                         // re-render active tab + gem bar
  → _setStatus('synced')
```

### 7.7 Config injection

The Firebase config is **not** in source. Instead:

```
Netlify UI env var: FIREBASE_CONFIG = '{"apiKey":"…","databaseURL":"…", …}'
                         ↓
netlify.toml build command:
   printf 'window.FIREBASE_CONFIG=%s;' "$FIREBASE_CONFIG" > js/firebase-config.js
                         ↓
Static file served by Netlify
                         ↓
<script src="js/firebase-config.js"></script> — populates window.FIREBASE_CONFIG
                         ↓
sync.js reads window.FIREBASE_CONFIG in Sync.init()
```

`.gitignore` excludes `js/firebase-config.js`, so the file only ever exists in Netlify's build container and on the live site. Local development requires creating the file manually.

### 7.8 Array normalization

Firebase Realtime Database serialises arrays as objects when they contain gaps, e.g. `["a","b","c"]` may come back as `{0:"a",1:"b",2:"c"}`. `_applyRemote` handles this with `Object.values(data.history || {})` when the field isn't already an Array.

### 7.9 Status lifecycle

Exposed via `Sync.onStatus(cb)`. The callback receives one of:

- `disconnected` — no room code saved, or config missing.
- `connecting` — initial pull in progress.
- `syncing` — local push in flight.
- `synced` — steady state.
- `error` — Firebase call failed.

UI maps these to a colour on the status dot inside the sync button.

---

## 8. Styling System

### 8.1 Tokens (CSS custom properties)

All theme-aware colours live on `:root` with a dark-mode override via both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` for future manual-toggle support.

Representative tokens (see `css/styles.css` lines 1–90 for the full list):

| Token | Light | Dark |
|---|---|---|
| `--bg-start` | `rgb(245,250,255)` | `rgb(20,26,36)` |
| `--bg-end` | `rgb(230,235,255)` | `rgb(15,18,26)` |
| `--text-primary` | `rgba(0,0,0,0.85)` | `#ffffff` |
| `--text-secondary` | `rgba(0,0,0,0.55)` | `rgba(255,255,255,0.6)` |
| `--card-bg` | `rgba(255,255,255,0.7)` | `rgba(44,44,46,0.92)` |
| `--weekly-card-bg` | `rgba(255,255,255,0.75)` | `rgba(255,255,255,0.06)` |
| `--tab-bg` | `rgba(255,255,255,0.85)` | `rgba(30,30,34,0.9)` |
| `--tab-active` | `rgb(59,130,246)` | `rgb(100,160,255)` |
| `--shadow-opacity` | `0.04` | `0.6` |

### 8.2 Kid colours

Treated as first-class design tokens, hard-coded in `KIDS` in `app.js`:

- Isabella: `rgb(250, 133, 166)` (pink)
- Viviana: `rgb(107, 176, 232)` (blue)

Used for: card gradient background, progress bar fill, achievement card accent, history row left border, gem bar dot, duration badges.

### 8.3 Typography

System font stack — `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif`. Time displays and tabular data use `font-variant-numeric: tabular-nums` with `"SF Pro Rounded"` as a preferred face.

| Role | Size |
|---|---|
| Page title (h1) | 1.75rem / 700 |
| Kid name on card | 1.15rem / 600 |
| Time display | 2.625rem / tabular |
| Section header | 0.8rem uppercase |
| Tab label | 0.7rem |

### 8.4 Responsive breakpoints

| Width | Clock size | Card layout |
|---|---|---|
| < 480 px | 160 px | 1 col |
| 480–899 px | 200 px | 1 col |
| ≥ 900 px | 220 px | **row** (`flex-direction: row` override) |

### 8.5 Animation inventory

| Name | Where | Purpose |
|---|---|---|
| `cardIn` | `.stopwatch-card` | 0.4 s spring entrance, staggered by `animation-delay` |
| `pulseGlow` | `.stopwatch-card.running` | 2 s infinite, kid-coloured shadow pulse |
| `spinCW` | `.sync-btn.spin` | 1 s linear infinite rotation during sync |
| `achUnlock` | `.ach-card.unlocked` | Fade-in + scale-up when rendered unlocked |
| Toast slide | `.ach-toast` | Bounce slide-in from top, 3.5 s life |
| Canvas confetti | `<canvas>` at `z-index: 9999` | 80 particles, 3 s duration, gravity + wobble |

---

## 9. PWA & Offline

### 9.1 Service worker (`sw.js`)

- Cache name: **`kids-stopwatch-v3`** (bump when assets change to force refresh).
- Precaches `/`, `index.html`, CSS, all 8 `js/*.js` files, manifest.
- Strategy: cache-first with network fallback; successful network GETs are written back into the cache.
- Navigation fallback: if the user is offline and requests a page, returns `/index.html`.
- `skipWaiting` + `clients.claim` — new SW becomes active on next load without a second refresh.

### 9.2 Manifest

```json
{
  "name": "Kids Stopwatch",
  "short_name": "KidsTimer",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#6bb0e8",
  "background_color": "#f5faff",
  "icons": [ { "src": "icons/icon-192.png", "purpose": "any maskable" },
             { "src": "icons/icon-512.png", "purpose": "any maskable" } ]
}
```

### 9.3 Offline behaviour

- App shell, stopwatch interaction, history, achievements: all work offline from cache.
- Firebase sync: pending writes queue in the Firebase SDK and flush when connectivity returns. `Sync.onStatus` reports `error` if the initial pull fails while offline.

---

## 10. Deployment

### 10.1 Netlify

`netlify.toml`:

```toml
[build]
  publish = "."
  command = "printf 'window.FIREBASE_CONFIG=%s;' \"$FIREBASE_CONFIG\" > js/firebase-config.js"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

The build command is the only "build step": a one-liner that writes the Firebase config into a gitignored file at deploy time.

### 10.2 CI / tests

None. Pushes to `main` on GitHub auto-deploy to Netlify; there are no tests, linters, or pre-commit hooks in CI.

### 10.3 Security posture (snapshot)

- ✅ Firebase config excluded from git; injected at build time.
- ✅ Basic clickjacking + MIME protections via Netlify headers.
- ⚠️  Firebase Realtime Database rules are likely still in **test mode** (open read/write for 30 days). Must be locked down — see `IMPROVEMENTS.md` § P0.
- ⚠️  Room codes are 30 bits of entropy; discoverable by a determined brute-forcer. Acceptable for a family app but not a public service.
- ⚠️  No CSP, no HSTS, no Referrer-Policy headers.

---

## 11. Known issues referenced in IMPROVEMENTS.md

- Sync echo race (`ignoreNextRemote` flag timing).
- History sort order not enforced in `saveHistory`.
- `prevStreaks` milestone detection misses streaks reached via non-timer-tab actions.
- `localStorage` quota not checked.
- Accessibility gaps: ARIA roles, focus rings, `prefers-reduced-motion`.
- Full `innerHTML` rewrites on every tab re-render.

See `docs/IMPROVEMENTS.md` for severity, rationale, and proposed fixes.
