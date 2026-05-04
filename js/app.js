// App entry point

// Dynamic kids config (loaded from localStorage; falls back to defaults on first run)
let KIDS = [];
let stopwatches = [];
let history = Storage.loadHistory();

// Rebuild the KIDS array and stopwatch runtime state from storage.
// Archived kids are excluded from the stopwatches list but their data is preserved.
function loadKids() {
  const all = Storage.loadKidsConfig();
  KIDS = all.filter(k => !k.archived);
  // Preserve any running timers when possible (match by name)
  const previouslyRunning = {};
  stopwatches.forEach(sw => {
    if (sw.isRunning || sw.time > 0) {
      previouslyRunning[sw.name] = {
        time: sw.time,
        isRunning: sw.isRunning,
        startedAt: sw.startedAt,
        accumulatedTime: sw.accumulatedTime,
      };
    }
  });
  stopwatches = KIDS.map(kid => {
    const prev = previouslyRunning[kid.name];
    return {
      name: kid.name,
      color: kid.color,
      avatar: kid.avatar || '⭐',
      time: prev ? prev.time : 0,
      isRunning: prev ? prev.isRunning : false,
      startedAt: prev ? prev.startedAt : null,
      accumulatedTime: prev ? prev.accumulatedTime : 0,
      repsDay: todayKey(),    // which day's reps are being viewed on this card
      elements: {}
    };
  });
}
loadKids();

let intervalId = null;
const originalTitle = 'Kids Stopwatch';
// Track previous streak values to detect milestone transitions
const prevStreaks = {};

// === Rendering ===

function isDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Apply stored theme preference to <html data-theme>
function applyThemePreference() {
  const pref = Storage.getThemePreference();
  if (pref === 'light' || pref === 'dark') {
    document.documentElement.setAttribute('data-theme', pref);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setThemePreference(pref) {
  Storage.setThemePreference(pref);
  applyThemePreference();
  renderStopwatchCards();
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    const tab = activeTab.dataset.tab;
    if (tab === 'history') renderHistory(history, KIDS, deleteHistoryEntry);
    if (tab === 'achievements') renderAchievementsView(KIDS, history);
  }
}

function renderGemBar() {
  const bar = document.getElementById('gem-bar');
  if (!bar) return;
  bar.innerHTML = '';
  KIDS.forEach(kid => {
    const gems = Storage.getGems(kid.name);
    const item = document.createElement('div');
    item.className = 'gem-bar-item';
    item.innerHTML = `
      <span class="gem-bar-avatar">${kid.avatar || '⭐'}</span>
      <span class="gem-bar-name">${kid.name}</span>
      <span class="gem-bar-count">💎 ${gems}</span>
    `;
    bar.appendChild(item);
  });
}

function renderStopwatchCards() {
  const container = document.getElementById('stopwatch-container');
  container.innerHTML = '';

  stopwatches.forEach((sw, index) => {
    const card = document.createElement('div');
    card.className = 'stopwatch-card';

    // Card styling based on color
    const dark = isDark();
    if (dark) {
      card.style.background = 'rgba(44, 44, 46, 0.92)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    } else {
      card.style.background = `linear-gradient(135deg, ${sw.color.replace(')', ', 0.12)').replace('rgb', 'rgba')}, ${sw.color.replace(')', ', 0.04)').replace('rgb', 'rgba')})`;
      card.style.border = `1px solid ${sw.color.replace(')', ', 0.15)').replace('rgb', 'rgba')}`;
    }
    card.style.animationDelay = `${index * 0.08}s`;

    // Build card HTML
    card.innerHTML = `
      <div class="card-header">
        <div class="card-name">
          <span class="card-avatar-wrap">
            <span class="card-avatar">${sw.avatar || '⭐'}</span>
          </span>
          <span>${sw.name}</span>
        </div>
        <div class="card-badges">
          <div class="streak-badge" style="background: rgba(234, 149, 30, ${dark ? 0.28 : 0.18})">
            <span class="streak-info">&#128293; <span class="streak-count">0d</span></span>
            <div class="divider" style="opacity: ${dark ? 0.5 : 0.35}"></div>
            <span class="streak-info">&#10052;&#65039; <span class="freeze-count">2</span></span>
          </div>
          <div class="status-badge" style="background: ${sw.color.replace(')', ', 0.15)').replace('rgb', 'rgba')}; color: ${sw.color}">
            Paused
          </div>
        </div>
      </div>
      <div class="time-display">00:00.00</div>
      <div class="button-row">
        <button class="btn btn-primary">&#9654; Start</button>
        <button class="btn btn-done" disabled>&#10003; Done</button>
        <button class="btn btn-reset">Reset</button>
      </div>
      <div class="reps-row">
        <div class="reps-day-switcher">
          <button class="reps-day-nav" data-dir="-1" aria-label="Previous day">‹</button>
          <span class="reps-day-label" data-role="reps-day-label">Today</span>
          <button class="reps-day-nav" data-dir="1" aria-label="Next day">›</button>
        </div>
        <button class="btn-log-minutes" data-role="log-minutes-btn">+ Log minutes for Today</button>
        <div class="reps-line" data-kind="pullups">
          <span class="reps-label">💪 Pull-ups</span>
          <span class="reps-count" data-role="pullups-count">0</span>
          <div class="reps-buttons">
            <button class="reps-btn" data-op="dec" data-kind="pullups" aria-label="Remove pull-up">−</button>
            <button class="reps-btn" data-op="inc" data-kind="pullups" aria-label="Add pull-up">+1</button>
            <button class="reps-btn reps-btn-wide" data-op="inc5" data-kind="pullups" aria-label="Add 5 pull-ups">+5</button>
          </div>
        </div>
        <div class="reps-line" data-kind="pushups">
          <span class="reps-label">💪 Push-ups</span>
          <span class="reps-count" data-role="pushups-count">0</span>
          <div class="reps-buttons">
            <button class="reps-btn" data-op="dec" data-kind="pushups" aria-label="Remove push-up">−</button>
            <button class="reps-btn" data-op="inc" data-kind="pushups" aria-label="Add push-up">+1</button>
            <button class="reps-btn reps-btn-wide" data-op="inc5" data-kind="pushups" aria-label="Add 5 push-ups">+5</button>
          </div>
        </div>
        <div class="reps-sparkline" data-role="reps-sparkline" aria-hidden="true"></div>
      </div>
    `;

    // Store element refs
    sw.elements = {
      card,
      timeDisplay: card.querySelector('.time-display'),
      statusBadge: card.querySelector('.status-badge'),
      streakCount: card.querySelector('.streak-count'),
      freezeCount: card.querySelector('.freeze-count'),
      btnPrimary: card.querySelector('.btn-primary'),
      btnDone: card.querySelector('.btn-done'),
      btnReset: card.querySelector('.btn-reset'),
      pullupsCount: card.querySelector('[data-role="pullups-count"]'),
      pushupsCount: card.querySelector('[data-role="pushups-count"]'),
      repsDayLabel: card.querySelector('[data-role="reps-day-label"]'),
      repsDayBtns: card.querySelectorAll('.reps-day-nav'),
      logMinutesBtn: card.querySelector('[data-role="log-minutes-btn"]'),
      sparkline: card.querySelector('[data-role="reps-sparkline"]'),
    };

    // Button styles
    sw.elements.btnPrimary.style.background = `linear-gradient(90deg, ${sw.color}, ${sw.color.replace(')', ', 0.75)').replace('rgb', 'rgba')})`;
    sw.elements.btnPrimary.style.boxShadow = `0 6px 8px ${sw.color.replace(')', ', 0.35)').replace('rgb', 'rgba')}`;

    sw.elements.btnReset.style.border = `1.2px solid ${sw.color.replace(')', ', 0.5)').replace('rgb', 'rgba')}`;
    sw.elements.btnReset.style.color = sw.color;

    // Event listeners
    sw.elements.btnPrimary.addEventListener('click', () => toggleStopwatch(index));
    sw.elements.btnDone.addEventListener('click', () => doneStopwatch(index));
    sw.elements.btnReset.addEventListener('click', () => resetStopwatch(index));

    // Day switcher for reps
    sw.elements.repsDayBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        shiftRepsDay(index, dir);
      });
    });

    // Inline "Log minutes" — opens backfill modal pre-filled to this kid + selected day
    if (sw.elements.logMinutesBtn) {
      sw.elements.logMinutesBtn.style.borderColor = colorWithAlpha(sw.color, 0.45);
      sw.elements.logMinutesBtn.style.color = sw.color;
      sw.elements.logMinutesBtn.addEventListener('click', () => openBackfillForKid(index));
    }

    // Reps buttons (+/-/+5 with long-press for fast entry on single-step ops)
    card.querySelectorAll('.reps-btn').forEach(btn => {
      const kind = btn.dataset.kind;     // "pullups" | "pushups"
      const op = btn.dataset.op;         // "inc" | "inc5" | "dec"
      const delta = op === 'inc5' ? 5 : op === 'dec' ? -1 : 1;

      // Tap
      btn.addEventListener('click', () => adjustReps(index, kind, delta));

      // Long-press auto-repeat (only for single-step +/-1)
      if (op !== 'inc5') {
        let holdTimeout = null;
        let repeatInterval = null;
        const startHold = (e) => {
          // Don't start hold for right click or multi-touch
          if (e.button && e.button !== 0) return;
          holdTimeout = setTimeout(() => {
            repeatInterval = setInterval(() => {
              adjustReps(index, kind, delta);
            }, 80);
          }, 450);
        };
        const endHold = () => {
          if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
          if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
        };
        btn.addEventListener('pointerdown', startHold);
        btn.addEventListener('pointerup', endHold);
        btn.addEventListener('pointerleave', endHold);
        btn.addEventListener('pointercancel', endHold);
      }
    });

    container.appendChild(card);

    // Update streak + reps display
    updateStreakDisplay(index);
    updateRepsDisplay(index);
  });
}

