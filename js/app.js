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
      target: 0,              // target duration in seconds, 0 = none
      targetPlayed: false,    // whether target-reached chime has played this session
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
  return window.matchMedia('(prefers-color-scheme: dark)').matches ||
    document.documentElement.getAttribute('data-theme') === 'dark';
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
          <span class="card-avatar">${sw.avatar || '⭐'}</span>
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
      <div class="target-progress" data-role="target-progress">
        <div class="target-progress-fill" data-role="target-fill"></div>
      </div>
      <div class="target-row" data-role="target-row">
        <span class="target-label">🎯 Target</span>
        <div class="target-options">
          <button class="target-btn selected" data-target="0">Off</button>
          <button class="target-btn" data-target="300">5m</button>
          <button class="target-btn" data-target="600">10m</button>
          <button class="target-btn" data-target="900">15m</button>
          <button class="target-btn" data-target="1200">20m</button>
          <button class="target-btn" data-target="1800">30m</button>
        </div>
      </div>
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
      targetProgress: card.querySelector('[data-role="target-progress"]'),
      targetFill: card.querySelector('[data-role="target-fill"]'),
      targetRow: card.querySelector('[data-role="target-row"]'),
      targetBtns: card.querySelectorAll('.target-btn'),
      repsDayLabel: card.querySelector('[data-role="reps-day-label"]'),
      repsDayBtns: card.querySelectorAll('.reps-day-nav'),
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

    // Target picker
    sw.elements.targetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.dataset.target, 10) || 0;
        setStopwatchTarget(index, target);
      });
    });

    // Day switcher for reps
    sw.elements.repsDayBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        shiftRepsDay(index, dir);
      });
    });

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

    // Update streak + reps + target display
    updateStreakDisplay(index);
    updateRepsDisplay(index);
    updateTargetDisplay(index);
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

  // Disable the "next" button when already at today
  if (sw.elements.repsDayBtns) {
    sw.elements.repsDayBtns.forEach(btn => {
      if (parseInt(btn.dataset.dir, 10) === 1) {
        btn.disabled = day === todayKey();
      }
    });
  }
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
  if (document.getElementById('history-view').classList.contains('active')) {
    renderHistory(history, KIDS, deleteHistoryEntry);
  }

  // Achievements
  const newAchievements = checkAchievements(sw.name, history);
  renderGemBar();

  // Streak milestone (independent of achievements)
  const newInfo = streakInfo(sw.name, history);
  const prev = prevStreaks[sw.name] || 0;
  const milestoneHit = newInfo.streak > prev && Confetti.isMilestone(newInfo.streak);

  // Celebrate
  if (newAchievements.length > 0 || milestoneHit) {
    Confetti.launch();
  }
  showSessionComplete(sw, savedDuration, newAchievements);

  // Reset timer
  sw.time = 0;
  sw.accumulatedTime = 0;
  sw.targetPlayed = false;

  updateStopwatchDisplay(index);
  updateStreakDisplay(index);
  updateTargetDisplay(index);
}

// === Session Complete celebration ===

function showSessionComplete(sw, durationSeconds, newAchievements) {
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
  if (newAchievements && newAchievements.length > 0) {
    const totalGems = newAchievements.reduce((sum, a) => sum + a.gems, 0);
    const achList = newAchievements
      .map(a => `<div class="sc-ach">${a.icon} ${a.name}</div>`)
      .join('');
    rewardsEl.innerHTML = `
      ${achList}
      <div class="sc-gems">+${totalGems} 💎</div>
    `;
  }

  backdrop.classList.add('visible');
}

function setupSessionComplete() {
  const backdrop = document.getElementById('session-complete-backdrop');
  const dismissBtn = document.getElementById('sc-dismiss');
  const close = () => backdrop.classList.remove('visible');
  dismissBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  // Auto-dismiss after 4s
  const observer = new MutationObserver(() => {
    if (backdrop.classList.contains('visible')) {
      setTimeout(close, 4000);
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
  sw.targetPlayed = false;
  updateStopwatchDisplay(index);
  updateTargetDisplay(index);
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
      // Countdown progress + chime
      if (sw.target > 0) updateTargetDisplay(i);
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
  toast.innerHTML = `${kidName}: ${names}<br><span style="font-size:0.85rem; opacity:0.8">+${gems} 💎 earned!</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// === History ===

function deleteHistoryEntry(index) {
  history.splice(index, 1);
  Storage.saveHistory(history);
  renderHistory(history, KIDS, deleteHistoryEntry);
  // Update streaks
  stopwatches.forEach((_, i) => updateStreakDisplay(i));
}

// === Tab Switching ===

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

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

  function refresh() {
    // Populate kid dropdown
    kidSelect.innerHTML = '';
    KIDS.forEach(kid => {
      const opt = document.createElement('option');
      opt.value = kid.name;
      opt.textContent = `${kid.avatar || '⭐'} ${kid.name}`;
      kidSelect.appendChild(opt);
    });
    // Default date = yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateInput.value = yesterday.toISOString().slice(0, 10);
    timeInput.value = '16:00';
    minutesInput.value = 15;
    secondsInput.value = 0;
    pullupsInput.value = 0;
    pushupsInput.value = 0;
  }

  openBtn.addEventListener('click', () => {
    if (KIDS.length === 0) {
      alert('Add a kid first in Settings.');
      return;
    }
    refresh();
    backdrop.classList.add('visible');
  });
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
    // Default vacation date range = today … today
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!vacStart.value) vacStart.value = todayStr;
    if (!vacEnd.value) vacEnd.value = todayStr;
    vacNote.value = '';
  }

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
// === Target / countdown ===

function setStopwatchTarget(index, targetSeconds) {
  const sw = stopwatches[index];
  sw.target = targetSeconds;
  sw.targetPlayed = false;
  updateTargetDisplay(index);
}

function updateTargetDisplay(index) {
  const sw = stopwatches[index];
  if (!sw.elements.targetRow) return;

  // Update selected state on target buttons
  sw.elements.targetBtns.forEach(btn => {
    const t = parseInt(btn.dataset.target, 10) || 0;
    btn.classList.toggle('selected', t === (sw.target || 0));
    if (t === (sw.target || 0)) {
      btn.style.background = colorWithAlpha(sw.color, 0.2);
      btn.style.borderColor = colorWithAlpha(sw.color, 0.5);
      btn.style.color = sw.color;
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });

  // Progress bar
  const bar = sw.elements.targetProgress;
  const fill = sw.elements.targetFill;
  if (!bar || !fill) return;

  if (!sw.target || sw.target <= 0) {
    bar.classList.remove('visible');
    return;
  }
  bar.classList.add('visible');
  const pct = Math.min(100, (sw.time / sw.target) * 100);
  fill.style.width = pct + '%';
  fill.style.background = sw.time >= sw.target
    ? 'linear-gradient(90deg, #34c759, #2aa74b)'
    : `linear-gradient(90deg, ${sw.color}, ${colorWithAlpha(sw.color, 0.75)})`;

  // Target reached chime (once per session)
  if (sw.time >= sw.target && !sw.targetPlayed && sw.isRunning) {
    sw.targetPlayed = true;
    playTargetChime();
    // Haptic on devices that support it
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  }
}

// Short pleasant chime via Web Audio (no external asset)
let _audioCtx = null;
function playTargetChime() {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    // Two-tone major-third rise: G5 → B5
    [
      { freq: 784, start: 0,    dur: 0.18 },
      { freq: 988, start: 0.12, dur: 0.35 },
    ].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch (e) { /* audio unavailable, ignore */ }
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

// === Edit History Entry ===

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

  // Register service worker for PWA/offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
