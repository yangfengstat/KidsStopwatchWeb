// Storage module — mirrors StorageManager.swift
const Storage = (() => {
  const HISTORY_KEY = 'stopwatchHistory';
  const FREEZE_START_KEY = 'freezeTrackingStart';

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function loadHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        // Ensure timestamps are Date-compatible strings
        return parsed.map(e => ({
          ...e,
          timestamp: e.timestamp // stored as ISO string
        }));
      } catch { return []; }
    }
    return [];
  }

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

  return { saveHistory, loadHistory, ensureFreezeTrackingStart, setFreezeTrackingStart };
})();
