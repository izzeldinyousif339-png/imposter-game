# 🎃 Halloween Imposter

A sleek, multi-device Halloween-themed party game where players hunt for the imposter among their ranks. Built for 4 players plus one host device.

## Features

✨ **Sleek Halloween Theme** - Dark mode with orange and purple gradients, pumpkin branding

🎮 **Multi-Device Support** - Host on one device, players join via code on their own devices

🕷️ **Suspicion Voting** - Cast suspicion on who you think is the imposter

🏆 **Smart Scoring** - Only teams/players who correctly identify the imposter get points (voted before reveal)

📊 **Round-Based Gameplay** - Play multiple rounds with different imposters each time

🎯 **Final Leaderboard** - Complete game scores shown only at the end

## How to Play

### Setup

1. **Start the server:**
   ```bash
   npm install
   npm start
   ```
   Server runs on `http://localhost:3000`

2. **Open on Host Device** - Go to the website, click "HOST GAME"
   - Game code is automatically generated and displayed
   - Share this code with other players

3. **Players Join** - Each player on their own device:
   - Click "JOIN GAME"
   - Enter the game code
   - Enter their name and team (optional)
   - Click "JOIN"

### Gameplay

**Before Round Starts:**
- Host sees all players join
- Once 4 players have joined, click "START GAME"

**During Round:**
- Each player sees a list of other players
- Players vote: "Who is the imposter?"
- Host can see voting progress in real-time

**After Voting:**
- Host clicks "REVEAL IMPOSTER"
- Imposter is revealed along with who correctly suspected them
- **Points awarded ONLY to players/teams who voted for the correct imposter**
- Game automatically starts next round

**Game End:**
- After all rounds complete, final leaderboard is shown to all players
- Leaderboard ranks teams by total correct suspicions

## Game Mechanics

### Scoring
- Players only earn 1 point when:
  1. They cast suspicion on a player, AND
  2. That player is voted out as the imposter, AND
  3. That player is actually the imposter

- Teams/players who don't suspect the imposter get 0 points that round
- Ties are broken by order on leaderboard

### Example
```
Round 1:
- Team 1 suspects Team 2 ✓ Team 2 is imposter → Team 1 gets 1 point
- Team 2 suspects Team 3 ✗ Team 2 is imposter → Team 2 gets 0 points
- Team 3 suspects Team 1 ✗ Team 2 is imposter → Team 3 gets 0 points

Leaderboard: Team 1: 1 point, Team 2: 0, Team 3: 0
```

## File Structure

```
halloween-imposter/
├── server.js           # Express + Socket.io backend
├── public/
│   ├── index.html      # Main UI (host + player screens)
│   ├── client.js       # Client-side Socket.io logic
│   └── styles.css      # Halloween theme styling
└── package.json
```

## Technology Stack

- **Backend**: Node.js, Express, Socket.io (real-time multiplayer)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Communication**: WebSockets via Socket.io

## Customization

### Change Game Length
In `server.js`, line ~20:
```javascript
maxRounds: 3  // Change to desired number of rounds
```

### Customize Theme
In `public/styles.css`, modify the `:root` CSS variables:
```css
--orange-primary: #ff7f2d;    /* Halloween orange */
--purple-accent: #7c3aed;     /* Dark purple */
--text-light: #ffffff;         /* Text color */
```

### Game Code Length
In `server.js`, line ~35:
```javascript
Math.random().toString(36).substring(2, 8)  // Change 8 for longer/shorter codes
```

## Tips for Best Experience

1. **Optimal Player Count**: Built and balanced for exactly 4 players + 1 host device
2. **Time per Round**: Allow 1-2 minutes for discussion before voting
3. **Mobile Friendly**: Works great on phones and tablets
4. **Network**: All devices need to be on same network/internet connection
5. **Team Names**: Makes it more fun to have actual team names!

## Troubleshooting

**Players can't join?**
- Verify game code is correct (uppercase)
- Check all devices are on same network
- Refresh the join page and try again

**Votes not registering?**
- Make sure all players clicked their vote
- Host can see voting status on screen
- Wait for "All players have voted!" message

**Connection issues?**
- Restart server: `npm start`
- Have players refresh and rejoin
- Check that port 3000 isn't in use

## Future Ideas

- Roles/abilities (detective, doctor, etc.)
- Custom game modes
- Player chat/discussion timer
- Sound effects and animations
- Persistent stats/history
- QR code for easy joining

Enjoy finding the imposter! 🎃
