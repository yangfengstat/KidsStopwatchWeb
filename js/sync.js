// Firebase Sync module
// Syncs all app data under /rooms/{roomCode}/ in Firebase Realtime Database

const Sync = (() => {
  const ROOM_KEY = 'syncRoomCode';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDo-cpMz5hssom8l_-LlmQzGmPxuYhn3jU",
    authDomain: "kidsstopwatch.firebaseapp.com",
    databaseURL: "https://kidsstopwatch-default-rtdb.firebaseio.com",
    projectId: "kidsstopwatch",
    storageBucket: "kidsstopwatch.firebasestorage.app",
    messagingSenderId: "201784282759",
    appId: "1:201784282759:web:0a9f620b3f977b71743222"
  };

  let db = null;
  let currentRoom = null;
  let listenerRef = null;
  let onRemoteUpdate = null; // called when Firebase delivers new data from another device
  let statusCallback = null;
  let pushTimer = null;
  let ignoreNextRemote = false; // suppress echo of our own push

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(remoteUpdateCallback) {
    onRemoteUpdate = remoteUpdateCallback;

    // Firebase loaded via CDN compat scripts
    if (typeof firebase === 'undefined') {
      console.warn('Sync: Firebase SDK not loaded');
      return;
    }

    // Avoid double-init if page reloads
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.database();

    const saved = localStorage.getItem(ROOM_KEY);
    if (saved) {
      _attachRoom(saved, /* pullFirst= */ true);
    } else {
      _setStatus('disconnected');
    }
  }

  // ── Room management ───────────────────────────────────────────────────────

  function getRoomCode() { return currentRoom; }

  /** Generate a new room, upload current local data, return the code. */
  function createRoom() {
    const code = _generateCode();
    _attachRoom(code, /* pullFirst= */ false);
    // Push existing local data into the new room
    _pushNow();
    return code;
  }

  /** Join an existing room by code. Pulls remote data first, then listens. */
  function joinRoom(code) {
    _attachRoom(code.toUpperCase().trim(), /* pullFirst= */ true);
  }

  /** Detach and clear room code. */
  function disconnect() {
    _detach();
    currentRoom = null;
    localStorage.removeItem(ROOM_KEY);
    _setStatus('disconnected');
  }

  // ── Push (local → Firebase) ───────────────────────────────────────────────

  /** Debounced push — call after every localStorage write. */
  function push() {
    if (!currentRoom || !db) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(_pushNow, 600);
  }

  function _pushNow() {
    if (!currentRoom || !db) return;
    _setStatus('syncing');
    ignoreNextRemote = true;
    db.ref(`rooms/${currentRoom}`)
      .set(_gatherLocal())
      .then(() => {
        _setStatus('synced');
        // Clear the ignore flag after a short grace period
        setTimeout(() => { ignoreNextRemote = false; }, 1500);
      })
      .catch(err => {
        console.error('Sync push error:', err);
        ignoreNextRemote = false;
        _setStatus('error');
      });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  function _generateCode() {
    // Unambiguous characters (no 0/O, 1/I/L)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  function _detach() {
    if (listenerRef) {
      listenerRef.off('value');
      listenerRef = null;
    }
  }

  function _attachRoom(code, pullFirst) {
    _detach();
    currentRoom = code.toUpperCase();
    localStorage.setItem(ROOM_KEY, currentRoom);
    _setStatus('connecting');

    const ref = db.ref(`rooms/${currentRoom}`);
    listenerRef = ref;

    if (pullFirst) {
      // Pull current snapshot first, then set up listener
      ref.once('value')
        .then(snap => {
          const data = snap.val();
          if (data) {
            _applyRemote(data);
            if (onRemoteUpdate) onRemoteUpdate();
          }
          _setStatus('synced');
          _startListener(ref);
        })
        .catch(err => {
          console.error('Sync join error:', err);
          _setStatus('error');
        });
    } else {
      _setStatus('synced');
      _startListener(ref);
    }
  }

  function _startListener(ref) {
    ref.on('value', snap => {
      if (ignoreNextRemote) {
        // This is the echo of our own push — skip
        return;
      }
      const data = snap.val();
      if (data) {
        _applyRemote(data);
        if (onRemoteUpdate) onRemoteUpdate();
      }
      _setStatus('synced');
    }, err => {
      console.error('Sync listener error:', err);
      _setStatus('error');
    });
  }

  /** Write Firebase snapshot into localStorage. */
  function _applyRemote(data) {
    if (data.history !== undefined) {
      // Firebase may convert arrays to {0: x, 1: y} objects — normalise back
      const arr = Array.isArray(data.history)
        ? data.history
        : Object.values(data.history || {});
      localStorage.setItem('stopwatchHistory', JSON.stringify(arr));
    }
    if (data.achievements !== undefined) {
      localStorage.setItem('unlockedAchievements', JSON.stringify(data.achievements));
    }
    if (data.gems !== undefined) {
      localStorage.setItem('gemBalance', JSON.stringify(data.gems));
    }
    if (data.freezes !== undefined) {
      localStorage.setItem('purchasedFreezes', JSON.stringify(data.freezes));
    }
    if (data.freezeStart) {
      localStorage.setItem('freezeTrackingStart', data.freezeStart);
    }
  }

  /** Read all localStorage keys into a plain object for Firebase. */
  function _gatherLocal() {
    return {
      history:      JSON.parse(localStorage.getItem('stopwatchHistory')     || '[]'),
      achievements: JSON.parse(localStorage.getItem('unlockedAchievements') || '{}'),
      gems:         JSON.parse(localStorage.getItem('gemBalance')           || '{}'),
      freezes:      JSON.parse(localStorage.getItem('purchasedFreezes')     || '{}'),
      freezeStart:  localStorage.getItem('freezeTrackingStart') || new Date().toISOString(),
      updatedAt:    Date.now(),
    };
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  function onStatus(cb) { statusCallback = cb; }

  function _setStatus(s) {
    if (statusCallback) statusCallback(s);
  }

  return { init, getRoomCode, createRoom, joinRoom, disconnect, push, onStatus };
})();
