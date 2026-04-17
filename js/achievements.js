// Achievements & Gems system

const FREEZE_COST = 15; // gems per streak freeze

const ACHIEVEMENT_DEFS = [
  // Streak achievements
  { id: 'streak_3',   cat: 'streak',  icon: '🔥', name: 'On Fire',          desc: '3-day streak',         gems: 5,  stat: 'streak',        target: 3,     check: (s) => s.streak >= 3 },
  { id: 'streak_7',   cat: 'streak',  icon: '🔥', name: 'Week Warrior',     desc: '7-day streak',         gems: 10, stat: 'streak',        target: 7,     check: (s) => s.streak >= 7 },
  { id: 'streak_14',  cat: 'streak',  icon: '🔥', name: 'Two Week Titan',   desc: '14-day streak',        gems: 20, stat: 'streak',        target: 14,    check: (s) => s.streak >= 14 },
  { id: 'streak_30',  cat: 'streak',  icon: '💪', name: 'Monthly Master',   desc: '30-day streak',        gems: 30, stat: 'streak',        target: 30,    check: (s) => s.streak >= 30 },
  { id: 'streak_60',  cat: 'streak',  icon: '💪', name: 'Unstoppable',      desc: '60-day streak',        gems: 50, stat: 'streak',        target: 60,    check: (s) => s.streak >= 60 },
  { id: 'streak_100', cat: 'streak',  icon: '👑', name: 'Legendary',        desc: '100-day streak',       gems: 100, stat: 'streak',       target: 100,   check: (s) => s.streak >= 100 },

  // Session count achievements
  { id: 'sess_1',     cat: 'session', icon: '⭐', name: 'First Steps',      desc: 'Complete 1 session',   gems: 5,  stat: 'sessions',      target: 1,     check: (s) => s.sessions >= 1 },
  { id: 'sess_10',    cat: 'session', icon: '⭐', name: 'Getting Going',    desc: 'Complete 10 sessions', gems: 10, stat: 'sessions',      target: 10,    check: (s) => s.sessions >= 10 },
  { id: 'sess_25',    cat: 'session', icon: '🌟', name: 'Quarter Century',  desc: 'Complete 25 sessions', gems: 20, stat: 'sessions',      target: 25,    check: (s) => s.sessions >= 25 },
  { id: 'sess_50',    cat: 'session', icon: '🌟', name: 'Half Century',     desc: 'Complete 50 sessions', gems: 30, stat: 'sessions',      target: 50,    check: (s) => s.sessions >= 50 },
  { id: 'sess_100',   cat: 'session', icon: '💎', name: 'Century Club',     desc: 'Complete 100 sessions',gems: 60, stat: 'sessions',      target: 100,   check: (s) => s.sessions >= 100 },

  // Total time achievements
  { id: 'time_10m',   cat: 'time',    icon: '⏱️', name: 'Warming Up',       desc: '10 min total',         gems: 5,  stat: 'totalTime',     target: 600,   check: (s) => s.totalTime >= 600 },
  { id: 'time_30m',   cat: 'time',    icon: '⏱️', name: 'Half Hour Hero',   desc: '30 min total',         gems: 10, stat: 'totalTime',     target: 1800,  check: (s) => s.totalTime >= 1800 },
  { id: 'time_1h',    cat: 'time',    icon: '🏃', name: 'Hour Power',       desc: '1 hour total',         gems: 20, stat: 'totalTime',     target: 3600,  check: (s) => s.totalTime >= 3600 },
  { id: 'time_3h',    cat: 'time',    icon: '🏃', name: 'Triple Threat',    desc: '3 hours total',        gems: 30, stat: 'totalTime',     target: 10800, check: (s) => s.totalTime >= 10800 },
  { id: 'time_5h',    cat: 'time',    icon: '🏅', name: 'Five Star',        desc: '5 hours total',        gems: 50, stat: 'totalTime',     target: 18000, check: (s) => s.totalTime >= 18000 },
  { id: 'time_10h',   cat: 'time',    icon: '🏆', name: 'Champion',         desc: '10 hours total',       gems: 80, stat: 'totalTime',     target: 36000, check: (s) => s.totalTime >= 36000 },

  // Single session achievements
  { id: 'single_5m',  cat: 'single',  icon: '🎯', name: 'Focused',          desc: '5 min in one session', gems: 5,  stat: 'longestSession', target: 300,  check: (s) => s.longestSession >= 300 },
  { id: 'single_10m', cat: 'single',  icon: '🎯', name: 'Dedicated',        desc: '10 min in one session',gems: 10, stat: 'longestSession', target: 600,  check: (s) => s.longestSession >= 600 },
  { id: 'single_15m', cat: 'single',  icon: '🎯', name: 'Persistent',       desc: '15 min in one session',gems: 15, stat: 'longestSession', target: 900,  check: (s) => s.longestSession >= 900 },
  { id: 'single_30m', cat: 'single',  icon: '🏆', name: 'Marathon Runner',  desc: '30 min in one session',gems: 30, stat: 'longestSession', target: 1800, check: (s) => s.longestSession >= 1800 },

  // Pull-up lifetime totals
  { id: 'pu_first',   cat: 'reps',    icon: '💪', name: 'First Pull-up',    desc: '1 pull-up lifetime',    gems: 5,  stat: 'totalPullups',    target: 1,    check: (s) => s.totalPullups    >= 1 },
  { id: 'pu_10',      cat: 'reps',    icon: '💪', name: 'Ten Up',           desc: '10 pull-ups lifetime',  gems: 10, stat: 'totalPullups',    target: 10,   check: (s) => s.totalPullups    >= 10 },
  { id: 'pu_50',      cat: 'reps',    icon: '💪', name: 'Fifty Up',         desc: '50 pull-ups lifetime',  gems: 20, stat: 'totalPullups',    target: 50,   check: (s) => s.totalPullups    >= 50 },
  { id: 'pu_100',     cat: 'reps',    icon: '🏋️', name: 'Century Pulls',   desc: '100 pull-ups lifetime', gems: 40, stat: 'totalPullups',    target: 100,  check: (s) => s.totalPullups    >= 100 },
  { id: 'pu_500',     cat: 'reps',    icon: '🏆', name: 'Pull-up Pro',      desc: '500 pull-ups lifetime', gems: 80, stat: 'totalPullups',    target: 500,  check: (s) => s.totalPullups    >= 500 },

  // Push-up lifetime totals
  { id: 'po_first',   cat: 'reps',    icon: '💪', name: 'First Push-up',    desc: '1 push-up lifetime',    gems: 5,  stat: 'totalPushups',    target: 1,    check: (s) => s.totalPushups    >= 1 },
  { id: 'po_50',      cat: 'reps',    icon: '💪', name: 'Fifty Down',       desc: '50 push-ups lifetime',  gems: 10, stat: 'totalPushups',    target: 50,   check: (s) => s.totalPushups    >= 50 },
  { id: 'po_250',     cat: 'reps',    icon: '🏋️', name: 'Quarter-K Push',  desc: '250 push-ups lifetime', gems: 25, stat: 'totalPushups',    target: 250,  check: (s) => s.totalPushups    >= 250 },
  { id: 'po_500',     cat: 'reps',    icon: '🏆', name: 'Half-K Club',      desc: '500 push-ups lifetime', gems: 45, stat: 'totalPushups',    target: 500,  check: (s) => s.totalPushups    >= 500 },
  { id: 'po_1000',    cat: 'reps',    icon: '👑', name: 'Push-up Legend',   desc: '1000 push-ups lifetime',gems: 90, stat: 'totalPushups',    target: 1000, check: (s) => s.totalPushups    >= 1000 },

  // Single-day bests
  { id: 'pu_day_5',   cat: 'reps',    icon: '⚡', name: 'Pull-up Burst',    desc: '5 pull-ups in a day',   gems: 10, stat: 'bestDayPullups',  target: 5,    check: (s) => s.bestDayPullups  >= 5 },
  { id: 'pu_day_15',  cat: 'reps',    icon: '⚡', name: 'Pull-up Power',    desc: '15 pull-ups in a day',  gems: 25, stat: 'bestDayPullups',  target: 15,   check: (s) => s.bestDayPullups  >= 15 },
  { id: 'po_day_25',  cat: 'reps',    icon: '⚡', name: 'Push-up Sprint',   desc: '25 push-ups in a day',  gems: 15, stat: 'bestDayPushups',  target: 25,   check: (s) => s.bestDayPushups  >= 25 },
  { id: 'po_day_50',  cat: 'reps',    icon: '⚡', name: 'Push-up Blast',    desc: '50 push-ups in a day',  gems: 30, stat: 'bestDayPushups',  target: 50,   check: (s) => s.bestDayPushups  >= 50 },
];

