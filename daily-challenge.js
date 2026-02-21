/**
 * daily-challenge.js — v1.0.0
 * Serverless daily challenges for web games.
 *
 * Features:
 * - Seed-based determinism: same date = same seed for all players
 * - Clipboard score sharing with customizable format
 * - localStorage streak tracking (no backend, no login)
 * - Yesterday's challenge access (24-hour grace window)
 *
 * MIT License — https://github.com/yurukusa/daily-challenge-js
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DailyChallenge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Seed ────────────────────────────────────────────────────────────────────

  /**
   * Get a deterministic seed from a date.
   * Same date → same seed → same experience for all players.
   *
   * @param {Date|string} [date] — defaults to today (local time)
   * @param {number} [salt=31337] — prime multiplier for seed distribution
   * @returns {number} integer seed
   */
  function getSeed(date, salt) {
    var d = date ? new Date(date) : new Date();
    var base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return base * (salt || 31337);
  }

  /**
   * Get today's seed and yesterday's seed.
   * @param {number} [salt=31337]
   * @returns {{ today: number, yesterday: number, todayStr: string, yesterdayStr: string }}
   */
  function getSeeds(salt) {
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      today: getSeed(today, salt),
      yesterday: getSeed(yesterday, salt),
      todayStr: _isoDate(today),
      yesterdayStr: _isoDate(yesterday)
    };
  }

  // ─── Streak ───────────────────────────────────────────────────────────────────

  var STORAGE_LAST = 'dc_daily_last';
  var STORAGE_STREAK = 'dc_daily_streak';

  /**
   * Read current streak info from localStorage.
   * @param {string} [prefix='dc'] — storage key prefix (use per-game prefix to avoid collisions)
   * @returns {{ streak: number, last: string, playedToday: boolean }}
   */
  function getStreak(prefix) {
    var lastKey = (prefix || 'dc') + '_daily_last';
    var streakKey = (prefix || 'dc') + '_daily_streak';
    try {
      var last = localStorage.getItem(lastKey) || '';
      var streak = parseInt(localStorage.getItem(streakKey) || '0', 10);
      var todayStr = _isoDate(new Date());
      return { streak: streak, last: last, playedToday: last === todayStr };
    } catch (e) {
      return { streak: 0, last: '', playedToday: false };
    }
  }

  /**
   * Record that the player completed today's Daily Challenge.
   * Increments streak if they played yesterday, resets otherwise.
   * Calling this multiple times on the same day is safe (idempotent).
   *
   * @param {string} [prefix='dc']
   * @returns {{ streak: number, isNew: boolean }} updated streak
   */
  function recordCompletion(prefix) {
    var lastKey = (prefix || 'dc') + '_daily_last';
    var streakKey = (prefix || 'dc') + '_daily_streak';
    try {
      var today = _isoDate(new Date());
      var last = localStorage.getItem(lastKey) || '';
      var streak = parseInt(localStorage.getItem(streakKey) || '0', 10);

      if (last === today) {
        return { streak: streak, isNew: false }; // already counted today
      }

      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yesterdayStr = _isoDate(yesterday);

      var newStreak = (last === yesterdayStr) ? streak + 1 : 1;
      localStorage.setItem(lastKey, today);
      localStorage.setItem(streakKey, String(newStreak));
      return { streak: newStreak, isNew: true };
    } catch (e) {
      return { streak: 1, isNew: true };
    }
  }

  /**
   * Get a human-readable streak message.
   * @param {number} streak
   * @param {boolean} playedToday
   * @returns {string}
   */
  function getStreakMessage(streak, playedToday) {
    if (streak <= 0) return '';
    var fire = streak >= 7 ? '🔥🏆' : '🔥';
    if (streak === 1 && !playedToday) return fire + ' First daily! Come back tomorrow to start a streak';
    if (playedToday) return fire + ' ' + streak + '-day streak — already played today ✓';
    return fire + ' ' + streak + '-day streak — play to continue';
  }

  // ─── Score Sharing ────────────────────────────────────────────────────────────

  /**
   * Copy a score string to the clipboard.
   * Falls back to prompt() if Clipboard API unavailable.
   *
   * @param {string} text
   * @returns {Promise<boolean>} true if copied successfully
   */
  function copyScore(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
        return _fallbackCopy(text);
      });
    }
    return Promise.resolve(_fallbackCopy(text));
  }

  /**
   * Build a shareable score string.
   *
   * @param {object} options
   * @param {string} options.gameName — e.g. "Spell Cascade"
   * @param {string} options.dateStr — e.g. "02/21" or "Past 02/20"
   * @param {string} [options.emoji='⚔️']
   * @param {string} [options.buildName]
   * @param {string} [options.stars] — e.g. "★★☆"
   * @param {string} [options.time] — e.g. "5:23"
   * @param {number} [options.score]
   * @param {number} [options.streak]
   * @param {string} [options.url]
   * @returns {string}
   */
  function buildScoreText(options) {
    var parts = ['[' + options.gameName + ' Daily ' + options.dateStr + ']'];
    if (options.emoji) parts.push(options.emoji);
    if (options.buildName) parts.push(options.buildName);
    if (options.stars) parts.push(options.stars);
    if (options.time) parts.push('| ' + options.time);
    if (options.score != null) parts.push('| ' + options.score + ' pts');
    if (options.streak && options.streak >= 2) parts.push('| 🔥' + options.streak + 'd');
    var line1 = parts.join(' ');
    return options.url ? line1 + '\n' + options.url : line1;
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────────

  /**
   * Create a "Copy Score" button that copies text and shows "✓ Copied!" feedback.
   *
   * @param {string} scoreText
   * @param {object} [opts]
   * @param {string} [opts.label='📋 Copy Score']
   * @param {string} [opts.copiedLabel='✓ Copied!']
   * @param {number} [opts.resetMs=1500]
   * @returns {HTMLButtonElement}
   */
  function createCopyButton(scoreText, opts) {
    opts = opts || {};
    var btn = document.createElement('button');
    btn.textContent = opts.label || '📋 Copy Score';
    btn.addEventListener('click', function () {
      copyScore(scoreText).then(function () {
        btn.textContent = opts.copiedLabel || '✓ Copied!';
        setTimeout(function () {
          btn.textContent = opts.label || '📋 Copy Score';
        }, opts.resetMs || 1500);
      });
    });
    return btn;
  }

  /**
   * Create a button that opens a URL in a new tab.
   *
   * @param {string} url
   * @param {string} [label='💬 Post to comments']
   * @returns {HTMLButtonElement}
   */
  function createShareButton(url, label) {
    var btn = document.createElement('button');
    btn.textContent = label || '💬 Post to comments';
    btn.addEventListener('click', function () {
      // noopener,noreferrer: prevent tabnapping (opened page cannot access window.opener)
      // URL scheme guard: only http/https allowed to prevent javascript: / data: injection
      if (!/^https?:\/\//i.test(url)) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    return btn;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────────

  function _isoDate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    getSeed: getSeed,
    getSeeds: getSeeds,
    getStreak: getStreak,
    recordCompletion: recordCompletion,
    getStreakMessage: getStreakMessage,
    copyScore: copyScore,
    buildScoreText: buildScoreText,
    createCopyButton: createCopyButton,
    createShareButton: createShareButton
  };
}));
