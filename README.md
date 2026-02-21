# daily-challenge.js

**Serverless daily challenges for web games.**

Seed-based determinism + clipboard score sharing + localStorage streak tracking — with zero backend, zero database, zero login.

Extracted from [Spell Cascade](https://yurukusa.itch.io/spell-cascade), where this pattern powers the daily leaderboard.

---

## Why

Leaderboards need servers. Servers need money. For early-stage indie games, that's the wrong trade-off.

This library gives you:

| Feature | How |
|---------|-----|
| Same run for all players | Date → seed → deterministic RNG |
| Score sharing | Clipboard API with customizable format |
| Social layer | Links to your itch.io comment section |
| Daily habit | localStorage streak (no backend, no login) |
| Grace window | Yesterday's challenge access |

Players share scores in comments. Comments become the leaderboard. Free forever.

---

## Install

Drop a single script tag:

```html
<script src="daily-challenge.js"></script>
```

Or with npm (ESM):

```bash
npm install daily-challenge.js
```

```js
import DailyChallenge from 'daily-challenge.js';
```

---

## Quick Start

```js
// 1. Seed your RNG with today's date (same seed = same run for all players)
var seed = DailyChallenge.getSeed();
myRNG.seed(seed);  // use with seedrandom, Alea, or any seeded RNG

// 2. On game over: record streak + build score text
var result = DailyChallenge.recordCompletion('mygame');  // 'mygame' = your storage prefix

var scoreText = DailyChallenge.buildScoreText({
  gameName: 'My Game',
  dateStr: '02/21',
  emoji: '⚔️',
  buildName: 'Fire Mage',    // optional
  stars: '★★☆',             // optional
  time: '5:23',              // optional
  streak: result.streak,
  url: 'https://mygame.itch.io'
});
// → "[My Game Daily 02/21] ⚔️ Fire Mage ★★☆ | 5:23 | 🔥3d\nhttps://mygame.itch.io"

// 3. Add copy + share buttons
var copyBtn = DailyChallenge.createCopyButton(scoreText);
var shareBtn = DailyChallenge.createShareButton(
  'https://mygame.itch.io#comments',
  '💬 Post to comments'
);
resultContainer.append(copyBtn, shareBtn);

// 4. Show streak on title screen
var info = DailyChallenge.getStreak('mygame');
var msg = DailyChallenge.getStreakMessage(info.streak, info.playedToday);
// → "🔥 4-day streak — play to continue"
titleScreen.querySelector('#streak').textContent = msg;
```

---

## API

### Seeds

#### `DailyChallenge.getSeed([date], [salt]) → number`

Returns a deterministic integer seed from a date.

```js
DailyChallenge.getSeed()                    // today
DailyChallenge.getSeed('2026-02-20')        // specific date (yesterday's challenge)
DailyChallenge.getSeed(new Date(), 99991)   // custom salt
```

#### `DailyChallenge.getSeeds([salt]) → { today, yesterday, todayStr, yesterdayStr }`

Returns both today's and yesterday's seeds with ISO date strings.

---

### Streaks

#### `DailyChallenge.getStreak([prefix]) → { streak, last, playedToday }`

Read current streak without modifying it. Safe to call any time.

```js
var info = DailyChallenge.getStreak('mygame');
// { streak: 4, last: '2026-02-20', playedToday: false }
```

#### `DailyChallenge.recordCompletion([prefix]) → { streak, isNew }`

Record that the player completed today's Daily Challenge. Idempotent (safe to call multiple times per day).

```js
var result = DailyChallenge.recordCompletion('mygame');
// { streak: 5, isNew: true }
```

#### `DailyChallenge.getStreakMessage(streak, playedToday) → string`

Returns a human-readable message.

```js
DailyChallenge.getStreakMessage(5, false)  // "🔥 5-day streak — play to continue"
DailyChallenge.getStreakMessage(5, true)   // "🔥 5-day streak — already played today ✓"
DailyChallenge.getStreakMessage(7, false)  // "🔥🏆 7-day streak — play to continue"
DailyChallenge.getStreakMessage(1, false)  // "🔥 First daily! Come back tomorrow to start a streak"
DailyChallenge.getStreakMessage(0, false)  // ""
```

---

### Score Sharing

#### `DailyChallenge.buildScoreText(options) → string`

Build a shareable score string.

```js
DailyChallenge.buildScoreText({
  gameName: 'My Game',    // required
  dateStr:  '02/21',      // required — use "Past 02/20" for yesterday's challenge
  emoji:    '💀',         // optional
  buildName: 'Ice Archer', // optional
  stars:    '★★★',       // optional
  time:     '3:45',       // optional
  score:    1240,         // optional — raw score
  streak:   5,            // optional — shown if >= 2
  url:      'https://…'  // optional — appended on second line
});
```

#### `DailyChallenge.copyScore(text) → Promise<boolean>`

Copy text to clipboard. Falls back to `execCommand` if Clipboard API unavailable.

#### `DailyChallenge.createCopyButton(scoreText, [opts]) → HTMLButtonElement`

Ready-to-use copy button with "✓ Copied!" feedback.

```js
DailyChallenge.createCopyButton(text, {
  label: '📋 Copy Score',
  copiedLabel: '✓ Copied!',
  resetMs: 1500
});
```

#### `DailyChallenge.createShareButton(url, [label]) → HTMLButtonElement`

Button that opens URL in new tab.

---

## Integration Examples

### Vanilla JS / HTML5 game

```html
<script src="daily-challenge.js"></script>
<script>
var dc = DailyChallenge;
var seeds = dc.getSeeds();

// Title screen
var info = dc.getStreak('mygame');
document.getElementById('streak').textContent = dc.getStreakMessage(info.streak, info.playedToday);

// If player clicks "Yesterday's Challenge"
var yesterday = seeds.yesterday;  // seed for yesterday's run

// Game over screen
function onGameOver(stats) {
  var result = dc.recordCompletion('mygame');
  var dateStr = stats.isYesterday ? 'Past ' + seeds.yesterdayStr.slice(5) : seeds.todayStr.slice(5);
  dateStr = dateStr.replace('-', '/');

  var text = dc.buildScoreText({
    gameName: 'My Game',
    dateStr: dateStr,
    emoji: stats.win ? '🗡️' : '💀',
    buildName: stats.build,
    stars: stats.stars,
    time: stats.time,
    streak: result.streak,
    url: 'https://mygame.itch.io'
  });

  var copyBtn = dc.createCopyButton(text);
  var shareBtn = dc.createShareButton('https://mygame.itch.io#comments');
  document.getElementById('result-buttons').append(copyBtn, shareBtn);
}
</script>
```

### Godot 4 (GDScript + JavaScriptBridge)

```gdscript
# Get today's seed
var seed_val: int = JavaScriptBridge.eval("""
  (function() {
    var d = new Date();
    var base = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
    return base * 31337;
  })()
""")
seed(seed_val)

# Record completion + get streak
var result = JavaScriptBridge.eval("""
  DailyChallenge.recordCompletion('mygame')
""")
var streak: int = int(result.streak)
```

---

## Demo

Open `demo/index.html` in your browser to see all features live.

---

## Real-World Usage

- [Spell Cascade](https://yurukusa.itch.io/spell-cascade) — the game this library was extracted from
- Daily Challenge + Yesterday's Challenge + streak counter + itch.io comment leaderboard

---

## License

MIT