// Return a human-readable "X away" hint for a locked achievement
function getProgressHint(ach, stats) {
  const current = stats[ach.stat] || 0;
  const remaining = ach.target - current;
  if (remaining <= 0) return null;
  if (ach.stat === 'streak') {
    return `${remaining} more day${remaining === 1 ? '' : 's'}`;
  }
  if (ach.stat === 'sessions') {
    return `${remaining} more session${remaining === 1 ? '' : 's'}`;
  }
  if (ach.stat === 'totalTime' || ach.stat === 'longestSession') {
    const mins = Math.ceil(remaining / 60);
    if (mins < 60) return `${mins} more min`;
    const hrs = (remaining / 3600).toFixed(1).replace(/\.0$/, '');
    return `${hrs} more hr${hrs === '1' ? '' : 's'}`;
  }
  if (ach.stat === 'totalPullups' || ach.stat === 'bestDayPullups') {
    return `${remaining} more pull-up${remaining === 1 ? '' : 's'}`;
  }
  if (ach.stat === 'totalPushups' || ach.stat === 'bestDayPushups') {
    return `${remaining} more push-up${remaining === 1 ? '' : 's'}`;
  }
  return null;
}

const CATEGORY_LABELS = {
  streak: '🔥 Streak',
  session: '⭐ Sessions',
  time: '⏱️ Total Time',
  single: '🎯 Single Session',
  reps: '💪 Pull-ups & Push-ups',
};

