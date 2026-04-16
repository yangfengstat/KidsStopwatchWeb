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
      clock: null,
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
    if (!kidName || !date || duration <= 0) {
      alert('Please fill in all fields (duration must be > 0).');
      return;
    }
    const ts = new Date(`${date}T${time || '12:00'}:00`);
    if (isNaN(ts)) { alert('Invalid date/time.'); return; }

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

    checkAchievements(kidName, history);
    renderGemBar();
    stopwatches.forEach((_, i) => updateStreakDisplay(i));
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

  // Register service worker for PWA/offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
