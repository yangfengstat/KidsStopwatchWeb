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

// Build a set of "YYYY-MM-DD" keys for every day covered by any vacation range
function buildVacationDaySet(vacations) {
  const set = new Set();
  if (!vacations) return set;
  for (const v of vacations) {
    if (!v || !v.start || !v.end) continue;
    const start = startOfDay(new Date(v.start));
    const end   = startOfDay(new Date(v.end));
    if (isNaN(start) || isNaN(end) || end < start) continue;
    let d = start;
    for (let i = 0; i < 400 && d <= end; i++) {
      set.add(dateKey(d));
      d = addDays(d, 1);
    }
  }
  return set;
}

// Streak calculation: vacation days are skipped (don't break streak, don't add to streak, don't consume freeze)
function currentStreak(exerciseDayKeys, freezesAvailable, vacationDayKeys) {
  if (exerciseDayKeys.size === 0) return 0;

  let freezesLeft = freezesAvailable;
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);

  // Start from today if today has an entry, today is on vacation, or yesterday onward
  let currentDay;
  if (exerciseDayKeys.has(todayKey) || (vacationDayKeys && vacationDayKeys.has(todayKey))) {
    currentDay = today;
  } else {
    currentDay = addDays(today, -1);
  }

  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(currentDay);
    if (vacationDayKeys && vacationDayKeys.has(key)) {
      // Vacation day — skip without consuming a freeze or counting toward streak
    } else if (exerciseDayKeys.has(key)) {
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

function streakInfo(kidName, historyData) {
  const entries = historyData.filter(e => e.childName === kidName);
  const exerciseDayKeys = new Set(entries.map(e => dateKey(new Date(e.timestamp))));

  // Freezes = 2 starter + purchased with gems
  const purchasedFreezes = Storage.getPurchasedFreezes(kidName);
  const totalFreezes = 2 + purchasedFreezes;

  // Family-wide vacations
  const vacations = Storage.loadVacations();
  const vacationDayKeys = buildVacationDaySet(vacations);

  const streak = currentStreak(exerciseDayKeys, totalFreezes, vacationDayKeys);

  // Calculate remaining freezes by walking backwards (same logic, respecting vacations)
  const freezeTrackingStart = Storage.ensureFreezeTrackingStart();
  const today = startOfDay(new Date());
  const todayKey = dateKey(today);

  const candidateStartDay = (exerciseDayKeys.has(todayKey) || vacationDayKeys.has(todayKey))
    ? today
    : addDays(today, -1);

  const freezeStartDay = startOfDay(freezeTrackingStart);
  let freezesLeft = totalFreezes;

  if (candidateStartDay >= freezeStartDay) {
    let currentDay = candidateStartDay;
    for (let i = 0; i < 3650 && currentDay >= freezeStartDay; i++) {
      const key = dateKey(currentDay);
      if (vacationDayKeys.has(key)) {
        // skip
      } else if (exerciseDayKeys.has(key)) {
        // no change
      } else if (freezesLeft > 0) {
        freezesLeft--;
      } else {
        break;
      }
      currentDay = addDays(currentDay, -1);
    }
  }

  // Is today itself a vacation day?
  const onVacation = vacationDayKeys.has(todayKey);

  return { streak, freezesLeft: Math.max(0, freezesLeft), onVacation };
}
