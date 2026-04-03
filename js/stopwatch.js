// Stopwatch class + streak/freeze logic

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time) % 60;
  const fraction = Math.floor((time - Math.floor(time)) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
}

function formatDuration(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatWeeklyTotal(time) {
  const totalSeconds = Math.round(time);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Streak calculation — mirrors ContentView.swift streakInfo + currentStreak
function currentStreak(exerciseDayKeys, freezesAvailable) {
  if (exerciseDayKeys.size === 0) return 0;

  let freezesLeft = freezesAvailable;
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);

  let currentDay;
  if (exerciseDayKeys.has(todayKey)) {
    currentDay = today;
  } else {
    currentDay = addDays(today, -1);
  }

  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(currentDay);
    if (exerciseDayKeys.has(key)) {
      streak++;
    } else if (freezesLeft > 0) {
      freezesLeft--;
    } else {
      break;
    }
    currentDay = addDays(currentDay, -1);
  }
  return streak;
}

function streakInfo(kidName, history) {
  const freezeTrackingStart = Storage.ensureFreezeTrackingStart();
  const entries = history.filter(e => e.childName === kidName);

  // Exercise days for streak
  const exerciseDayKeys = new Set(entries.map(e => dateKey(new Date(e.timestamp))));
  const totalSeconds = entries.reduce((sum, e) => sum + e.duration, 0);
  const earnedFreezes = Math.floor(totalSeconds / (50 * 60));
  const streak = currentStreak(exerciseDayKeys, 2 + earnedFreezes);

  // Freeze tracking
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);
  const freezeEntries = entries.filter(e => new Date(e.timestamp) >= freezeTrackingStart);
  const freezeExerciseDayKeys = new Set(freezeEntries.map(e => dateKey(new Date(e.timestamp))));
  const freezeSeconds = freezeEntries.reduce((sum, e) => sum + e.duration, 0);
  const freezeEarned = Math.floor(freezeSeconds / (50 * 60));
  let freezesLeft = 2 + freezeEarned;

  const candidateStartDay = freezeExerciseDayKeys.has(todayKey)
    ? today
    : addDays(today, -1);

  const freezeStartDay = startOfDay(freezeTrackingStart);
  if (candidateStartDay < freezeStartDay) {
    return { streak, freezesLeft };
  }

  let currentDay = candidateStartDay;
  for (let i = 0; i < 3650 && currentDay >= freezeStartDay; i++) {
    const key = dateKey(currentDay);
    if (freezeExerciseDayKeys.has(key)) {
      // no change
    } else if (freezesLeft > 0) {
      freezesLeft--;
    } else {
      break;
    }
    currentDay = addDays(currentDay, -1);
  }

  return { streak, freezesLeft: Math.max(0, freezesLeft) };
}
