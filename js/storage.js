// Storage module — mirrors StorageManager.swift + achievements/gems + kids + vacations
const Storage = (() => {
  const HISTORY_KEY = 'stopwatchHistory';
  const FREEZE_START_KEY = 'freezeTrackingStart';
  const ACHIEVEMENTS_KEY = 'unlockedAchievements';
  const GEMS_KEY = 'gemBalance';
  const PURCHASED_FREEZES_KEY = 'purchasedFreezes';
  const KIDS_KEY = 'kidsConfig';
  const VACATIONS_KEY = 'vacations';
  const EXERCISE_COUNTS_KEY = 'exerciseCounts';
  const THEME_KEY = 'themePreference';
  const WEEKLY_GOALS_KEY = 'weeklyGoals';

  // Default kids if kidsConfig is not set yet
  const DEFAULT_KIDS = [
    { name: 'Isabella', color: 'rgb(250, 133, 166)', avatar: '🌸', archived: false },
    { name: 'Viviana',  color: 'rgb(107, 176, 232)', avatar: '🦋', archived: false }
  ];

  // --- History ---
  function saveHistory(history) {
    // Always sort newest-first on save
    const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted));
    _sync();
  }

  function loadHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        // Defensive sort in case older data wasn't sorted
        return parsed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch { return []; }
    }
    return [];
  }

  // --- Freeze tracking start ---
  function ensureFreezeTrackingStart() {
    const stored = localStorage.getItem(FREEZE_START_KEY);
    if (stored) return new Date(stored);
    const now = new Date();
    localStorage.setItem(FREEZE_START_KEY, now.toISOString());
    _sync();
    return now;
  }

  function setFreezeTrackingStart(date) {
    localStorage.setItem(FREEZE_START_KEY, date.toISOString());
    _sync();
  }

  // --- Shared map helpers ---
  function _loadMap(key) {
    const data = localStorage.getItem(key);
    if (data) { try { return JSON.parse(data); } catch {} }
    return {};
  }

  function _saveMap(key, map) {
    localStorage.setItem(key, JSON.stringify(map));
  }

  // --- Achievements ---
  function loadUnlockedAchievements(kidName) {
    const map = _loadMap(ACHIEVEMENTS_KEY);
    return map[kidName] || [];
  }

  function saveUnlockedAchievements(kidName, ids) {
    const map = _loadMap(ACHIEVEMENTS_KEY);
    map[kidName] = ids;
    _saveMap(ACHIEVEMENTS_KEY, map);
    _sync();
  }

  // --- Gems ---
  function getGems(kidName) {
    const map = _loadMap(GEMS_KEY);
    return map[kidName] || 0;
  }

  function addGems(kidName, amount) {
    const map = _loadMap(GEMS_KEY);
    map[kidName] = (map[kidName] || 0) + amount;
    _saveMap(GEMS_KEY, map);
    _sync();
  }

  // --- Purchased Freezes ---
  function getPurchasedFreezes(kidName) {
    const map = _loadMap(PURCHASED_FREEZES_KEY);
    return map[kidName] || 0;
  }

  function addPurchasedFreezes(kidName, amount) {
    const map = _loadMap(PURCHASED_FREEZES_KEY);
    map[kidName] = (map[kidName] || 0) + amount;
    _saveMap(PURCHASED_FREEZES_KEY, map);
    _sync();
  }

  // --- Kids config ---
  function loadKidsConfig() {
    const data = localStorage.getItem(KIDS_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        // Migrate entries missing avatar/archived
        return parsed.map(k => ({
          name: k.name,
          color: k.color,
          avatar: k.avatar || '⭐',
          archived: !!k.archived
        }));
      } catch {}
    }
    // Seed defaults on first load
    localStorage.setItem(KIDS_KEY, JSON.stringify(DEFAULT_KIDS));
    return [...DEFAULT_KIDS];
  }

  function saveKidsConfig(kids) {
    localStorage.setItem(KIDS_KEY, JSON.stringify(kids));
    _sync();
  }

  // --- Exercise counts (per-kid, per-day pull-up / push-up tallies) ---
  // Shape: { kidName: { "YYYY-MM-DD": { pullups: N, pushups: N } } }
  function _loadExerciseCounts() {
    const data = localStorage.getItem(EXERCISE_COUNTS_KEY);
    if (data) { try { return JSON.parse(data); } catch {} }
    return {};
  }

  function loadAllExerciseCounts() {
    return _loadExerciseCounts();
  }

  function getReps(kidName, dayKey) {
    const all = _loadExerciseCounts();
    const k = all[kidName] || {};
    const d = k[dayKey] || {};
    return { pullups: d.pullups || 0, pushups: d.pushups || 0 };
  }

  function setReps(kidName, dayKey, { pullups, pushups }) {
    const all = _loadExerciseCounts();
    if (!all[kidName]) all[kidName] = {};
    all[kidName][dayKey] = {
      pullups: Math.max(0, pullups | 0),
      pushups: Math.max(0, pushups | 0),
    };
    localStorage.setItem(EXERCISE_COUNTS_KEY, JSON.stringify(all));
    _sync();
  }

  // Atomic delta update — prevents clobbering a concurrent add on a fast device.
  function addReps(kidName, dayKey, { pullups = 0, pushups = 0 }) {
    const current = getReps(kidName, dayKey);
    setReps(kidName, dayKey, {
      pullups: current.pullups + pullups,
      pushups: current.pushups + pushups,
    });
  }

  // --- Vacations (family-wide) ---
  // Each entry: { id, start: "YYYY-MM-DD", end: "YYYY-MM-DD", note }
  function loadVacations() {
    const data = localStorage.getItem(VACATIONS_KEY);
    if (data) { try { return JSON.parse(data); } catch {} }
    return [];
  }

  function saveVacations(vacations) {
    localStorage.setItem(VACATIONS_KEY, JSON.stringify(vacations));
    _sync();
  }

  // --- Theme preference (light/dark/auto) ---
  function getThemePreference() {
    return localStorage.getItem(THEME_KEY) || 'auto';
  }
  function setThemePreference(pref) {
    if (pref === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
    // NOT synced — this is device-specific.
  }

  // --- Weekly goals (per-kid minute target) ---
  function loadWeeklyGoals() {
    return _loadMap(WEEKLY_GOALS_KEY);
  }
  function saveWeeklyGoals(map) {
    _saveMap(WEEKLY_GOALS_KEY, map);
    _sync();
  }
  function getWeeklyGoal(kidName) {
    const map = _loadMap(WEEKLY_GOALS_KEY);
    return map[kidName] || 0; // 0 = no goal set
  }
  function setWeeklyGoal(kidName, minutes) {
    const map = _loadMap(WEEKLY_GOALS_KEY);
    if (minutes > 0) map[kidName] = minutes;
    else delete map[kidName];
    _saveMap(WEEKLY_GOALS_KEY, map);
    _sync();
  }

  // --- Export / Import ---
  function exportAll() {
    const KEYS = [
      HISTORY_KEY, FREEZE_START_KEY, ACHIEVEMENTS_KEY, GEMS_KEY,
      PURCHASED_FREEZES_KEY, KIDS_KEY, VACATIONS_KEY, EXERCISE_COUNTS_KEY,
      WEEKLY_GOALS_KEY,
    ];
    const blob = { version: 1, exportedAt: new Date().toISOString() };
    for (const k of KEYS) {
      const raw = localStorage.getItem(k);
      if (raw != null) {
        try { blob[k] = JSON.parse(raw); } catch { blob[k] = raw; }
      }
    }
    return blob;
  }
  function importAll(blob) {
    if (!blob || typeof blob !== 'object') throw new Error('Invalid backup file.');
    const KEYS = [
      HISTORY_KEY, FREEZE_START_KEY, ACHIEVEMENTS_KEY, GEMS_KEY,
      PURCHASED_FREEZES_KEY, KIDS_KEY, VACATIONS_KEY, EXERCISE_COUNTS_KEY,
      WEEKLY_GOALS_KEY,
    ];
    for (const k of KEYS) {
      if (blob[k] !== undefined) {
        localStorage.setItem(k, typeof blob[k] === 'string' ? blob[k] : JSON.stringify(blob[k]));
      }
    }
    _sync();
  }

  // Fire-and-forget sync after any write (Sync module may not be loaded yet on first call)
  function _sync() {
    if (typeof Sync !== 'undefined') Sync.push();
  }

  return {
    saveHistory, loadHistory,
    ensureFreezeTrackingStart, setFreezeTrackingStart,
    loadUnlockedAchievements, saveUnlockedAchievements,
    getGems, addGems,
    getPurchasedFreezes, addPurchasedFreezes,
    loadKidsConfig, saveKidsConfig,
    loadVacations, saveVacations,
    getReps, setReps, addReps, loadAllExerciseCounts,
    getThemePreference, setThemePreference,
    loadWeeklyGoals, saveWeeklyGoals, getWeeklyGoal, setWeeklyGoal,
    exportAll, importAll,
    DEFAULT_KIDS,
  };
})();
