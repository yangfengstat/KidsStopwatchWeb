// Achievements & Gems system

const FREEZE_COST = 15; // gems per streak freeze

const ACHIEVEMENT_DEFS = [
  // Streak achievements
  { id: 'streak_3',   cat: 'streak',  icon: '🔥', name: 'On Fire',          desc: '3-day streak',         gems: 5,  check: (s) => s.streak >= 3 },
  { id: 'streak_7',   cat: 'streak',  icon: '🔥', name: 'Week Warrior',     desc: '7-day streak',         gems: 10, check: (s) => s.streak >= 7 },
  { id: 'streak_14',  cat: 'streak',  icon: '🔥', name: 'Two Week Titan',   desc: '14-day streak',        gems: 20, check: (s) => s.streak >= 14 },
  { id: 'streak_30',  cat: 'streak',  icon: '💪', name: 'Monthly Master',   desc: '30-day streak',        gems: 30, check: (s) => s.streak >= 30 },
  { id: 'streak_60',  cat: 'streak',  icon: '💪', name: 'Unstoppable',      desc: '60-day streak',        gems: 50, check: (s) => s.streak >= 60 },
  { id: 'streak_100', cat: 'streak',  icon: '👑', name: 'Legendary',        desc: '100-day streak',       gems: 100,check: (s) => s.streak >= 100 },

  // Session count achievements
  { id: 'sess_1',     cat: 'session', icon: '⭐', name: 'First Steps',      desc: 'Complete 1 session',   gems: 5,  check: (s) => s.sessions >= 1 },
  { id: 'sess_10',    cat: 'session', icon: '⭐', name: 'Getting Going',    desc: 'Complete 10 sessions', gems: 10, check: (s) => s.sessions >= 10 },
  { id: 'sess_25',    cat: 'session', icon: '🌟', name: 'Quarter Century',  desc: 'Complete 25 sessions', gems: 20, check: (s) => s.sessions >= 25 },
  { id: 'sess_50',    cat: 'session', icon: '🌟', name: 'Half Century',     desc: 'Complete 50 sessions', gems: 30, check: (s) => s.sessions >= 50 },
  { id: 'sess_100',   cat: 'session', icon: '💎', name: 'Century Club',     desc: 'Complete 100 sessions',gems: 60, check: (s) => s.sessions >= 100 },

  // Total time achievements
  { id: 'time_10m',   cat: 'time',    icon: '⏱️', name: 'Warming Up',       desc: '10 min total',         gems: 5,  check: (s) => s.totalTime >= 600 },
  { id: 'time_30m',   cat: 'time',    icon: '⏱️', name: 'Half Hour Hero',   desc: '30 min total',         gems: 10, check: (s) => s.totalTime >= 1800 },
  { id: 'time_1h',    cat: 'time',    icon: '🏃', name: 'Hour Power',       desc: '1 hour total',         gems: 20, check: (s) => s.totalTime >= 3600 },
  { id: 'time_3h',    cat: 'time',    icon: '🏃', name: 'Triple Threat',    desc: '3 hours total',        gems: 30, check: (s) => s.totalTime >= 10800 },
  { id: 'time_5h',    cat: 'time',    icon: '🏅', name: 'Five Star',        desc: '5 hours total',        gems: 50, check: (s) => s.totalTime >= 18000 },
  { id: 'time_10h',   cat: 'time',    icon: '🏆', name: 'Champion',         desc: '10 hours total',       gems: 80, check: (s) => s.totalTime >= 36000 },

  // Single session achievements
  { id: 'single_5m',  cat: 'single',  icon: '🎯', name: 'Focused',          desc: '5 min in one session', gems: 5,  check: (s) => s.longestSession >= 300 },
  { id: 'single_10m', cat: 'single',  icon: '🎯', name: 'Dedicated',        desc: '10 min in one session',gems: 10, check: (s) => s.longestSession >= 600 },
  { id: 'single_15m', cat: 'single',  icon: '🎯', name: 'Persistent',       desc: '15 min in one session',gems: 15, check: (s) => s.longestSession >= 900 },
  { id: 'single_30m', cat: 'single',  icon: '🏆', name: 'Marathon Runner',  desc: '30 min in one session',gems: 30, check: (s) => s.longestSession >= 1800 },
];

const CATEGORY_LABELS = {
  streak: '🔥 Streak',
  session: '⭐ Sessions',
  time: '⏱️ Total Time',
  single: '🎯 Single Session',
};

// Compute stats for a kid from history
function computeKidStats(kidName, historyData) {
  const entries = historyData.filter(e => e.childName === kidName);
  const sessions = entries.length;
  const totalTime = entries.reduce((sum, e) => sum + e.duration, 0);
  const longestSession = entries.reduce((max, e) => Math.max(max, e.duration), 0);
  const info = streakInfo(kidName, historyData);
  return {
    streak: info.streak,
    sessions,
    totalTime,
    longestSession,
  };
}