// === Reps ===

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Pretty label for a YYYY-MM-DD key relative to today
function repsDayLabel(dayKey) {
  const today = todayKey();
  if (dayKey === today) return 'Today';
  const [y, m, d] = dayKey.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const msPerDay = 86400000;
  const diffDays = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - target) / msPerDay);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return target.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateRepsDisplay(index) {
  const sw = stopwatches[index];
  const day = sw.repsDay || todayKey();
  const reps = Storage.getReps(sw.name, day);
  if (sw.elements.pullupsCount) sw.elements.pullupsCount.textContent = reps.pullups;
  if (sw.elements.pushupsCount) sw.elements.pushupsCount.textContent = reps.pushups;
  if (sw.elements.repsDayLabel) sw.elements.repsDayLabel.textContent = repsDayLabel(day);

  if (sw.elements.repsDayBtns) {
    sw.elements.repsDayBtns.forEach(btn => {
      if (parseInt(btn.dataset.dir, 10) === 1) {
        btn.disabled = day === todayKey();
      }
    });
  }

  if (sw.elements.logMinutesBtn) {
    sw.elements.logMinutesBtn.textContent = `+ Log minutes for ${repsDayLabel(day)}`;
  }

  renderSparkline(sw);
}

// Render 7-day sparkline (pull-ups above the center line, push-ups below)
function renderSparkline(sw) {
  const el = sw.elements.sparkline;
  if (!el) return;

  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const r = Storage.getReps(sw.name, key);
    days.push({ key, pullups: r.pullups, pushups: r.pushups, isToday: i === 0 });
  }
  const maxPull = Math.max(1, ...days.map(d => d.pullups));
  const maxPush = Math.max(1, ...days.map(d => d.pushups));
  const hasAny = days.some(d => d.pullups > 0 || d.pushups > 0);

  if (!hasAny) { el.innerHTML = ''; el.classList.remove('visible'); return; }
  el.classList.add('visible');

  const W = 7 * 18;   // 7 days × 18 px
  const H = 44;
  const midY = H / 2;
  let bars = '';
  days.forEach((d, i) => {
    const x = i * 18 + 3;
    const barW = 12;
    if (d.pullups > 0) {
      const h = Math.max(2, (d.pullups / maxPull) * (midY - 2));
      bars += `<rect x="${x}" y="${midY - h}" width="${barW}" height="${h}" fill="${sw.color}" opacity="${d.isToday ? 1 : 0.55}" rx="2"/>`;
    }
    if (d.pushups > 0) {
      const h = Math.max(2, (d.pushups / maxPush) * (midY - 2));
      bars += `<rect x="${x}" y="${midY + 1}" width="${barW}" height="${h}" fill="${sw.color}" opacity="${d.isToday ? 0.7 : 0.35}" rx="2"/>`;
    }
  });
  el.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="7-day rep trend">
      <line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
      ${bars}
    </svg>
    <div class="reps-sparkline-legend"><span>💪 pull</span><span>push</span></div>
  `;
}

function shiftRepsDay(index, dir) {
  const sw = stopwatches[index];
  const current = sw.repsDay || todayKey();
  const [y, m, d] = current.split('-').map(Number);
  const next = new Date(y, m - 1, d + dir);
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;

  // Don't allow future dates
  if (nextKey > todayKey()) return;
  // Don't go more than ~30 days back
  const today = new Date();
  const msBack = today - next;
  if (msBack > 30 * 86400000) return;

  sw.repsDay = nextKey;
  updateRepsDisplay(index);
}

function adjustReps(index, kind, delta) {
  const sw = stopwatches[index];
  const day = sw.repsDay || todayKey();
  const current = Storage.getReps(sw.name, day);
  const next = {
    pullups: current.pullups + (kind === 'pullups' ? delta : 0),
    pushups: current.pushups + (kind === 'pushups' ? delta : 0),
  };
  // Clamp to zero
  next.pullups = Math.max(0, next.pullups);
  next.pushups = Math.max(0, next.pushups);

  // No-op if nothing changed (e.g. tapping − at 0)
  if (next.pullups === current.pullups && next.pushups === current.pushups) return;

  Storage.setReps(sw.name, day, next);
  updateRepsDisplay(index);

  // Check for new achievements (don't fire on decrements)
  if (delta > 0) {
    const newAch = checkAchievements(sw.name, history);
    renderGemBar();
    if (newAch.length > 0) {
      Confetti.launch();
      showAchievementToast(sw.name, newAch);
    }
    // Undo toast for +5 overshoots (not every +1 — would be spammy)
    if (Math.abs(delta) >= 5) {
      const snapshot = { ...current };
      showUndoToast(`${sw.name}: +${delta} ${kind === 'pullups' ? 'pull' : 'push'}-ups`, () => {
        Storage.setReps(sw.name, day, snapshot);
        updateRepsDisplay(index);
        renderGemBar();
      });
    }
  }
}

function colorWithAlpha(color, alpha) {
  return color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
}

// === Stopwatch Logic ===

// Toggle running / paused. Does NOT save the session any more —
// that's what the Done button is for.
function toggleStopwatch(index) {
  const sw = stopwatches[index];

  if (sw.isRunning) {
    // Pause — keep accumulated time, do not save
    sw.accumulatedTime = sw.time;
    sw.startedAt = null;
    sw.isRunning = false;
  } else {
    // Start (or resume)
    sw.startedAt = Date.now() - (sw.accumulatedTime * 1000);
    sw.isRunning = true;
    ensureTimer();
  }

  updateStopwatchDisplay(index);
  updateStreakDisplay(index);
}

// Finish the session: save to history, fire achievements, reset timer.
// Works whether the timer is running or paused, as long as time > 0.
function doneStopwatch(index) {
  const sw = stopwatches[index];
  if (sw.time <= 0) return;

  const savedDuration = sw.time;
  const gemsBefore = Storage.getGems(sw.name);

  // Stop running
  sw.accumulatedTime = sw.time;
  sw.startedAt = null;
  sw.isRunning = false;

  // Record history entry
  const entry = {
    id: generateId(),
    childName: sw.name,
    duration: savedDuration,
    timestamp: new Date().toISOString()
  };
  history.unshift(entry);
  Storage.saveHistory(history);
  _lastCompletedEntryId = entry.id;
  const sn = document.getElementById('sc-note');
  if (sn) sn.value = '';
  if (document.getElementById('history-view').classList.contains('active')) {
    renderHistory(history, KIDS, deleteHistoryEntry);
  }

  // Achievements
  const newAchievements = checkAchievements(sw.name, history);

  // Weekly goal bonus + check
  const goalBonusHit = checkWeeklyGoalHit(sw.name);
  renderGemBar();

  // Compute total gem delta earned this tap
  const gemsAfter = Storage.getGems(sw.name);
  const gemDelta = gemsAfter - gemsBefore;
  if (gemDelta > 0) showGemDelta(sw.name, gemDelta);

  // Streak milestone (independent of achievements)
  const newInfo = streakInfo(sw.name, history);
  const prev = prevStreaks[sw.name] || 0;
  const milestoneHit = newInfo.streak > prev && Confetti.isMilestone(newInfo.streak);

  // Celebrate
  if (newAchievements.length > 0 || milestoneHit || goalBonusHit) {
    Confetti.launch();
  }
  showSessionComplete(sw, savedDuration, newAchievements, goalBonusHit ? 5 : 0);

  // Reset timer
  sw.time = 0;
  sw.accumulatedTime = 0;

  updateStopwatchDisplay(index);
  updateStreakDisplay(index);
}

// === Session Complete celebration ===

function showSessionComplete(sw, durationSeconds, newAchievements, goalBonusGems) {
  const backdrop = document.getElementById('session-complete-backdrop');
  const avatar = document.getElementById('sc-avatar');
  const kidEl = document.getElementById('sc-kid');
  const durationEl = document.getElementById('sc-duration');
  const rewardsEl = document.getElementById('sc-rewards');

  avatar.textContent = sw.avatar || '⭐';
  avatar.style.background = colorWithAlpha(sw.color, 0.18);
  avatar.style.borderColor = colorWithAlpha(sw.color, 0.4);
  kidEl.textContent = sw.name;
  kidEl.style.color = sw.color;
  durationEl.textContent = formatDuration(durationSeconds);

  // Rewards
  rewardsEl.innerHTML = '';
  const pieces = [];
  if (goalBonusGems > 0) {
    pieces.push(`<div class="sc-ach">🎯 Weekly goal hit!</div>`);
  }
  if (newAchievements && newAchievements.length > 0) {
    newAchievements.forEach(a => pieces.push(`<div class="sc-ach">${a.icon} ${a.name}</div>`));
  }
  const achGems = (newAchievements || []).reduce((s, a) => s + a.gems, 0);
  const totalGems = achGems + (goalBonusGems || 0);
  if (totalGems > 0) pieces.push(`<div class="sc-gems">+${totalGems} 💎</div>`);
  rewardsEl.innerHTML = pieces.join('');

  backdrop.classList.add('visible');
}

// Small floating gem counter that flies up from the gem bar
function showGemDelta(kidName, delta) {
  const bar = document.getElementById('gem-bar');
  if (!bar) return;
  const items = bar.querySelectorAll('.gem-bar-item');
  // Find the item for this kid (match by text)
  let target = null;
  items.forEach(it => { if (it.textContent.includes(kidName)) target = it; });
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'gem-delta-chip';
  chip.textContent = `+${delta} 💎`;
  chip.style.left = (rect.left + rect.width / 2) + 'px';
  chip.style.top = (rect.top + 2) + 'px';
  document.body.appendChild(chip);
  setTimeout(() => chip.remove(), 1800);
}

// Track the most recent entry across Session Complete interactions
let _lastCompletedEntryId = null;

function setupSessionComplete() {
  const backdrop = document.getElementById('session-complete-backdrop');
  const dismissBtn = document.getElementById('sc-dismiss');
  const noteInput = document.getElementById('sc-note');

  const close = () => {
    // Save the note onto the most recent history entry
    if (_lastCompletedEntryId && noteInput && noteInput.value.trim()) {
      const entry = history.find(e => e.id === _lastCompletedEntryId);
      if (entry) {
        entry.note = noteInput.value.trim().slice(0, 120);
        Storage.saveHistory(history);
        history = Storage.loadHistory();
        if (document.getElementById('history-view').classList.contains('active')) {
          renderHistory(history, KIDS, deleteHistoryEntry);
        }
      }
    }
    _lastCompletedEntryId = null;
    backdrop.classList.remove('visible');
  };

  dismissBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  // Auto-dismiss after 4s if no note interaction
  const observer = new MutationObserver(() => {
    if (backdrop.classList.contains('visible')) {
      setTimeout(() => {
        // Only auto-close if the user hasn't started typing a note
        if (!noteInput || !noteInput.value.trim()) close();
      }, 4000);
    }
  });
  observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
}

function resetStopwatch(index) {
  const sw = stopwatches[index];
  sw.time = 0;
  sw.accumulatedTime = 0;
  sw.startedAt = null;
  sw.isRunning = false;
  updateStopwatchDisplay(index);
}

function ensureTimer() {
  if (intervalId) return;
  intervalId = setInterval(tick, 100);
}

function tick() {
  let anyRunning = false;
  for (const sw of stopwatches) {
    if (sw.isRunning) {
      sw.time = (Date.now() - sw.startedAt) / 1000;
      anyRunning = true;
    }
  }

  // Update displays for running stopwatches
  stopwatches.forEach((sw, i) => {
    if (sw.isRunning) {
      updateTimeDisplay(i);
      // Done button becomes enabled as soon as time > 0
      if (sw.elements.btnDone) sw.elements.btnDone.disabled = sw.time <= 0;
    }
  });

  // #5: Update page title with running time
  updatePageTitle();

  if (!anyRunning) {
    clearInterval(intervalId);
    intervalId = null;
    updatePageTitle(); // Reset title when all stop
  }
}

function updateStopwatchDisplay(index) {
  const sw = stopwatches[index];
  updateTimeDisplay(index);

  // Status badge
  sw.elements.statusBadge.textContent = sw.isRunning ? 'Running' : 'Paused';

  // Primary button label flips between Start / Pause / Resume
  if (sw.isRunning) {
    sw.elements.btnPrimary.innerHTML = '&#10074;&#10074; Pause';
  } else if (sw.time > 0) {
    sw.elements.btnPrimary.innerHTML = '&#9654; Resume';
  } else {
    sw.elements.btnPrimary.innerHTML = '&#9654; Start';
  }

  // Done button: enabled only when there is something to save
  if (sw.elements.btnDone) sw.elements.btnDone.disabled = sw.time <= 0;

  // Pulsing glow on running card
  if (sw.isRunning) {
    sw.elements.card.classList.add('running');
    sw.elements.card.style.setProperty('--glow-color', colorWithAlpha(sw.color, 0.3));
  } else {
    sw.elements.card.classList.remove('running');
  }

  updatePageTitle();
}

function updateTimeDisplay(index) {
  const sw = stopwatches[index];
  sw.elements.timeDisplay.textContent = formatTime(sw.time);
}

// #5: Show running timer in browser tab title
function updatePageTitle() {
  const running = stopwatches.filter(sw => sw.isRunning);
  if (running.length > 0) {
    const names = running.map(sw => `${sw.name} ${formatTime(sw.time)}`).join(' | ');
    document.title = `\u25B6 ${names}`;
  } else {
    document.title = originalTitle;
  }
}

function updateStreakDisplay(index) {
  const sw = stopwatches[index];
  const info = streakInfo(sw.name, history);
  prevStreaks[sw.name] = info.streak; // #1: Track for milestone detection
  sw.elements.streakCount.textContent = info.streak + 'd';
  sw.elements.freezeCount.textContent = info.freezesLeft;
  // Update vacation indicator on status badge
  if (sw.elements.statusBadge) {
    sw.elements.statusBadge.classList.toggle('on-vacation', !!info.onVacation);
    if (info.onVacation && !sw.isRunning) {
      sw.elements.statusBadge.textContent = '🌴 Vacation';
    } else if (!sw.isRunning) {
      sw.elements.statusBadge.textContent = 'Paused';
    }
  }
}

// === Achievement Toast ===

function showAchievementToast(kidName, achievements) {
  // Remove any existing toast
  const existing = document.querySelector('.ach-toast');
  if (existing) existing.remove();

  const gems = achievements.reduce((sum, a) => sum + a.gems, 0);
  const names = achievements.map(a => `${a.icon} ${a.name}`).join(', ');

  const toast = document.createElement('div');
  toast.className = 'ach-toast';
  toast.innerHTML = `
    <div>${kidName}: ${names}<br><span style="font-size:0.85rem; opacity:0.8">+${gems} 💎 earned!</span></div>
    <button class="ach-toast-share" aria-label="Share">Share</button>
  `;
  document.body.appendChild(toast);

  toast.querySelector('.ach-toast-share').addEventListener('click', () => {
    shareAchievement(kidName, achievements[0]);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

// === History ===

function deleteHistoryEntry(index) {
  const removed = history[index];
  history.splice(index, 1);
  Storage.saveHistory(history);
  renderHistory(history, KIDS, deleteHistoryEntry);
  stopwatches.forEach((_, i) => updateStreakDisplay(i));
  if (removed) {
    showUndoToast(`Deleted ${formatDuration(removed.duration)} session`, () => {
      history.push(removed);
      Storage.saveHistory(history);
      history = Storage.loadHistory();
      renderHistory(history, KIDS, deleteHistoryEntry);
      stopwatches.forEach((_, i) => updateStreakDisplay(i));
    });
  }
}

// === Tab Switching ===

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const viewId = tab.dataset.tab + '-view';
      document.getElementById(viewId).classList.add('active');

      if (tab.dataset.tab === 'history') {
        renderHistory(history, KIDS, deleteHistoryEntry);
      }
      if (tab.dataset.tab === 'achievements') {
        renderAchievementsView(KIDS, history);
      }
    });
  });
}

// === Scroll Fade Hint (Achievements tab) ===

function setupScrollFade() {
  const fade = document.getElementById('ach-scroll-fade');
  if (!fade) return;

  function updateFade() {
    const achView = document.getElementById('achievements-view');
    if (!achView || !achView.classList.contains('active')) return;
    const distFromBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    fade.classList.toggle('hidden', distFromBottom < 80);
  }

  window.addEventListener('scroll', updateFade, { passive: true });
  // Also update when tab switches to achievements
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'achievements') {
        fade.classList.remove('hidden');
        requestAnimationFrame(updateFade);
      } else {
        fade.classList.add('hidden');
      }
    });
  });
}

// === Dark Mode Listener ===

function setupDarkModeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    renderStopwatchCards();
  });
}

// === Sync UI ===

function setupSync() {
  const dot = document.getElementById('sync-status-dot');
  const btn = document.getElementById('sync-btn');
  const backdrop = document.getElementById('sync-modal-backdrop');
  const closeBtn = document.getElementById('sync-modal-close');
  const connectedDiv = document.getElementById('sync-connected');
  const disconnectedDiv = document.getElementById('sync-disconnected');
  const codeDisplay = document.getElementById('sync-code-display');
  const copyBtn = document.getElementById('btn-copy-code');
  const createBtn = document.getElementById('btn-create-room');
  const joinInput = document.getElementById('sync-join-input');
  const joinBtn = document.getElementById('btn-join-room');
  const disconnectBtn = document.getElementById('btn-disconnect');

  // Status dot colours
  const STATUS_STYLES = {
    disconnected: { bg: 'rgba(142,142,147,0.6)', spin: false },
    connecting:   { bg: '#ffa500',               spin: true  },
    syncing:      { bg: '#007aff',               spin: true  },
    synced:       { bg: '#34c759',               spin: false },
    error:        { bg: '#ff3b30',               spin: false },
  };

  function updateDot(status) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.disconnected;
    dot.style.background = s.bg;
    btn.classList.toggle('spin', s.spin);
  }

  function refreshModal() {
    const code = Sync.getRoomCode();
    if (code) {
      connectedDiv.style.display = 'block';
      disconnectedDiv.style.display = 'none';
      codeDisplay.textContent = code;
    } else {
      connectedDiv.style.display = 'none';
      disconnectedDiv.style.display = 'block';
    }
  }

  // Open / close
  btn.addEventListener('click', () => {
    refreshModal();
    backdrop.classList.add('visible');
  });
  closeBtn.addEventListener('click', () => backdrop.classList.remove('visible'));
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('visible');
  });

  // Copy code
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(Sync.getRoomCode() || '').then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });

  // Create room
  createBtn.addEventListener('click', () => {
    Sync.createRoom();
    refreshModal();
  });

  // Join room
  function doJoin() {
    const code = joinInput.value.trim().toUpperCase();
    if (code.length < 4) return;
    Sync.joinRoom(code);
    joinInput.value = '';
    refreshModal();
    backdrop.classList.remove('visible');
  }
  joinBtn.addEventListener('click', doJoin);
  joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

  // Disconnect
  disconnectBtn.addEventListener('click', () => {
    Sync.disconnect();
    refreshModal();
  });

  // Wire up status callback
  Sync.onStatus(updateDot);

  // Callback when Firebase pushes fresh data from another device
  function onRemoteUpdate() {
    // Reload everything from localStorage (just updated by Sync)
    history = Storage.loadHistory();
    loadKids();
    renderStopwatchCards();
    renderGemBar();

    // Re-render whichever tab is currently visible
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
      const tab = activeTab.dataset.tab;
      if (tab === 'history') renderHistory(history, KIDS, deleteHistoryEntry);
      if (tab === 'achievements') renderAchievementsView(KIDS, history);
    }
  }

  // Init Firebase — this will pull remote data if a room code is saved
  Sync.init(onRemoteUpdate);
}

// === Full re-render helper (after kids config or vacations change) ===

function rerenderAll() {
  loadKids();
  renderStopwatchCards();
  renderGemBar();
  stopwatches.forEach((_, i) => updateRepsDisplay(i));
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    const tab = activeTab.dataset.tab;
    if (tab === 'history') renderHistory(history, KIDS, deleteHistoryEntry);
    if (tab === 'achievements') renderAchievementsView(KIDS, history);
  }
}

// === Backfill Past Session ===

function setupBackfill() {
  const backdrop = document.getElementById('backfill-modal-backdrop');
  const openBtn = document.getElementById('btn-add-past');
  const closeBtn = document.getElementById('backfill-close');
  const kidSelect = document.getElementById('backfill-kid');
  const dateInput = document.getElementById('backfill-date');
  const timeInput = document.getElementById('backfill-time');
  const minutesInput = document.getElementById('backfill-minutes');
  const secondsInput = document.getElementById('backfill-seconds');
  const pullupsInput = document.getElementById('backfill-pullups');
  const pushupsInput = document.getElementById('backfill-pushups');
  const submitBtn = document.getElementById('btn-submit-backfill');

  function refresh(preset) {
    // Populate kid dropdown
    kidSelect.innerHTML = '';
    KIDS.forEach(kid => {
      const opt = document.createElement('option');
      opt.value = kid.name;
      opt.textContent = `${kid.avatar || '⭐'} ${kid.name}`;
      kidSelect.appendChild(opt);
    });
    if (preset && preset.kidName) kidSelect.value = preset.kidName;

    const dayKey = (preset && preset.dayKey) || (() => {
      const y = new Date(); y.setDate(y.getDate() - 1);
      return y.toISOString().slice(0, 10);
    })();
    dateInput.value = dayKey;
    timeInput.value = '16:00';
    minutesInput.value = 15;
    secondsInput.value = 0;
    pullupsInput.value = 0;
    pushupsInput.value = 0;

    // Focus minutes for instant typing
    setTimeout(() => { minutesInput.focus(); minutesInput.select(); }, 60);
  }

  openBtn.addEventListener('click', () => {
    if (KIDS.length === 0) {
      alert('Add a kid first in Settings.');
      return;
    }
    refresh();
    backdrop.classList.add('visible');
  });

  // Expose pre-filled opener for inline kid-card buttons
  window.openBackfillForKid = (index) => {
    const sw = stopwatches[index];
    if (!sw) return;
    refresh({ kidName: sw.name, dayKey: sw.repsDay || todayKey() });
    backdrop.classList.add('visible');
  };
  closeBtn.addEventListener('click', () => backdrop.classList.remove('visible'));
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('visible');
  });

  submitBtn.addEventListener('click', () => {
    const kidName = kidSelect.value;
    const date = dateInput.value;     // YYYY-MM-DD
    const time = timeInput.value;     // HH:MM
    const mins = parseInt(minutesInput.value, 10) || 0;
    const secs = parseInt(secondsInput.value, 10) || 0;
    const duration = mins * 60 + secs;
    const pullups = Math.max(0, parseInt(pullupsInput.value, 10) || 0);
    const pushups = Math.max(0, parseInt(pushupsInput.value, 10) || 0);

    if (!kidName || !date) { alert('Please pick a kid and a date.'); return; }
    if (duration <= 0 && pullups === 0 && pushups === 0) {
      alert('Enter either a duration or some reps to record.');
      return;
    }
    const ts = new Date(`${date}T${time || '12:00'}:00`);
    if (isNaN(ts)) { alert('Invalid date/time.'); return; }

    // Timer session entry (only if duration > 0)
    if (duration > 0) {
      const entry = {
        id: generateId(),
        childName: kidName,
        duration,
        timestamp: ts.toISOString(),
        backfilled: true,
      };
      history.push(entry);
      Storage.saveHistory(history);
      history = Storage.loadHistory();  // re-sort
    }

    // Reps for this day (adds on top of any existing count)
    if (pullups > 0 || pushups > 0) {
      Storage.addReps(kidName, date, { pullups, pushups });
    }

    checkAchievements(kidName, history);
    renderGemBar();
    stopwatches.forEach((_, i) => {
      updateStreakDisplay(i);
      updateRepsDisplay(i);
    });
    renderHistory(history, KIDS, deleteHistoryEntry);

    backdrop.classList.remove('visible');
  });
}

// === Settings (kids + vacations) ===

const AVATAR_PALETTE = ['🌸','🦋','🐻','🦊','🐰','🐼','🦁','🐶','🐱','🐸','🐯','🐵','🐷','🐔','🦄','⭐','🌈','🚀','⚽','🎨'];
const COLOR_PALETTE = [
  'rgb(250, 133, 166)', // pink
  'rgb(107, 176, 232)', // blue
  'rgb(120, 200, 130)', // green
  'rgb(180, 130, 220)', // purple
  'rgb(255, 160, 80)',  // orange
  'rgb(240, 200, 80)',  // yellow
  'rgb(150, 200, 220)', // aqua
  'rgb(230, 110, 110)', // red
];

let editingKidIndex = -1; // index into full (including archived) list; -1 = adding new

function setupSettings() {
  const backdrop = document.getElementById('settings-modal-backdrop');
  const openBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('settings-close');
  const kidsList = document.getElementById('kids-list');
  const addKidBtn = document.getElementById('btn-add-kid');

  const vacStart = document.getElementById('vacation-start');
  const vacEnd = document.getElementById('vacation-end');
  const vacNote = document.getElementById('vacation-note');
  const addVacBtn = document.getElementById('btn-add-vacation');
  const vacList = document.getElementById('vacation-list');

  function renderKidsList() {
    const all = Storage.loadKidsConfig();
    kidsList.innerHTML = '';
    all.forEach((kid, index) => {
      const row = document.createElement('div');
      row.className = 'kid-row' + (kid.archived ? ' archived' : '');
      row.style.borderLeft = `4px solid ${kid.color}`;
      row.innerHTML = `
        <span class="kid-row-avatar">${kid.avatar || '⭐'}</span>
        <span class="kid-row-name">${kid.name}${kid.archived ? ' <em>(archived)</em>' : ''}</span>
        <div class="kid-row-actions">
          ${kid.archived
            ? '<button class="btn-mini" data-act="restore">Restore</button>'
            : '<button class="btn-mini" data-act="edit">Edit</button>'
          }
        </div>
      `;
      row.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.act === 'edit') openKidEditor(index);
          if (btn.dataset.act === 'restore') {
            const cfg = Storage.loadKidsConfig();
            cfg[index].archived = false;
            Storage.saveKidsConfig(cfg);
            rerenderAll();
            renderKidsList();
          }
        });
      });
      kidsList.appendChild(row);
    });
  }

  function renderVacationList() {
    const vacations = Storage.loadVacations()
      .slice()
      .sort((a, b) => new Date(b.start) - new Date(a.start));
    vacList.innerHTML = '';
    if (vacations.length === 0) {
      vacList.innerHTML = '<p class="settings-hint" style="margin-top:12px">No vacations yet.</p>';
      return;
    }
    vacations.forEach(v => {
      const row = document.createElement('div');
      row.className = 'vacation-row';
      row.innerHTML = `
        <span class="vacation-dates">${v.start} → ${v.end}</span>
        <span class="vacation-note">${v.note || ''}</span>
        <button class="btn-mini btn-mini-danger" data-id="${v.id}">Remove</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        const remaining = Storage.loadVacations().filter(x => x.id !== v.id);
        Storage.saveVacations(remaining);
        renderVacationList();
        stopwatches.forEach((_, i) => updateStreakDisplay(i));
      });
      vacList.appendChild(row);
    });
  }

  function refresh() {
    renderKidsList();
    renderVacationList();
    renderWeeklyGoalsList();
    renderThemeButtons();
    refreshNotificationsStatus();
    // Default vacation date range = today … today
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!vacStart.value) vacStart.value = todayStr;
    if (!vacEnd.value) vacEnd.value = todayStr;
    vacNote.value = '';
  }

  // Theme buttons
  function renderThemeButtons() {
    const current = Storage.getThemePreference();
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === current);
    });
  }
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setThemePreference(btn.dataset.themeVal);
      renderThemeButtons();
    });
  });

  // Weekly goals
  function renderWeeklyGoalsList() {
    const el = document.getElementById('weekly-goals-list');
    if (!el) return;
    el.innerHTML = '';
    KIDS.forEach(kid => {
      const goal = Storage.getWeeklyGoal(kid.name);
      const row = document.createElement('div');
      row.className = 'kid-row';
      row.style.borderLeft = `4px solid ${kid.color}`;
      row.innerHTML = `
        <span class="kid-row-avatar">${kid.avatar || '⭐'}</span>
        <span class="kid-row-name">${kid.name}</span>
        <input type="number" class="form-input goal-input" min="0" max="2000" step="15" value="${goal || ''}" placeholder="min/wk" style="max-width:110px;margin-top:0">
      `;
      const input = row.querySelector('.goal-input');
      input.addEventListener('change', () => {
        const v = Math.max(0, parseInt(input.value, 10) || 0);
        Storage.setWeeklyGoal(kid.name, v);
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'history') renderHistory(history, KIDS, deleteHistoryEntry);
      });
      el.appendChild(row);
    });
  }

  // Notifications permission
  function refreshNotificationsStatus() {
    const el = document.getElementById('notifications-status');
    const btn = document.getElementById('btn-enable-notifications');
    if (!el || !btn) return;
    if (!('Notification' in window)) {
      btn.disabled = true;
      el.textContent = 'Not supported here';
      return;
    }
    if (Notification.permission === 'granted') {
      btn.disabled = true;
      el.textContent = 'Enabled';
    } else if (Notification.permission === 'denied') {
      btn.disabled = true;
      el.textContent = 'Blocked in browser';
    } else {
      btn.disabled = false;
      el.textContent = '';
    }
  }
  document.getElementById('btn-enable-notifications').addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      scheduleDailySummary();
    }
    refreshNotificationsStatus();
  });

  // Export / Import
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = JSON.stringify(Storage.exportAll(), null, 2);
    const b = new Blob([blob], { type: 'application/json' });
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kids-stopwatch-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const importInput = document.getElementById('import-file');
  document.getElementById('btn-import-json').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const kidCount = Array.isArray(data.kidsConfig) ? data.kidsConfig.length : '?';
        const histCount = Array.isArray(data.stopwatchHistory) ? data.stopwatchHistory.length : '?';
        if (!confirm(`Import will overwrite local data.\nKids: ${kidCount}, History entries: ${histCount}\nContinue?`)) {
          importInput.value = '';
          return;
        }
        Storage.importAll(data);
        history = Storage.loadHistory();
        rerenderAll();
        refresh();
        alert('Import complete.');
      } catch (err) {
        alert('Invalid backup file: ' + err.message);
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  openBtn.addEventListener('click', () => {
    refresh();
    backdrop.classList.add('visible');
  });
  closeBtn.addEventListener('click', () => backdrop.classList.remove('visible'));
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('visible');
  });

  addKidBtn.addEventListener('click', () => openKidEditor(-1));

  addVacBtn.addEventListener('click', () => {
    const start = vacStart.value;
    const end = vacEnd.value;
    const note = vacNote.value.trim();
    if (!start || !end) { alert('Pick a start and end date.'); return; }
    if (new Date(end) < new Date(start)) { alert('End date must be after start.'); return; }
    const vacations = Storage.loadVacations();
    vacations.push({ id: generateId(), start, end, note });
    Storage.saveVacations(vacations);
    renderVacationList();
    stopwatches.forEach((_, i) => updateStreakDisplay(i));
    vacNote.value = '';
  });

  // Kid editor modal
  const editorBackdrop = document.getElementById('kid-editor-backdrop');
  const editorTitle = document.getElementById('kid-editor-title');
  const editorClose = document.getElementById('kid-editor-close');
  const nameInput = document.getElementById('kid-editor-name');
  const colorsDiv = document.getElementById('kid-editor-colors');
  const avatarsDiv = document.getElementById('kid-editor-avatars');
  const archiveBtn = document.getElementById('btn-archive-kid');
  const saveKidBtn = document.getElementById('btn-save-kid');

  let currentColor = COLOR_PALETTE[0];
  let currentAvatar = AVATAR_PALETTE[0];

  function renderPickers() {
    colorsDiv.innerHTML = '';
    COLOR_PALETTE.forEach(c => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch' + (c === currentColor ? ' selected' : '');
      swatch.style.background = c;
      swatch.type = 'button';
      swatch.setAttribute('aria-label', c);
      swatch.addEventListener('click', () => {
        currentColor = c;
        renderPickers();
      });
      colorsDiv.appendChild(swatch);
    });
    avatarsDiv.innerHTML = '';
    AVATAR_PALETTE.forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'avatar-swatch' + (a === currentAvatar ? ' selected' : '');
      btn.textContent = a;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        currentAvatar = a;
        renderPickers();
      });
      avatarsDiv.appendChild(btn);
    });
  }

  function openKidEditor(index) {
    editingKidIndex = index;
    const all = Storage.loadKidsConfig();
    if (index >= 0) {
      const k = all[index];
      editorTitle.textContent = 'Edit kid';
      nameInput.value = k.name;
      currentColor = k.color || COLOR_PALETTE[0];
      currentAvatar = k.avatar || AVATAR_PALETTE[0];
      archiveBtn.style.display = 'inline-block';
      archiveBtn.textContent = k.archived ? 'Restore' : 'Archive';
    } else {
      editorTitle.textContent = 'Add kid';
      nameInput.value = '';
      // Pick a color not already used if possible
      const usedColors = new Set(all.map(k => k.color));
      currentColor = COLOR_PALETTE.find(c => !usedColors.has(c)) || COLOR_PALETTE[0];
      currentAvatar = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
      archiveBtn.style.display = 'none';
    }
    renderPickers();
    editorBackdrop.classList.add('visible');
    setTimeout(() => nameInput.focus(), 50);
  }

  editorClose.addEventListener('click', () => editorBackdrop.classList.remove('visible'));
  editorBackdrop.addEventListener('click', e => {
    if (e.target === editorBackdrop) editorBackdrop.classList.remove('visible');
  });

  archiveBtn.addEventListener('click', () => {
    const all = Storage.loadKidsConfig();
    if (editingKidIndex < 0) return;
    all[editingKidIndex].archived = !all[editingKidIndex].archived;
    Storage.saveKidsConfig(all);
    editorBackdrop.classList.remove('visible');
    rerenderAll();
    renderKidsList();
  });

  saveKidBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { alert('Name is required.'); return; }
    const all = Storage.loadKidsConfig();

    // Detect name collision (block only if the colliding kid isn't the one being edited)
    const collision = all.findIndex((k, i) => k.name.toLowerCase() === name.toLowerCase() && i !== editingKidIndex);
    if (collision >= 0) { alert('A kid with that name already exists.'); return; }

    if (editingKidIndex < 0) {
      all.push({ name, color: currentColor, avatar: currentAvatar, archived: false });
    } else {
      // Allow rename — this detaches old per-kid data (history still references the old name).
      // To keep data attached, we'll migrate: rename history entries + per-kid maps.
      const oldName = all[editingKidIndex].name;
      if (oldName !== name) {
        migrateKidName(oldName, name);
      }
      all[editingKidIndex] = { ...all[editingKidIndex], name, color: currentColor, avatar: currentAvatar };
    }
    Storage.saveKidsConfig(all);
    editorBackdrop.classList.remove('visible');
    rerenderAll();
    renderKidsList();
  });
}