// Compute stats for a kid from history
function computeKidStats(kidName, historyData) {
  const entries = historyData.filter(e => e.childName === kidName);
  const sessions = entries.length;
  const totalTime = entries.reduce((sum, e) => sum + e.duration, 0);
  const longestSession = entries.reduce((max, e) => Math.max(max, e.duration), 0);
  const info = streakInfo(kidName, historyData);

  // Rep stats from exerciseCounts
  const allReps = Storage.loadAllExerciseCounts();
  const kidReps = allReps[kidName] || {};
  let totalPullups = 0, totalPushups = 0, bestDayPullups = 0, bestDayPushups = 0;
  for (const day in kidReps) {
    const r = kidReps[day] || {};
    const pu = r.pullups || 0, po = r.pushups || 0;
    totalPullups += pu;
    totalPushups += po;
    if (pu > bestDayPullups) bestDayPullups = pu;
    if (po > bestDayPushups) bestDayPushups = po;
  }

  return {
    streak: info.streak,
    sessions,
    totalTime,
    longestSession,
    totalPullups,
    totalPushups,
    bestDayPullups,
    bestDayPushups,
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
        <span class="kid-avatar" style="background: ${colorWithAlpha(kid.color, 0.2)}; border-color: ${colorWithAlpha(kid.color, 0.4)}">${kid.avatar || '⭐'}</span>
        <span class="ach-kid-name">${kid.name}</span>
      </div>
      <div class="ach-gem-hero" style="--kid-color: ${kid.color}; --kid-color-faint: ${colorWithAlpha(kid.color, 0.15)}">
        <div class="ach-gem-hero-number" style="color: ${kid.color}; text-shadow: 0 0 24px ${colorWithAlpha(kid.color, 0.45)}">${gems}</div>
        <div class="ach-gem-hero-label">💎 gems</div>
      </div>
      <div class="ach-gem-row">
        <button class="btn-buy-freeze" ${gems < FREEZE_COST ? 'disabled' : ''}>
          ❄️ Buy Freeze (${FREEZE_COST} 💎)
        </button>
        <div class="ach-freeze-count">
          ❄️ <span>${freezes}</span> freeze${freezes === 1 ? '' : 's'} owned
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
    const categories = ['streak', 'session', 'time', 'single', 'reps'];
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
        const hint = !isUnlocked ? getProgressHint(ach, stats) : null;
        card.innerHTML = `
          <div class="ach-card-icon">${isUnlocked ? ach.icon : '🔒'}</div>
          <div class="ach-card-info">
            <div class="ach-card-name">${ach.name}</div>
            <div class="ach-card-desc">${ach.desc}</div>
            ${hint ? `<div class="ach-card-hint">${hint}</div>` : ''}
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