// Check achievements and award new gems. Returns array of newly unlocked achievement ids.
function checkAchievements(kidName, historyData) {
  const stats = computeKidStats(kidName, historyData);
  const unlocked = Storage.loadUnlockedAchievements(kidName);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENT_DEFS) {
    if (!unlocked.includes(ach.id) && ach.check(stats)) {
      newlyUnlocked.push(ach);
      unlocked.push(ach.id);
      Storage.addGems(kidName, ach.gems);
    }
  }

  if (newlyUnlocked.length > 0) {
    Storage.saveUnlockedAchievements(kidName, unlocked);
  }

  return newlyUnlocked;
}

// Purchase a freeze with gems. Returns true if successful.
function purchaseFreeze(kidName) {
  const gems = Storage.getGems(kidName);
  if (gems >= FREEZE_COST) {
    Storage.addGems(kidName, -FREEZE_COST);
    Storage.addPurchasedFreezes(kidName, 1);
    return true;
  }
  return false;
}

// Render the achievements view
function renderAchievementsView(kids, historyData) {
  const container = document.getElementById('achievements-content');
  container.innerHTML = '';

  for (const kid of kids) {
    const gems = Storage.getGems(kid.name);
    const freezes = Storage.getPurchasedFreezes(kid.name);
    const unlocked = new Set(Storage.loadUnlockedAchievements(kid.name));
    const stats = computeKidStats(kid.name, historyData);
    const dark = isDark();

    // Kid section
    const section = document.createElement('div');
    section.className = 'ach-kid-section';

    // Header with gem balance
    const header = document.createElement('div');
    header.className = 'ach-kid-header';
    if (dark) {
      header.style.background = 'rgba(44, 44, 46, 0.92)';
      header.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    } else {
      header.style.background = `linear-gradient(135deg, ${colorWithAlpha(kid.color, 0.1)}, ${colorWithAlpha(kid.color, 0.03)})`;
      header.style.border = `1px solid ${colorWithAlpha(kid.color, 0.15)}`;
    }
    header.innerHTML = `
      <div class="ach-kid-info">
        <div class="color-dot" style="background: ${kid.color}; opacity: 0.8"></div>
        <span class="ach-kid-name">${kid.name}</span>
      </div>
      <div class="ach-gem-row">
        <div class="ach-gem-balance">
          <span class="gem-icon">💎</span>
          <span class="gem-count">${gems}</span>
        </div>
        <button class="btn-buy-freeze" ${gems < FREEZE_COST ? 'disabled' : ''}>
          ❄️ Buy Freeze (${FREEZE_COST} 💎)
        </button>
        <div class="ach-freeze-count">
          ❄️ <span>${freezes}</span> owned
        </div>
      </div>
    `;

    const buyBtn = header.querySelector('.btn-buy-freeze');
    buyBtn.addEventListener('click', () => {
      if (purchaseFreeze(kid.name)) {
        renderAchievementsView(kids, historyData);
        // Update streak badges on timers tab
        stopwatches.forEach((_, i) => updateStreakDisplay(i));
        Confetti.launch(); // Celebrate the purchase!
      }
    });

    section.appendChild(header);

    // Progress summary
    const progress = document.createElement('div');
    progress.className = 'ach-progress';
    const totalAch = ACHIEVEMENT_DEFS.length;
    const unlockedCount = unlocked.size;
    progress.innerHTML = `
      <div class="ach-progress-bar-container">
        <div class="ach-progress-bar" style="width: ${(unlockedCount / totalAch) * 100}%; background: ${kid.color}"></div>
      </div>
      <span class="ach-progress-text">${unlockedCount} / ${totalAch} achievements</span>
    `;
    section.appendChild(progress);

    // Achievement grid by category
    const categories = ['streak', 'session', 'time', 'single'];
    for (const cat of categories) {
      const catAchs = ACHIEVEMENT_DEFS.filter(a => a.cat === cat);
      const catDiv = document.createElement('div');
      catDiv.className = 'ach-category';
      catDiv.innerHTML = `<h3 class="ach-cat-label">${CATEGORY_LABELS[cat]}</h3>`;

      const grid = document.createElement('div');
      grid.className = 'ach-grid';

      for (const ach of catAchs) {
        const isUnlocked = unlocked.has(ach.id);
        const card = document.createElement('div');
        card.className = `ach-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        if (isUnlocked) {
          card.style.borderColor = colorWithAlpha(kid.color, 0.3);
          if (!dark) {
            card.style.background = colorWithAlpha(kid.color, 0.06);
          }
        }
        card.innerHTML = `
          <div class="ach-card-icon">${isUnlocked ? ach.icon : '🔒'}</div>
          <div class="ach-card-info">
            <div class="ach-card-name">${ach.name}</div>
            <div class="ach-card-desc">${ach.desc}</div>
          </div>
          <div class="ach-card-gems ${isUnlocked ? 'earned' : ''}">
            ${isUnlocked ? '✅' : `💎 ${ach.gems}`}
          </div>
        `;
        grid.appendChild(card);
      }

      catDiv.appendChild(grid);
      section.appendChild(catDiv);
    }

    container.appendChild(section);
  }
}
