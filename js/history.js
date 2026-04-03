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

function renderWeeklyGrid(history, kids) {
  const grid = document.getElementById('weekly-grid');
  grid.innerHTML = '';

  const interval = getWeekInterval();
  const totals = {};

  for (const entry of history) {
    const ts = new Date(entry.timestamp);
    if (ts >= interval.start && ts < interval.end) {
      totals[entry.childName] = (totals[entry.childName] || 0) + entry.duration;
    }
  }

  for (const kid of kids) {
    const total = totals[kid.name] || 0;
    const card = document.createElement('div');
    card.className = 'weekly-card';
    card.style.borderColor = kid.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
    card.style.border = `1px solid ${kid.color.replace(')', ', 0.2)').replace('rgb', 'rgba')}`;

    card.innerHTML = `
      <div class="weekly-card-name">
        <div class="color-dot" style="background: ${kid.color}; opacity: 0.8"></div>
        <span>${kid.name}</span>
      </div>
      <div class="weekly-card-time">${formatWeeklyTotal(total)}</div>
      <div class="weekly-card-label">Total this week</div>
    `;
    grid.appendChild(card);
  }
}

function renderHistoryList(history, onDelete) {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

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

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const ts = new Date(entry.timestamp);
    const weekday = ts.toLocaleDateString('en-US', { weekday: 'short' });
    const time = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <div class="history-row-info">
        <h3>${entry.childName}</h3>
        <p>${weekday} ${time}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="duration-badge">${formatDuration(entry.duration)}</span>
        <button class="btn-delete" title="Delete">&times;</button>
      </div>
    `;

    const deleteBtn = row.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => onDelete(i));

    list.appendChild(row);
  }
}

function renderHistory(history, kids, onDelete) {
  renderWeeklyGrid(history, kids);
  renderHistoryList(history, onDelete);
}
