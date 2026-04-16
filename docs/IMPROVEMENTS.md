# Kids Stopwatch — Improvement Backlog

> Prioritized suggestions derived from a full audit of the codebase. Each item includes **why it matters**, **suggested approach**, and the **files** most affected.
>
> Priority:
> - **P0** — correctness or security risks; address soon.
> - **P1** — meaningful UX/accessibility or DX gaps.
> - **P2** — polish, architecture, and future features.

---

## P0 — Correctness & Security

### 0.1 Lock down Firebase Realtime Database rules
**Why.** The database was created in *test mode*, which allows unauthenticated read/write to the entire `/` tree and auto-expires after 30 days. At expiry, sync stops working; before expiry, anyone who guesses (or sees) a room code can read and write family data.

**Suggested rules** (paste under **Realtime Database → Rules**):

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read":  "$code.length === 6",
        ".write": "$code.length === 6 && (!data.exists() || newData.child('updatedAt').isNumber())",
        ".validate": "newData.hasChildren(['updatedAt'])"
      }
    }
  }
}
```

This keeps rooms unauthenticated (the app has no login), but requires a 6-character path and an `updatedAt` on every write — enough to block accidental malformed writes from the console.

**Longer-term.** Move to Firebase Anonymous Auth with room codes hashed in rules, or add App Check to rate-limit writes. See § 3.3.

**Files.** Firebase console only; no code change.

---

### 0.2 Sync echo race
**Why.** In `sync.js:_pushNow`, `ignoreNextRemote = true` is set *before* `ref.set()`, but the flag is cleared 1500 ms after the *promise resolves*. If two devices push within that window, device B's push arrives via the listener while device A still has `ignoreNextRemote` armed — silent data loss.

**Also.** The listener fires once immediately when first attached; if a push is in flight at the same time, the order isn't guaranteed.

**Suggested approach.**
1. Stamp each push with a client-side UUID in `_gatherLocal()` as `clientWriteId`.
2. Track the last N write IDs locally; `_applyRemote` skips snapshots whose `clientWriteId` is one of ours.
3. Use `ref.update()` on individual fields rather than `ref.set()` so concurrent writes from different devices merge rather than overwrite.

**Files.** `js/sync.js`.

---

### 0.3 History sort order not enforced
**Why.** `renderHistoryList` (history.js) assumes `history[0]` is the newest entry and groups sequentially by date. The actual ordering depends on `history.unshift(entry)` in `app.js:toggleStopwatch`. After a Firebase pull, the array is re-hydrated from whatever Firebase stored; if two devices save out of order, groups will render wrong.

**Suggested approach.** Sort on read:

```js
function loadHistory() {
  // … existing parse …
  return parsed.sort((a, b) => b.timestamp - a.timestamp);
}
```

**Files.** `js/storage.js`.

---

### 0.4 localStorage quota unhandled
**Why.** Two kids doing one daily session for a year is ~730 entries × ~100 bytes ≈ 73 KB — well under the 5 MB quota. But there's no pruning; a long-running household could eventually hit `QuotaExceededError` and all writes would silently fail (Storage writes throw synchronously).

**Suggested approach.**
1. In `saveHistory`, if entries > 2000, drop the oldest 10 % before saving.
2. Wrap `localStorage.setItem` in try/catch; on quota error, prune and retry once; else log and `Sync._setStatus('error')`.

**Files.** `js/storage.js`.

---

### 0.5 Missing `Sync.push()` on `setFreezeTrackingStart`
**Why.** `setFreezeTrackingStart(date)` is an exported function but does not call `_sync()`. If ever invoked (currently dormant), the write would only hit the local device.

**Suggested approach.** Add `_sync()` at the end of the function for parity with its siblings.

**Files.** `js/storage.js`.

---

## P1 — UX & Accessibility

### 1.1 ARIA roles & semantic gaps
**Why.** Screen readers can't meaningfully navigate the app. The tab bar uses `<button>` with no `role="tab"`, the modal has no `role="dialog"`, and the sync button's label is conveyed only via a `title` attribute (announced by some readers, not others).

**Suggested approach.**

- `<nav class="tab-bar" role="tablist">` and each `<button class="tab" role="tab" aria-selected="true|false" aria-controls="timers-view">`.
- Modal backdrop: `role="dialog" aria-modal="true" aria-labelledby="sync-modal-title"`.
- Sync button: add `aria-label="Sync settings"` in addition to `title`.
- Status dot: add `<span class="visually-hidden">Sync status: synced</span>` that updates with the status.

**Files.** `index.html`, `css/styles.css` (add `.visually-hidden` utility), `js/app.js` (update aria-selected on tab switch).

---

### 1.2 No `:focus-visible` styles
**Why.** Keyboard users lose track of focus — critical on the tab bar and sync modal. Browsers strip default outlines on buttons with backgrounds.

**Suggested approach.** Add a uniform focus ring:

```css
:where(button, input, [tabindex]):focus-visible {
  outline: 2px solid var(--tab-active);
  outline-offset: 2px;
  border-radius: inherit;
}
```

**Files.** `css/styles.css`.

---

### 1.3 Ignore motion-sensitive users
**Why.** Confetti, `pulseGlow`, card `cardIn` entrance, and slide-in toasts fire regardless of `prefers-reduced-motion`. Some users (vestibular disorders) experience discomfort.

**Suggested approach.**

```css
@media (prefers-reduced-motion: reduce) {
  .stopwatch-card { animation: none; }
  .stopwatch-card.running { animation: none; }
  .ach-toast { transition: none; }
  .ach-card.unlocked { animation: none; }
  .sync-btn.spin .sync-icon { animation: none; }
}
```

Plus in `confetti.js`:

```js
function launch() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // …existing code
}
```

**Files.** `css/styles.css`, `js/confetti.js`.

---

### 1.4 Color-only status indicators
**Why.** The sync status dot (grey/orange/blue/green/red) and the streak flame badge rely on colour alone. Colour-vision-impaired users can't distinguish states.

**Suggested approach.**
- Sync button: change the central icon itself to match status (checkmark for synced, refresh-spinning for syncing, warning triangle for error, plug-unplugged for disconnected).
- Streak badge: add a small "X days" label beside the flame icon.

**Files.** `index.html`, `css/styles.css`, `js/app.js`.

---

### 1.5 Modal doesn't close on Escape
**Why.** Standard modal UX; also helps keyboard users.

**Suggested approach.** In `setupSync`:

```js
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && backdrop.classList.contains('visible')) {
    backdrop.classList.remove('visible');
  }
});
```

Also trap Tab focus within the modal while open (a minimal loop through focusable children is enough for a 3-button modal).

**Files.** `js/app.js`.

---

### 1.6 Milestone confetti misses some streaks
**Why.** `prevStreaks[kid]` is updated in `updateStreakDisplay` — called after a pause on the Timers tab. If a late-night session is saved from a device that's currently showing the Achievements tab (or from another device via sync), the milestone crossing is silently missed on the receiving device.

**Suggested approach.**

1. Persist `prevStreaks` to localStorage (new key `lastKnownStreaks` as `{ kidName: N }`).
2. Check milestones immediately after `checkAchievements` in `toggleStopwatch` and also in the sync `onRemoteUpdate` callback.
3. The check is cheap; always compare previous saved streak vs new computed streak.

**Files.** `js/app.js`, `js/storage.js`.

---

## P2 — Architecture & Developer Experience

### 2.1 Consolidate `stopwatch.js` + `achievements.js`
**Why.** They share conceptual turf — both compute things from `history` — but `stopwatch.js` has `streakInfo` while `achievements.js` has `computeKidStats` (which calls `streakInfo`). Contributors have to know both to understand streaks.

**Suggested approach.** Create `js/stats.js` that owns `computeKidStats`, `streakInfo`, `currentStreak`, and all date helpers. Leave `stopwatch.js` with *only* timer-tick math and formatting; rename to `timer.js`.

**Files.** `js/*.js`, `index.html` (script tags), `sw.js` (cache list).

---

### 2.2 Add a minimal test harness for pure functions
**Why.** `streakInfo`, `getProgressHint`, `formatDuration`, `formatWeeklyTotal`, and the history day-grouping are pure and easy to regress. A developer tweaking the streak algorithm could silently break the freeze accounting.

**Suggested approach.** Use Node's built-in test runner — no dependencies:

```bash
mkdir tests
node --test tests/streakInfo.test.mjs
```

Write ~10 cases covering: no entries, one entry today, 5-day streak, gap filled by freeze, gap beyond freezes, streak crossing `freezeTrackingStart`.

**Files.** new `tests/`, optionally a `package.json` with `"test": "node --test tests"`.

---

### 2.3 Dynamic kid configuration
**Why.** Adding a third kid today requires editing `KIDS` in `app.js` and redeploying. The achievements, gems, and sync infra already support N kids.

**Suggested approach.** A small Settings view (new fourth tab, or gear icon in header) with:
- Add/remove/rename kid.
- Colour picker (pre-set palette: the current two plus green `rgb(120,200,130)`, purple `rgb(180,130,220)`, orange `rgb(255,160,80)`).
- Store in localStorage as `kidsConfig`, sync to Firebase under `kids`.

**Files.** `index.html`, `js/app.js`, `js/storage.js`, `js/sync.js` (new `kids` field).

---

### 2.4 Commit convention
**Why.** Recent commits use informal but consistent messages. Formalising helps future auto-generated changelogs and makes `git log --oneline` readable at a glance.

**Suggested approach.** Adopt Conventional Commits:

```
feat: add weekly goals per kid
fix: prevent confetti race on remote streak updates
docs: add IMPROVEMENTS backlog
refactor: extract stats module
```

Optionally install `commitlint` + `husky` later; for now, honour-system.

---

## P2 — Features

### 2.5 Import / Export JSON
**Why.** A low-risk belt-and-braces backup option alongside Firebase sync. Great for switching to a new Firebase project or recovering from a rules lockout.

**Suggested approach.** A pair of buttons in the sync modal:
- **Export:** serialize all 5 storage keys to a `.json` file, trigger a browser download with filename `kids-stopwatch-backup-YYYY-MM-DD.json`.
- **Import:** file picker → parse → confirm dialog showing record counts → overwrite localStorage → `Sync.push()` → re-render.

**Files.** `index.html` (buttons), `js/app.js` (handlers), `js/storage.js` (bulk writer).

---

### 2.6 Weekly goals per kid
**Why.** The weekly summary card already shows total time; a goal turns a number into motivation. Pairs well with the achievement system.

**Suggested approach.** Per-kid goal field (default 150 min/week). Weekly card renders a progress ring around the total time. At 100 % award 5 bonus gems + confetti; track new achievement `goal_hit_4_weeks`.

**Files.** `js/history.js`, `js/achievements.js`, `js/storage.js`, `css/styles.css`.

---

### 2.7 Parent lock on Achievements tab
**Why.** Kids poking around shouldn't be able to burn gems on freezes (or clear history through the delete button in History).

**Suggested approach.** Optional 4-digit PIN stored in localStorage (hashed with SubtleCrypto SHA-256). When set, opening the Achievements tab or tapping delete shows a PIN pad. Skippable — default off.

**Files.** `index.html`, `js/app.js`, `js/storage.js`, `css/styles.css`.

---

### 2.8 Sound effects
**Why.** Audio feedback is delightful for kids and reinforces the milestone moment.

**Suggested approach.** Inline small `.wav` or base64 data-URI WebAudio buffers for: tick-on-start, ding-on-pause, fanfare-on-milestone. Respect a settings-modal "Sound" toggle; mute when `document.hidden`.

**Files.** new `js/sfx.js`, wire-ups in `js/app.js`.

---

### 2.9 Shareable achievement cards
**Why.** Parents love sharing wins. A "Share" button on a newly unlocked achievement toast would bump engagement.

**Suggested approach.** Render a `<canvas>` at 1080×1080 with the kid's name, achievement icon + title, gem reward, and a subtle branded footer. Use `canvas.toBlob()` + the Web Share API (`navigator.share({ files: [blob] })`) on mobile, download fallback on desktop.

**Files.** new `js/share.js`, `js/app.js` (wire into toast).

---

### 2.10 Richer UI for > 2 kids (pairs with 2.3)
**Why.** The current 2-up horizontal desktop layout breaks when more kids are added.

**Suggested approach.** Use CSS grid with `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`. Stopwatch cards wrap naturally at any kid count and any viewport width.

**Files.** `css/styles.css` (`.stopwatch-container`).

---

## P2 — Performance

### 2.11 Avoid full `innerHTML` rewrites
**Why.** On every tab switch (and every `onRemoteUpdate`), `renderHistoryList` and `renderAchievementsView` blow away their container and rebuild. For a family with 500+ history entries this is 50 ms+ of layout work on mid-tier phones and scroll position is lost.

**Suggested approach.**

- Preserve scroll: save `scrollTop` before render, restore after.
- Incremental updates: for remote updates, diff the new history array against the old and only patch changed rows (maintain a `Map<id, HTMLElement>`).
- Or, cheaper: render only the first 50 rows, lazy-load the rest on scroll (IntersectionObserver sentinel).

**Files.** `js/history.js`, `js/achievements.js`.

---

### 2.12 Firebase: finer-grained listeners
**Why.** `ref('rooms/' + code).on('value', …)` fires on any write anywhere under the room. A gem bump re-renders the entire active tab.

**Suggested approach.** Attach separate listeners on `/rooms/{code}/history`, `/rooms/{code}/gems`, etc., and in each handler call only the relevant renderer (`renderGemBar` for gems changes, `renderHistory` for history changes).

**Files.** `js/sync.js`, `js/app.js`.

---

## 3. Recommended sequencing

If time is the constraint, this is the proposed order:

1. **P0.1 Firebase rules** — do this today, before 30-day expiry.
2. **P0.3 history sort** — 10-line change, prevents visible bugs after first cross-device write.
3. **P0.2 sync echo race** — 30-minute change, silent data-loss fix.
4. **P1.1 ARIA + P1.2 focus rings + P1.3 reduced motion** — batch these as an a11y pass.
5. **P1.6 milestone confetti fix** — one-evening change, nicely user-visible.
6. **P2.1 consolidate stats module** — do before the codebase grows further.
7. **P2.2 test harness** — do together with P2.1 so the refactor is validated.
8. Features & performance items on demand.

---

## 4. Out of scope (deliberate non-goals)

These have been considered and are **not** recommended right now:

- **Moving to a framework (React/Svelte/Vue).** The app is 1.5 k LOC; the cognitive overhead of a framework + build step outweighs benefits.
- **TypeScript.** Same reasoning. JSDoc comments on the public module APIs would capture 80 % of the benefit with zero tooling.
- **User accounts / authentication.** Family-scale app; room codes are sufficient and frictionless. Revisit only if sharing outside the family becomes a use case.
- **Server-side render / static generation.** No benefit for a logged-in-state-free static app.