// When renaming a kid, rewrite their history entries + move per-kid keys
// === Share achievement card ===

function setupShareCard() {
  // Hook into the achievement toast: add a "Share" button when one renders.
  // The toast markup lives in showAchievementToast.
}

function generateShareCard(kidName, color, avatar, achievement) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  // Background gradient in kid's color
  const g = ctx.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, color.replace(')', ', 0.35)').replace('rgb', 'rgba'));
  g.addColorStop(1, color.replace(')', ', 0.08)').replace('rgb', 'rgba'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1080);

  // Avatar
  ctx.font = '260px "Apple Color Emoji", "Segoe UI Emoji", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(avatar || '⭐', 540, 320);

  // Kid name
  ctx.fillStyle = color;
  ctx.font = 'bold 54px -apple-system, system-ui';
  ctx.fillText(kidName, 540, 500);

  // Achievement icon
  ctx.font = '180px "Apple Color Emoji", "Segoe UI Emoji", system-ui';
  ctx.fillText(achievement.icon, 540, 660);

  // Achievement name
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 64px -apple-system, system-ui';
  ctx.fillText(achievement.name, 540, 790);

  // Description
  ctx.fillStyle = '#555555';
  ctx.font = '36px -apple-system, system-ui';
  ctx.fillText(achievement.desc, 540, 860);

  // Gems
  ctx.fillStyle = 'rgb(139, 92, 246)';
  ctx.font = 'bold 44px -apple-system, system-ui';
  ctx.fillText(`+${achievement.gems} 💎 earned`, 540, 940);

  return canvas;
}

