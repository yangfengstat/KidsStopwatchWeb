// Storage module — mirrors StorageManager.swift + achievements/gems
const Storage = (() => {
  const HISTORY_KEY = 'stopwatchHistory';
  const FREEZE_START_KEY = 'freezeTrackingStart';
  const ACHIEVEMENTS_KEY = 'unlockedAchievements';
  const GEMS_KEY = 'gemBalance';
  const PURCHASED_FREEZES_KEY = 'purchasedFreezes';

  // --- History ---
  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function loadHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed.map(e => ({ ...e, timestamp: e.timestamp }));
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
    return now;
  }

  function setFreezeTrackingStart(date) {
    localStorage.setItem(FREEZE_START_KEY, date.toISOString());
  }

  // --- Achievements ---
  function _loadMap(key) {
    const data = localStorage.getItem(key);
    if (data) { try { return JSON.parse(data); } catch {} }
    return {};
  }

  function _saveMap(key, map) {
    localStorage.setItem(key, JSON.stringify(map));
  }

  function loadUnlockedAchievements(kidName) {
    const map = _loadMap(ACHIEVEMENTS_KEY);
    return map[kidName] || [];
  }

  function saveUnlockedAchievements(kidName, ids) {
    const map = _loadMap(ACHIEVEMENTS_KEY);
    map[kidName] = ids;
    _saveMap(ACHIEVEMENTS_KEY, map);
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
  }

  return {
    saveHistory, loadHistory,
    ensureFreezeTrackingStart, setFreezeTrackingStart,
    loadUnlockedAchievements, saveUnlockedAchievements,
    getGems, addGems,
    getPurchasedFreezes, addPurchasedFreezes,
  };
})();
