# Halloween Imposter - Project Guide

## Project Overview

A sleek, multi-device Halloween-themed party game built with Node.js + Socket.io. Players hunt for the imposter using voting, with scoring only awarded for correct identifications.

## Architecture

### Backend (server.js)
- **Express** - HTTP server, serves static files
- **Socket.io** - Real-time WebSocket communication between devices
- **Game State** - In-memory store of active games

#### Key Data Structures
```javascript
Game {
  code: string,              // 6-char code for joining
  host: socketId,            // Socket ID of host
  players: Player[],         // Array of connected players
  gameState: 'lobby'|'playing'|'ended',
  round: number,             // Current round (1-indexed)
  maxRounds: number,         // Rounds to play (default 3)
  imposter: playerCode,      // Code of current imposter
  suspicions: {              // playerCode -> suspicionCode
    'ABC1': 'XYZ2',          // Player ABC1 suspects XYZ2
    ...
  },
  scores: {                  // playerCode -> points
    'ABC1': 2,
    ...
  }
}

Player {
  id: socketId,
  code: string,              // Unique player code shown to player
  name: string,
  team: string,              // Team/group name
  isImposter: boolean,
  suspectedBy: []            // List of player codes who suspect them
}
```

#### Socket Events (Backend)

**Emitted by Server:**
- `players-updated` - When player joins/leaves
- `game-started` - Game begins, round starts
- `update-voting-options` - Available players to vote for
- `suspicion-update` - Vote status progress (for host)
- `all-voted` - All players have cast suspicion
- `imposter-revealed` - Imposter revealed, scores updated
- `next-round` - New round starting
- `game-ended` - All rounds complete, show leaderboard
- `host-disconnected` - Host left, game ends

**Received by Server:**
- `host-create-game` - Host starts a new game
- `player-join-game` - Player joins with code
- `start-game` - Host begins gameplay
- `get-voting-options` - Player requests voting buttons
- `cast-suspicion` - Player votes
- `reveal-imposter` - Host reveals the imposter
- `disconnect` - Player/host disconnected

### Frontend (public/)

#### index.html - UI Screens
- **Start Screen** - HOST GAME / JOIN GAME buttons
- **Host Screen** - 
  - Lobby: Shows game code, connected players, start button
  - Playing: Displays voting progress, reveal button
  - Leaderboard: Final scores
- **Player Screen** -
  - Join: Enter code, name, team
  - Lobby: Waiting for game start
  - Playing: Vote on who is imposter
  - Reveal: See if you scored
  - Ended: Final leaderboard

#### client.js - Client Logic
- Socket.io event handlers
- UI state management
- Vote tracking
- Screen transitions

#### styles.css - Design
- Halloween theme (orange, purple, dark background)
- Responsive grid layouts
- Animations (bounce, pulse)
- Mobile-friendly

## Game Flow

```
1. Host creates game → generates 6-char code
2. Players join using code
3. Host starts game once 4 players have joined (the game is tuned for a 4-player + 1-host lineup)
4. Random imposter selected each round
5. Players vote on who is imposter
6. Host reveals after all votes in
7. Points awarded to correct guessers
8. Repeat steps 4-7 for each round
9. After max rounds, show final leaderboard
```

## Key Logic: Scoring System

**When imposter is revealed:**
```javascript
const correctSuspicions = game.suspicions entries where suspicionCode === game.imposter
correctSuspicions.forEach(playerCode => score[playerCode]++)
```

**Only 1 point awarded per player per round** if they voted correctly. No points if:
- They voted for wrong person
- They didn't vote
- They were the imposter

**Leaderboard** only shown at end of game (not after each round).

## Customization Guide

### Change Number of Rounds
**File:** `server.js` line ~18
```javascript
maxRounds: 5  // Change from 3 to desired number
```

### Change Game Code Length
**File:** `server.js` line ~35
```javascript
// Current: 6 chars
Math.random().toString(36).substring(2, 8)
// For 8 chars: substring(2, 10)
// For 4 chars: substring(2, 6)
```

