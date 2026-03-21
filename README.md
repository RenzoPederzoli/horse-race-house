# Horse Race House

A web app for running the **Horse Race** card game. One person hosts the game on a laptop or TV screen, and players join from their phones to place bets. The app handles the deck, odds, betting, race animation, and chip tracking — so you can focus on the fun.

## How It Works

Four suits race across the board: **Spades, Clubs, Hearts, Diamonds**. Each suit is represented by its Ace. Before the race, 7 cards are dealt face-up as the "course" — the more a suit appears in the course, the worse its odds (it has fewer cards left in the deck to advance). Players bet on which suit will reach position 8 first. Cards are then drawn one at a time; each card advances its suit one space. First suit to 8 wins.

### Odds Table

| Cards in course | Odds  |
|-----------------|-------|
| 0               | 1-1   |
| 1               | 2-1   |
| 2               | 3-1   |
| 3               | 5-1   |
| 4               | 10-1  |

If a suit appears 5+ times in the course, the course must be reshuffled.

Payouts are **stake + profit** (e.g. 10 chips on a 3-1 horse pays back 10 + 30 = 40 chips).

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Vite frontend (port 5173) and the WebSocket server (port 3001). Open `http://localhost:5173` on the host device.

### Players Join via QR Code

A QR code is shown on the host screen during setup. Players scan it with their phone to join — no app install needed. Each player gets assigned a slot and can place bets directly from their device.

## Playing a Game

### 1. Setup

- Add 3-4 players (or let them join via QR)
- Set starting chips, house bankroll, chips-per-dollar conversion, and optional race limit
- **Automated mode** (checkbox): the computer shuffles, deals the course, and runs the race with card-by-card animation and sound. Leave it unchecked to enter cards manually from a real deck.
- Click **Start New Race**

### 2. Course

- **Manual**: tap suit buttons to enter 7 course cards from your physical deck
- **Automated**: the computer deals 7 cards automatically and shows them on the board

### 3. Betting

- Players place bets from their phones (or the host enters them)
- Bet amounts are per-suit; total bets can't exceed a player's chips
- Betting order is randomized each race
- Click **Confirm Bets** to lock in

### 4. Race

- **Manual**: pick the winning suit based on your physical card draw
- **Automated**: cards are drawn one-by-one with animation and sound. Each card appears on its suit's lane, advancing toward the finish line. A "Skip Animation" button is available if you don't want to wait.

### 5. Payout

- Winner, odds, and chip deltas are shown
- The race board shows the final state of all lanes
- Click **New Race** to continue, or **Full Reset** to start over

### 6. Settlement

Happens automatically when the race limit is reached, or manually via **End & Settle house debt**:

- Positive house bankroll → profit split evenly to players
- Negative house bankroll → players pay back evenly
- House resets to 0

## Top-Ups

Need more chips mid-game? Use the **Top up** panel on the host screen. Each top-up adds to both current chips and tracked "bought chips" so the final money accounting stays accurate.

## Dev Commands

```bash
npm run dev      # Start frontend + server
npm run build    # Production build
npm test         # Run tests
```
