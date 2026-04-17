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

    const card = document.createElement('div');
    card.className = 'weekly-card';
    card.style.border = `1px solid ${kid.color.replace(')', ', 0.2)').replace('rgb', 'rgba')}`;

    card.innerHTML = `
      <div class="weekly-card-name">
        <span class="weekly-card-avatar">${kid.avatar || '⭐'}</span>
        <span>${kid.name}</span>
      </div>
      <div class="weekly-card-time">${formatWeeklyTotal(total)}</div>
      <div class="weekly-card-footer">
        <span class="weekly-card-label">This week</span>
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

function renderHistory(history, kids, onDelete) {
  renderWeeklyGrid(history, kids);
  renderHistoryList(history, kids, onDelete);
}