async function shareAchievement(kidName, achievement) {
  const kid = KIDS.find(k => k.name === kidName);
  if (!kid) return;
  const canvas = generateShareCard(kidName, kid.color, kid.avatar, achievement);
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], `${kidName}-${achievement.id}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${kidName} unlocked ${achievement.name}!` });
        return;
      }
    } catch (e) { /* fall through to download */ }
    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// === Notifications (daily summary) ===

function setupNotifications() {
  // Schedule a daily summary if today's hasn't shown yet and the user
  // has granted permission. This only runs while the app is open; a
  // true OS-level daily ping would require a server + push subscription.
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  scheduleDailySummary();
}

function scheduleDailySummary() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(20, 0, 0, 0); // 8pm local
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = Math.min(target - now, 3 * 60 * 60 * 1000); // cap at 3 hrs
  setTimeout(() => {
    sendDailySummary();
    scheduleDailySummary(); // chain for next day
  }, delay);
}

function sendDailySummary() {
  const lastShown = localStorage.getItem('lastDailySummary');
  const today = todayKey();
  if (lastShown === today) return;
  const parts = [];
  KIDS.forEach(kid => {
    const entries = history.filter(e => {
      const d = new Date(e.timestamp);
      return e.childName === kid.name && todayKey() === `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const total = entries.reduce((s, e) => s + e.duration, 0);
    const reps = Storage.getReps(kid.name, today);
    if (total > 0 || reps.pullups > 0 || reps.pushups > 0) {
      parts.push(`${kid.name}: ${formatWeeklyTotal(total)}${reps.pullups ? `, ${reps.pullups} pulls` : ''}${reps.pushups ? `, ${reps.pushups} pushes` : ''}`);
    }
  });
  if (parts.length === 0) return;
  try {
    new Notification('Today\'s workout summary', {
      body: parts.join('\n'),
      icon: '/icons/icon-192.png',
      tag: 'daily-summary',
    });
    localStorage.setItem('lastDailySummary', today);
  } catch (e) { /* ignore */ }
}

// === Stats / Personal Best ===

function setupStats() {
  const backdrop = document.getElementById('stats-modal-backdrop');
  const openBtn = document.getElementById('stats-btn');
  const closeBtn = document.getElementById('stats-modal-close');
  const content = document.getElementById('stats-content');

  function render() {
    content.innerHTML = '';
    KIDS.forEach(kid => {
      const entries = history.filter(e => e.childName === kid.name);
      const sessions = entries.length;
      const totalTime = entries.reduce((s, e) => s + e.duration, 0);
      const longest = entries.reduce((m, e) => Math.max(m, e.duration), 0);
      const stats = computeKidStats(kid.name, history);

      // This month + last month totals
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = entries.filter(e => new Date(e.timestamp) >= thisMonthStart).reduce((s, e) => s + e.duration, 0);
      const lastMonth = entries.filter(e => {
        const ts = new Date(e.timestamp);
        return ts >= lastMonthStart && ts < thisMonthStart;
      }).reduce((s, e) => s + e.duration, 0);
      const momDelta = thisMonth - lastMonth;

      const section = document.createElement('div');
      section.className = 'stats-kid-section';
      section.style.borderLeft = `4px solid ${kid.color}`;
      section.innerHTML = `
        <div class="stats-kid-header">
          <span class="stats-avatar">${kid.avatar || '⭐'}</span>
          <span class="stats-name" style="color:${kid.color}">${kid.name}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-tile"><div class="stat-label">Current streak</div><div class="stat-value">${stats.streak}d</div></div>
          <div class="stat-tile"><div class="stat-label">Sessions</div><div class="stat-value">${sessions}</div></div>
          <div class="stat-tile"><div class="stat-label">Total time</div><div class="stat-value">${formatWeeklyTotal(totalTime)}</div></div>
          <div class="stat-tile"><div class="stat-label">Longest session</div><div class="stat-value">${formatWeeklyTotal(longest)}</div></div>
          <div class="stat-tile"><div class="stat-label">Pull-ups (total)</div><div class="stat-value">${stats.totalPullups}</div></div>
          <div class="stat-tile"><div class="stat-label">Push-ups (total)</div><div class="stat-value">${stats.totalPushups}</div></div>
          <div class="stat-tile"><div class="stat-label">Best day pulls</div><div class="stat-value">${stats.bestDayPullups}</div></div>
          <div class="stat-tile"><div class="stat-label">Best day pushes</div><div class="stat-value">${stats.bestDayPushups}</div></div>
        </div>
        <div class="stats-mom">
          <span>This month: <strong>${formatWeeklyTotal(thisMonth)}</strong></span>
          <span class="stats-mom-delta ${momDelta >= 0 ? 'up' : 'down'}">${momDelta >= 0 ? '▲' : '▼'} ${formatWeeklyTotal(Math.abs(momDelta))} vs last month</span>
        </div>
      `;
      content.appendChild(section);
    });
  }

  openBtn.addEventListener('click', () => { render(); backdrop.classList.add('visible'); });
  closeBtn.addEventListener('click', () => backdrop.classList.remove('visible'));
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('visible'); });
}

// === Weekly goals ===

// Compute this week's total seconds of exercise for a kid
function weekTotalSeconds(kidName) {
  const interval = (typeof getWeekInterval === 'function') ? getWeekInterval() : null;
  if (!interval) return 0;
  let total = 0;
  for (const e of history) {
    if (e.childName !== kidName) continue;
    const ts = new Date(e.timestamp);
    if (ts >= interval.start && ts < interval.end) total += e.duration;
  }
  return total;
}

// Track "last week a goal was hit for" per kid in localStorage so we only
// award the +5 gem bonus once per week.
function checkWeeklyGoalHit(kidName) {
  const goalMin = Storage.getWeeklyGoal(kidName);
  if (!goalMin || goalMin <= 0) return false;
  const total = weekTotalSeconds(kidName);
  if (total < goalMin * 60) return false;

  const interval = getWeekInterval();
  const weekKey = interval.start.toISOString().slice(0, 10);
  const storedRaw = localStorage.getItem('weeklyGoalHits') || '{}';
  let stored = {};
  try { stored = JSON.parse(storedRaw); } catch {}
  if (stored[kidName] === weekKey) return false; // already awarded this week

  stored[kidName] = weekKey;
  localStorage.setItem('weeklyGoalHits', JSON.stringify(stored));
  Storage.addGems(kidName, 5);
  return true;
}

function migrateKidName(oldName, newName) {
  // 1. History entries
  const h = Storage.loadHistory();
  h.forEach(e => { if (e.childName === oldName) e.childName = newName; });
  Storage.saveHistory(h);
  history = Storage.loadHistory();

  // 2. Per-kid maps: unlockedAchievements, gemBalance, purchasedFreezes
  const PER_KID_KEYS = ['unlockedAchievements', 'gemBalance', 'purchasedFreezes'];
  PER_KID_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const map = JSON.parse(raw);
      if (map[oldName] !== undefined) {
        map[newName] = map[oldName];
        delete map[oldName];
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch {}
  });
  if (typeof Sync !== 'undefined') Sync.push();
}

// === Undo Toast ===

let _undoTimer = null;
let _undoAction = null;

function setupUndoToast() {
  // Ensure DOM element exists (created lazily below)
}

function showUndoToast(message, undoFn, ms = 5000) {
  // Cancel any pending undo first — if the user does a new undoable action,
  // the previous one is committed permanently.
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; _undoAction = null; }

  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.className = 'undo-toast';
    toast.innerHTML = `
      <span class="undo-toast-msg"></span>
      <button class="undo-toast-btn">Undo</button>
    `;
    document.body.appendChild(toast);
    toast.querySelector('.undo-toast-btn').addEventListener('click', () => {
      if (_undoAction) {
        const a = _undoAction;
        _undoAction = null;
        if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
        toast.classList.remove('visible');
        a();
      }
    });
  }
  toast.querySelector('.undo-toast-msg').textContent = message;
  _undoAction = undoFn;
  toast.classList.add('visible');
  _undoTimer = setTimeout(() => {
    toast.classList.remove('visible');
    _undoAction = null;
    _undoTimer = null;
  }, ms);
}

let editingHistoryId = null;

function openEditHistory(entryId) {
  const entry = history.find(e => e.id === entryId);
  if (!entry) return;
  editingHistoryId = entryId;

  const backdrop = document.getElementById('edit-history-backdrop');
  const kidEl = document.getElementById('edit-history-kid');
  const dateInput = document.getElementById('edit-history-date');
  const timeInput = document.getElementById('edit-history-time');
  const minsInput = document.getElementById('edit-history-minutes');
  const secsInput = document.getElementById('edit-history-seconds');

  kidEl.textContent = entry.childName;
  const ts = new Date(entry.timestamp);
  dateInput.value = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}`;
  timeInput.value = `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
  const totalSeconds = Math.round(entry.duration);
  minsInput.value = Math.floor(totalSeconds / 60);
  secsInput.value = totalSeconds % 60;
  const noteInput = document.getElementById('edit-history-note');
  if (noteInput) noteInput.value = entry.note || '';

  backdrop.classList.add('visible');
}

function setupEditHistory() {
  const backdrop = document.getElementById('edit-history-backdrop');
  const closeBtn = document.getElementById('edit-history-close');
  const saveBtn = document.getElementById('btn-save-history');
  const deleteBtn = document.getElementById('btn-delete-history');

  const close = () => { backdrop.classList.remove('visible'); editingHistoryId = null; };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  saveBtn.addEventListener('click', () => {
    if (!editingHistoryId) return;
    const entry = history.find(e => e.id === editingHistoryId);
    if (!entry) { close(); return; }

    const date = document.getElementById('edit-history-date').value;
    const time = document.getElementById('edit-history-time').value;
    const mins = parseInt(document.getElementById('edit-history-minutes').value, 10) || 0;
    const secs = parseInt(document.getElementById('edit-history-seconds').value, 10) || 0;

    const duration = mins * 60 + secs;
    if (duration <= 0) { alert('Duration must be greater than zero.'); return; }
    const ts = new Date(`${date}T${time || '12:00'}:00`);
    if (isNaN(ts)) { alert('Invalid date/time.'); return; }

    entry.duration = duration;
    entry.timestamp = ts.toISOString();
    const noteVal = (document.getElementById('edit-history-note') || {}).value || '';
    entry.note = noteVal.trim().slice(0, 120) || undefined;
    Storage.saveHistory(history);
    history = Storage.loadHistory();

    // Recompute achievements and streaks since times changed
    checkAchievements(entry.childName, history);
    renderGemBar();
    stopwatches.forEach((_, i) => updateStreakDisplay(i));
    renderHistory(history, KIDS, deleteHistoryEntry);

    close();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editingHistoryId) return;
    const idx = history.findIndex(e => e.id === editingHistoryId);
    if (idx >= 0) {
      deleteHistoryEntry(idx);
    }
    close();
  });
}

// === Init ===

function init() {
  applyThemePreference();
  setupTabs();
  renderStopwatchCards();
  renderGemBar();
  setupDarkModeListener();
  setupScrollFade();
  setupSync();
  setupBackfill();
  setupSettings();
  setupSessionComplete();
  setupEditHistory();
  setupUndoToast();
  setupStats();
  setupShareCard();
  setupNotifications();

  // Register service worker for PWA/offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
