// App entry point

const KIDS = [
  { name: 'Isabella', color: 'rgb(250, 133, 166)' },
  { name: 'Viviana', color: 'rgb(107, 176, 232)' }
];

let history = Storage.loadHistory();

// Stopwatch state
const stopwatches = KIDS.map(kid => ({
  name: kid.name,
  color: kid.color,
  time: 0,
  isRunning: false,
  startedAt: null, // Date.now() when started (for drift-free timing)
  accumulatedTime: 0, // time accumulated before current run
  clock: null,
  elements: {}
}));

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
      <div class="gem-bar-dot" style="background:${kid.color}"></div>
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
          <div class="color-dot" style="background: ${sw.color}; opacity: 0.8"></div>
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
      <div class="clock-container"></div>
      <div class="time-display">00:00.00</div>
      <div class="button-row">
        <button class="btn btn-primary">&#9654; Start</button>
        <button class="btn btn-reset">Reset</button>
        <button class="btn btn-add">+ 15s</button>
      </div>
    `;

    // Create clock
    const clock = createClock(sw.color);
    const clockContainer = card.querySelector('.clock-container');
    clockContainer.appendChild(clock.svg);

    // Apply dial opacity classes via inline styles
    const dialFill = clock.svg.querySelector('.dial-fill');
    const dialStroke = clock.svg.querySelector('.dial-stroke');
    if (dialFill) dialFill.style.opacity = dark ? 0.18 : 0.08;
    if (dialStroke) dialStroke.style.opacity = dark ? 0.5 : 0.3;

    // Label opacity
    clock.svg.querySelectorAll('.clock-label').forEach(label => {
      label.style.opacity = dark ? 0.85 : 0.7;
    });

    sw.clock = clock;

    // Store element refs
    sw.elements = {
      card,
      timeDisplay: card.querySelector('.time-display'),
      statusBadge: card.querySelector('.status-badge'),
      streakCount: card.querySelector('.streak-count'),
      freezeCount: card.querySelector('.freeze-count'),
      btnPrimary: card.querySelector('.btn-primary'),
      btnReset: card.querySelector('.btn-reset'),
      btnAdd: card.querySelector('.btn-add')
    };

    // Button styles
    sw.elements.btnPrimary.style.background = `linear-gradient(90deg, ${sw.color}, ${sw.color.replace(')', ', 0.75)').replace('rgb', 'rgba')})`;
    sw.elements.btnPrimary.style.boxShadow = `0 6px 8px ${sw.color.replace(')', ', 0.35)').replace('rgb', 'rgba')}`;

    sw.elements.btnReset.style.border = `1.2px solid ${sw.color.replace(')', ', 0.5)').replace('rgb', 'rgba')}`;
    sw.elements.btnReset.style.color = sw.color;

    sw.elements.btnAdd.style.background = sw.color.replace(')', ', 0.12)').replace('rgb', 'rgba');
    sw.elements.btnAdd.style.border = `1px solid ${sw.color.replace(')', ', 0.35)').replace('rgb', 'rgba')}`;
    sw.elements.btnAdd.style.color = sw.color;

    // Event listeners
    sw.elements.btnPrimary.addEventListener('click', () => toggleStopwatch(index));
    sw.elements.btnReset.addEventListener('click', () => resetStopwatch(index));
    sw.elements.btnAdd.addEventListener('click', () => addTime(index, 15));

    container.appendChild(card);

    // Update streak display
    updateStreakDisplay(index);
  });
}

function colorWithAlpha(color, alpha) {
  return color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
}

// === Stopwatch Logic ===

function toggleStopwatch(index) {
  const sw = stopwatches[index];

  if (sw.isRunning) {
    // Pause — record history entry
    sw.accumulatedTime = sw.time;
    sw.startedAt = null;
    sw.isRunning = false;

    if (sw.time > 0) {
      const entry = {
        id: generateId(),
        childName: sw.name,
        duration: sw.time,
        timestamp: new Date().toISOString()
      };
      history.unshift(entry);
      Storage.saveHistory(history);
      if (document.getElementById('history-view').classList.contains('active')) {
        renderHistory(history, KIDS, deleteHistoryEntry);
      }

      // Check for new achievements and show toast + confetti
      const newAchievements = checkAchievements(sw.name, history);
      renderGemBar();
      if (newAchievements.length > 0) {
        Confetti.launch();
        showAchievementToast(sw.name, newAchievements);
      } else {
        // Still check for streak milestone confetti
        const newInfo = streakInfo(sw.name, history);
        const prev = prevStreaks[sw.name] || 0;
        if (newInfo.streak > prev && Confetti.isMilestone(newInfo.streak)) {
          Confetti.launch();
        }
      }
    }
  } else {
    // Start
    sw.startedAt = Date.now() - (sw.accumulatedTime * 1000);
    sw.isRunning = true;
    ensureTimer();
  }

  updateStopwatchDisplay(index);
  updateStreakDisplay(index);
}

function resetStopwatch(index) {
  const sw = stopwatches[index];
  sw.time = 0;
  sw.accumulatedTime = 0;
  sw.startedAt = null;
  sw.isRunning = false;
  updateStopwatchDisplay(index);
}

function addTime(index, seconds) {
  const sw = stopwatches[index];
  sw.accumulatedTime += seconds;
  if (sw.isRunning) {
    sw.startedAt -= seconds * 1000;
  }
  sw.time = sw.accumulatedTime + (sw.isRunning ? (Date.now() - sw.startedAt) / 1000 - sw.accumulatedTime : 0);
  // Simpler: just recalculate
  if (sw.isRunning) {
    sw.time = (Date.now() - sw.startedAt) / 1000;
  } else {
    sw.time = sw.accumulatedTime;
  }
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
      updateClock(sw.clock, sw.time);
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
  updateClock(sw.clock, sw.time);

  // Status badge
  sw.elements.statusBadge.textContent = sw.isRunning ? 'Running' : 'Paused';

  // Primary button
  sw.elements.btnPrimary.innerHTML = sw.isRunning
    ? '&#10074;&#10074; Pause'
    : '&#9654; Start';

  // #7: Pulsing glow on running card
  if (sw.isRunning) {
    sw.elements.card.classList.add('running');
    sw.elements.card.style.setProperty('--glow-color', colorWithAlpha(sw.color, 0.3));
  } else {
    sw.elements.card.classList.remove('running');
  }

  // #5: Update page title with running timer
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
    // Reload history from localStorage (which was just updated by Sync)
    history = Storage.loadHistory();
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

// === Init ===

function init() {
  setupTabs();
  renderStopwatchCards();
  renderGemBar();
  setupDarkModeListener();
  setupScrollFade();
  setupSync();

  // Register service worker for PWA/offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