### Change Minimum Players
The minimum is enforced in two places — both must match:
**File:** `server.js` (`start-game` handler)
```javascript
if (game.players.length < 4) return; // Change from 4
```
**File:** `public/client.js` (`players-updated` handler)
```javascript
const needed = Math.max(0, 4 - data.playerCount); // Change from 4
```
Player/voting grid layouts in `public/styles.css` (`.players-grid`, `.voting-grid`, `.voting-container`) are tuned for a 4-player game — revisit those if you change this.

### Customize Halloween Theme
**File:** `public/styles.css` `:root` section
```css
--orange-primary: #ff7f2d;      /* Main orange */
--purple-accent: #7c3aed;       /* Accent purple */
--bg-dark: #0f0a1a;             /* Background */
--text-light: #ffffff;          /* Text */
```

### Add Different Themes
Create new CSS theme and swap colors, e.g. `styles-christmas.css`:
```css
--orange-primary: #00d084;      /* Green */
--purple-accent: #c41e3a;       /* Red */
```

Then load in HTML: `<link rel="stylesheet" href="styles-christmas.css">`

## Extension Ideas

### Add Roles/Abilities
- **Detective** - See one player's identity each round
- **Doctor** - Protect one player from being voted out once
- **Mafia** - Imposter's accomplice gets same info

Implementation: Add `role` to Player object, emit role to player at game start.

### Add Discussion Timer
- Start game, show 2-minute discussion timer on all screens
- Lock voting after timer ends
- Show countdown during discussion phase

### Persistent Stats
- Store game results in database
- Show player stats page (win %, games played, etc.)
- Leaderboard across multiple games

### Sound & Animations
- Play sound when imposter is revealed
- Animate vote counters as they come in
- Pumpkin spinning on voting

### Chat/Communication
- In-game chat during discussion phase
- Disable chat after voting starts
- Show message history during reveal

### QR Code Joining
- Generate QR code with game code baked in
- Players scan with phone camera, auto-joins
- Use `qrcode.js` library

### Spectator Mode
- Allow observers who see everything but don't vote
- Useful for teaching new players

## Testing

### Manual Testing
1. Open host on desktop: http://localhost:3000
2. Click "HOST GAME"
3. Open 4 player joins on phone/tablet with same code
4. Host starts game
5. Players vote
6. Host reveals imposter
7. Verify correct voters get points
8. Play multiple rounds
9. Check final leaderboard

### Test Cases
- ✅ Join with valid code
- ✅ Join with invalid code (error message)
- ✅ Start game with <4 players (disabled)
- ✅ All players vote correctly → all score
- ✅ No one votes correctly → no one scores
- ✅ Host disconnects → all players see error
- ✅ Player disconnects → removed from game
- ✅ Multiple games running simultaneously
- ✅ Mobile viewport responsiveness

## Deployment

### Local Network
- All devices on same WiFi
- Host at: `<host-ip>:3000`
- Get IP: `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows)

### Cloud Deployment
- Deploy to Heroku, Railway, Render, Vercel
- Update Socket.io CORS to allow external origins
- Example (server.js):
```javascript
const io = socketIo(server, {
  cors: { 
    origin: "https://yourapp.com",
    methods: ["GET", "POST"]
  }
});
```

### Environment Variables
- `PORT` - Server port (default 3000)
- `NODE_ENV` - 'production' or 'development'

## Known Limitations

1. **In-Memory Storage** - Games lost on server restart
2. **No Persistence** - Stats not saved between sessions
3. **No Anti-Cheat** - Host/players could manipulate results
4. **Single Server** - Doesn't scale to multiple servers
5. **No Reconnection** - Disconnected players can't rejoin
6. **No Spectators** - Everyone must actively play

## Performance Notes

- Handles ~50 concurrent games easily on single server
- Each game uses minimal memory (game data + socket connections)
- Socket.io broadcasts optimized per-game room
- No database queries = instant response

## Security Considerations

- Game codes are random and hard to guess
- No sensitive data transmitted
- WebSocket connections auto-close on disconnect
- Consider adding: rate limiting, CORS config, input validation

---

**Last Updated:** Sept 2026
**Version:** 1.0
