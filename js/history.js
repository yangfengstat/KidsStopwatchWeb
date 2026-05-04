// History rendering — mirrors HistoryView.swift

function getWeekInterval() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Monday-based
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday, end: nextMonday };
}

function _dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderWeeklyGrid(history, kids) {
  const grid = document.getElementById('weekly-grid');
  grid.innerHTML = '';

  const interval = getWeekInterval();
  const totals = {};
  const sessionCounts = {};

  for (const entry of history) {
    const ts = new Date(entry.timestamp);
    if (ts >= interval.start && ts < interval.end) {
      totals[entry.childName] = (totals[entry.childName] || 0) + entry.duration;
      sessionCounts[entry.childName] = (sessionCounts[entry.childName] || 0) + 1;
    }
  }

  // Weekly rep totals from exerciseCounts
  const allReps = (typeof Storage !== 'undefined') ? Storage.loadAllExerciseCounts() : {};
  const weekDayKeys = [];
  {
    let d = new Date(interval.start);
    while (d < interval.end) {
      weekDayKeys.push(_dayKey(d));
      d = new Date(d); d.setDate(d.getDate() + 1);
    }
  }

  for (const kid of kids) {
    const total = totals[kid.name] || 0;
    const sessions = sessionCounts[kid.name] || 0;
    const sessionLabel = sessions === 1 ? '1 session' : `${sessions} sessions`;

    // Sum this week's reps for the kid
    const kidReps = allReps[kid.name] || {};
    let wkPullups = 0, wkPushups = 0;
    for (const k of weekDayKeys) {
      const r = kidReps[k] || {};
      wkPullups += r.pullups || 0;
      wkPushups += r.pushups || 0;
    }
    const hasReps = (wkPullups + wkPushups) > 0;

    // Weekly goal progress ring
    const goalMin = (typeof Storage !== 'undefined') ? Storage.getWeeklyGoal(kid.name) : 0;
    const goalSec = goalMin * 60;
    const pct = goalSec > 0 ? Math.min(100, (total / goalSec) * 100) : 0;
    const ringCirc = 94.2; // 2π × 15
    const ringOffset = (ringCirc * (1 - pct / 100)).toFixed(2);
    const ringSVG = goalSec > 0 ? `
      <svg class="weekly-goal-ring" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="15" fill="none" stroke="${kid.color.replace(')', ', 0.15)').replace('rgb','rgba')}" stroke-width="2"/>
        <circle cx="17" cy="17" r="15" fill="none" stroke="${pct >= 100 ? '#34c759' : kid.color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringOffset}" transform="rotate(-90 17 17)"/>
      </svg>` : '';

    const card = document.createElement('div');
    card.className = 'weekly-card';
    card.style.border = `1px solid ${kid.color.replace(')', ', 0.2)').replace('rgb', 'rgba')}`;

    card.innerHTML = `
      <div class="weekly-card-name">
        <span class="weekly-card-avatar">${kid.avatar || '⭐'}</span>
        <span>${kid.name}</span>
        ${ringSVG}
      </div>
      <div class="weekly-card-time">${formatWeeklyTotal(total)}</div>
      <div class="weekly-card-footer">
        <span class="weekly-card-label">${goalMin ? `Goal: ${goalMin} min · ${Math.round(pct)}%` : 'This week'}</span>
        <span class="weekly-card-sessions" style="color:${kid.color}">${sessionLabel}</span>
      </div>
      ${hasReps ? `
        <div class="weekly-card-reps">
          <span>💪 ${wkPullups} pull</span>
          <span>·</span>
          <span>${wkPushups} push</span>
        </div>
      ` : ''}
    `;
    grid.appendChild(card);
  }
}

function renderHistoryList(history, kids, onDelete) {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  // Build kid color lookup
  const kidColors = {};
  for (const kid of kids) {
    kidColors[kid.name] = kid.color;
  }

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128337;</div>
        <div>
          <h3>No history yet</h3>
          <p>Start a timer to see recent sessions here.</p>
        </div>
      </div>
    `;
    return;
  }

  // Helper: get a YYYY-MM-DD key for a date
  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Helper: human-readable day header label
  function dayLabel(d) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(d) === dayKey(today)) return 'Today';
    if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  let lastDayKey = null;

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const ts = new Date(entry.timestamp);
    const thisDay = dayKey(ts);

    // Insert sticky day header when the day changes
    if (thisDay !== lastDayKey) {
      lastDayKey = thisDay;
      const header = document.createElement('div');
      header.className = 'history-day-header';
      header.textContent = dayLabel(ts);
      list.appendChild(header);
    }

    const time = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const color = kidColors[entry.childName] || 'rgb(59, 130, 246)';
    // Create rgba version for badge
    const badgeFill = color.replace(')', ', 0.12)').replace('rgb', 'rgba');
    const badgeStroke = color.replace(')', ', 0.25)').replace('rgb', 'rgba');

    const row = document.createElement('div');
    row.className = 'history-row';
    row.dataset.entryId = entry.id;

    // Color-coded left accent bar
    row.style.borderLeft = `3px solid ${color.replace(')', ', 0.6)').replace('rgb', 'rgba')}`;
    row.style.paddingLeft = '12px';

    row.innerHTML = `
      <div class="history-row-info">
        <h3>${entry.childName}</h3>
        <p>${time}${entry.backfilled ? ' · added' : ''}</p>
        ${entry.note ? `<p class="history-row-note">${entry.note.replace(/</g, '&lt;')}</p>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="duration-badge" style="background: ${badgeFill}; border-color: ${badgeStroke}; color: ${color}">${formatDuration(entry.duration)}</span>
        <button class="btn-delete" title="Delete">&times;</button>
      </div>
    `;

    const deleteBtn = row.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(i);
    });

    // Tap the row (outside the delete button) to edit
    row.addEventListener('click', () => {
      if (typeof openEditHistory === 'function') openEditHistory(entry.id);
    });
    row.style.cursor = 'pointer';

    list.appendChild(row);
  }
}

