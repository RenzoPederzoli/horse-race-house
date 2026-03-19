# Horse Race House Tracker

A simple web app to run Horse Race at the table while using a real deck of cards.
It tracks players, bets, chip balances, house bankroll, top-ups, and end-of-game settlement.

## What This App Does

- Manage **3-4 players**
- Track each player's **chips** and **bought chips**
- Build the **7-card course** and derive odds from suit counts
- Enter only the **winning suit** each race (no per-card race input)
- Run single or multiple races with an optional **race limit**
- Automatically settle when race limit is reached
- Manually settle at any time with **End & Settle house debt**

## Rules Model Used In This App

- Course uses 7 suit inputs.
- If any suit appears 5+ times in the course, you must reshuffle/redeal the course.
- Odds are based on course suit count:
  - 0 -> `1-1`
  - 1 -> `2-1`
  - 2 -> `3-1`
  - 3 -> `5-1`
  - 4 -> `10-1`
- Payout model: **stake returned + profit** (`stake + stake * oddsMultiplier`).
- You choose race winner by suit; app computes payout from bets and course odds.

## Setup

In setup phase:

1. Add/remove players (3-4 total)
2. Set:
   - `Starting chips`
   - `House bankroll`
   - `Chips per $1` (money conversion)
   - `Races to play` (`0` = unlimited)
3. Click **Start New Race**

## How To Play (App Flow)

### 1) Course Phase

- Enter 7 course cards by suit.
- If a suit hits 5+, click **Reshuffle Course** and redeal.
- Click **Confirm Course & Set Odds**.

### 2) Betting Phase

- Players are shown in a **randomized order** each race.
- Enter bet amounts per player and suit.
- Bets cannot exceed player's available chips.
- Click **Confirm Bets**.

### 3) Race Phase

- Select the winning suit.
- Review locked bet preview.
- Click **Confirm Outcome**.

### 4) Payout Phase

- See winner, chip deltas, updated balances, and track finish state.
- Bet preview is shown again for clarity.
- Click **New Race** to continue (unless game auto-settles due to race limit).

### 5) Settlement

Settlement happens when:

- You click **End & Settle house debt**, or
- Configured race count is reached.

Settlement behavior:

- If house bankroll is **negative**, players pay back evenly.
- If house bankroll is **positive**, profit is split evenly among players.
- House bankroll resets to `0` after settlement.

## Top Ups and Money Tracking

- Use the Top up panel to add chips to a player.
- Each top-up increases:
  - current `chips`
  - tracked `bought chips`
- Money conversion is based on `Chips per $1`.

## Local Development

```bash
cd "/Users/renzopederzoli/Documents/WebApps/HorseRace/horse-race-house"
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

## Build & Test

```bash
npm run build
npm test
```