let _historyFilter = 'all'; // 'all' or a kid name

function renderFilterChips(kids) {
  const el = document.getElementById('history-filter-chips');
  if (!el) return;
  const opts = [{ label: 'All', value: 'all', color: null }, ...kids.map(k => ({ label: k.name, value: k.name, color: k.color, avatar: k.avatar }))];
  el.innerHTML = opts.map(o => {
    const active = _historyFilter === o.value;
    const style = active && o.color
      ? `background:${o.color.replace(')', ', 0.22)').replace('rgb','rgba')};border-color:${o.color.replace(')', ', 0.5)').replace('rgb','rgba')};color:${o.color};`
      : '';
    const prefix = o.avatar ? `${o.avatar} ` : '';
    return `<button class="history-chip ${active ? 'active' : ''}" data-v="${o.value}" style="${style}">${prefix}${o.label}</button>`;
  }).join('');
  el.querySelectorAll('.history-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _historyFilter = btn.dataset.v;
      renderFilterChips(kids);
      renderHistoryList(_historyFilteredHistory(window._fullHistory || []), kids, window._historyOnDelete);
    });
  });
}

function _historyFilteredHistory(history) {
  if (_historyFilter === 'all') return history;
  return history.filter(e => e.childName === _historyFilter);
}

// 30-day heat-map (one row per kid)
function renderHeatmap(history, kids) {
  const el = document.getElementById('heatmap-grid');
  if (!el) return;

  // Collect: for each kid, a map of dayKey → minutes
  const byKid = {};
  kids.forEach(k => { byKid[k.name] = {}; });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  cutoff.setHours(0,0,0,0);
  for (const e of history) {
    const ts = new Date(e.timestamp);
    if (ts < cutoff) continue;
    const d = new Date(ts); d.setHours(0,0,0,0);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (byKid[e.childName] !== undefined) {
      byKid[e.childName][k] = (byKid[e.childName][k] || 0) + e.duration;
    }
  }

  // Vacations for the family — color differently
  const vacations = (typeof Storage !== 'undefined') ? Storage.loadVacations() : [];
  const vacDays = new Set();
  for (const v of vacations) {
    const start = new Date(v.start); const end = new Date(v.end);
    if (isNaN(start) || isNaN(end)) continue;
    const d = new Date(start); d.setHours(0,0,0,0);
    while (d <= end) {
      vacDays.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      d.setDate(d.getDate() + 1);
    }
  }

  const days = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push({ key: k, date: d, weekday: d.getDay() });
  }

  el.innerHTML = kids.map(kid => {
    const cells = days.map(d => {
      const mins = (byKid[kid.name][d.key] || 0) / 60;
      const isVac = vacDays.has(d.key);
      let bg = 'transparent';
      let title = `${d.date.toDateString()} — ${Math.round(mins)} min`;
      if (isVac) {
        bg = 'rgba(120,200,130,0.35)';
        title += ' · vacation';
      } else if (mins > 0) {
        // Opacity by intensity (cap at 30 min)
        const alpha = Math.min(0.9, 0.15 + (mins / 30) * 0.75);
        bg = kid.color.replace(')', `, ${alpha.toFixed(2)})`).replace('rgb', 'rgba');
      } else {
        bg = 'rgba(128,128,128,0.08)';
      }
      return `<div class="heat-cell" style="background:${bg}" title="${title}"></div>`;
    }).join('');
    return `
      <div class="heatmap-row">
        <div class="heatmap-label">${kid.avatar || '⭐'} ${kid.name}</div>
        <div class="heatmap-cells">${cells}</div>
      </div>
    `;
  }).join('');
}

function renderHistory(history, kids, onDelete) {
  window._fullHistory = history;
  window._historyOnDelete = onDelete;
  renderWeeklyGrid(history, kids);
  renderFilterChips(kids);
  renderHistoryList(_historyFilteredHistory(history), kids, onDelete);
  renderHeatmap(history, kids);
}
