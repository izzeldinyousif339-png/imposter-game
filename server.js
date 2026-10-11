const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));

const games = new Map();

const WORDS = [
  'Pumpkin', 'Vampire', 'Werewolf', 'Skeleton', 'Witch', 'Ghost', 'Zombie',
  'Candy Corn', 'Jack-o-Lantern', 'Haunted House', 'Black Cat', 'Broomstick',
  'Cauldron', 'Spider Web', 'Full Moon', 'Graveyard', 'Mummy', 'Trick-or-Treat',
  'Costume', 'Cobweb', 'Bat', 'Scarecrow', 'Frankenstein', 'Coffin', 'Potion',
  'Spell Book', 'Candle', 'Fog Machine', 'Gravestone', 'Sugar Skull'
];

function pickWord(avoid) {
  const options = WORDS.filter(w => w !== avoid);
  return options[Math.floor(Math.random() * options.length)];
}

function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function pickImposter(game) {
  return game.players[Math.floor(Math.random() * game.players.length)];
}

function createGame(hostSocketId) {
  const gameCode = generateGameCode();
  const game = {
    code: gameCode,
    host: hostSocketId,
    players: [],
    gameState: 'lobby',
    round: 0,
    maxRounds: 1,
    imposter: null,
    currentWord: null,
    suspicions: {},
    scores: {},
    votingTime: false,
    finalVotes: {},
    voteOrderCounter: 0
  };
  games.set(gameCode, game);
  return game;
}

function startRound(io, game, gameCode) {
  const imposter = pickImposter(game);
  game.players.forEach(p => { p.isImposter = false; });
  imposter.isImposter = true;
  game.imposter = imposter.code;
  game.currentWord = pickWord(game.currentWord);
  game.suspicions = {};
  game.votingTime = false;
  game.finalVotes = {};
  game.voteOrderCounter = 0;
  game.players.forEach(p => { game.suspicions[p.code] = null; });

  game.players.forEach(p => {
    io.to(p.id).emit('round-started', {
      round: game.round,
      maxRounds: game.maxRounds,
      isImposter: p.code === game.imposter,
      word: p.code === game.imposter ? null : game.currentWord
    });
  });

  // Host gets the word for reference, plus a fresh (empty) suspicion/score view.
  io.to(game.host).emit('host-round-started', {
    round: game.round,
    maxRounds: game.maxRounds,
    word: game.currentWord
  });
  sendHostSuspicionStatus(io, game);
}

function sendHostSuspicionStatus(io, game) {
  const status = game.players.map(p => {
    const targetCode = game.suspicions[p.code];
    const target = targetCode ? game.players.find(pl => pl.code === targetCode) : null;
    const lockedVote = game.finalVotes[p.code];
    const lockedTarget = lockedVote ? game.players.find(pl => pl.code === lockedVote.target) : null;
    return {
      name: p.name,
      team: p.team,
      voted: !!targetCode,
      suspectsName: target ? target.name : null,
      suspectsTeam: target ? target.team : null,
      lockedIn: !!lockedVote,
      lockedTeam: lockedTarget ? lockedTarget.team : null
    };
  });
  io.to(game.host).emit('host-suspicion-status', { suspicions: status });
}

function sendHostScores(io, game) {
  const scores = Object.entries(game.scores).map(([code, s]) => ({
    name: s.name, team: s.team, score: s.score
  })).sort((a, b) => b.score - a.score);
  io.to(game.host).emit('host-scores-update', { scores });
}

io.on('connection', (socket) => {
  socket.on('host-create-game', (callback) => {
    const game = createGame(socket.id);
    socket.join(`game-${game.code}`);
    callback({ code: game.code });
  });

  socket.on('player-join-game', (data, callback) => {
    const game = games.get((data.gameCode || '').toUpperCase());
    if (!game) {
      callback({ success: false, error: 'Game not found' });
      return;
    }
    if (game.gameState !== 'lobby') {
      callback({ success: false, error: 'This game has already started' });
      return;
    }

    const playerCode = generatePlayerCode();
    const teamName = (data.teamName || '').trim() || `Team ${game.players.length + 1}`;
    const player = {
      id: socket.id,
      code: playerCode,
      name: teamName,
      team: teamName,
      isImposter: false
    };

    game.players.push(player);
    game.scores[playerCode] = { name: player.name, team: player.team, score: 0 };
    game.suspicions[playerCode] = null;

    socket.join(`game-${game.code}`);
    io.to(`game-${game.code}`).emit('players-updated', {
      players: game.players.map(p => ({ code: p.code, name: p.name, team: p.team })),
      playerCount: game.players.length
    });

    callback({ success: true, playerCode, gameCode: game.code });
  });

  socket.on('start-game', (data) => {
    const game = games.get(data.gameCode);
    if (!game || game.host !== socket.id) return;
    if (game.players.length < 4) return;

    game.gameState = 'playing';
    game.round = 1;
    startRound(io, game, game.code);
  });

  socket.on('cast-suspicion', (data) => {
    const game = games.get(data.gameCode);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    if (game.finalVotes[player.code]) return; // locked in — no more changes

    game.suspicions[player.code] = data.suspicionCode;
    sendHostSuspicionStatus(io, game);
  });

  socket.on('start-voting-time', (data) => {
    const game = games.get(data.gameCode);
    if (!game || game.host !== socket.id) return;
    if (game.votingTime) return;

    game.votingTime = true;
    io.to(`game-${game.code}`).emit('voting-time-started');
  });

  socket.on('lock-in-vote', (data) => {
    const game = games.get(data.gameCode);
    if (!game || !game.votingTime) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || game.finalVotes[player.code]) return;

    const target = game.suspicions[player.code];
    if (!target) return; // must have a suspicion selected to lock in

    game.voteOrderCounter += 1;
    game.finalVotes[player.code] = { target, order: game.voteOrderCounter };
    socket.emit('vote-locked');
    sendHostSuspicionStatus(io, game);
  });

  socket.on('reveal-imposter', (data) => {
    const game = games.get(data.gameCode);
    if (!game || game.host !== socket.id) return;

    const imposterData = game.players.find(p => p.code === game.imposter);

    // Only locked-in final votes count. Among everyone who locked in the
    // correct imposter, whoever did it FIRST (lowest order) is the sole scorer.
    const correctLockIns = Object.entries(game.finalVotes)
      .filter(([, v]) => v.target === game.imposter)
      .sort((a, b) => a[1].order - b[1].order);
    const winnerCode = correctLockIns.length > 0 ? correctLockIns[0][0] : null;

    // Nobody locked in the correct imposter — the imposter's own house scores instead.
    const imposterEscaped = !winnerCode;

    if (winnerCode && game.scores[winnerCode]) {
      game.scores[winnerCode].score += 1;
    }
    if (imposterEscaped && game.scores[game.imposter]) {
      game.scores[game.imposter].score += 1;
    }
    sendHostScores(io, game);

    const winnerPlayer = winnerCode ? game.players.find(pl => pl.code === winnerCode) : null;

    const revealPayload = {
      imposterName: imposterData.name,
      imposterTeam: imposterData.team,
      word: game.currentWord,
      imposterEscaped,
      winnerTeam: winnerPlayer ? winnerPlayer.team : null
    };

    game.players.forEach(p => {
      io.to(p.id).emit('imposter-revealed', {
        ...revealPayload,
        youScored: p.code === winnerCode || (imposterEscaped && p.code === game.imposter)
      });
    });
    io.to(game.host).emit('host-imposter-revealed', revealPayload);

    if (game.round < game.maxRounds) {
      setTimeout(() => {
        if (!games.has(game.code)) return;
        game.round += 1;
        startRound(io, game, game.code);
      }, 4000);
    } else {
      setTimeout(() => {
        if (!games.has(game.code)) return;
        game.gameState = 'ended';
        const leaderboard = Object.values(game.scores).sort((a, b) => b.score - a.score);
        io.to(`game-${game.code}`).emit('game-ended', { leaderboard });
      }, 4000);
    }
  });

  socket.on('play-again', (data) => {
    const game = games.get(data.gameCode);
    if (!game || game.host !== socket.id) return;

    // Send everyone who was in this game (host included) back to square one.
    io.to(`game-${game.code}`).emit('game-restarted');
    games.delete(game.code);

    const newGame = createGame(socket.id);
    socket.join(`game-${newGame.code}`);
    socket.emit('new-game-ready', { code: newGame.code });
  });

  socket.on('disconnect', () => {
    games.forEach((game, code) => {
      if (game.host === socket.id) {
        io.to(`game-${code}`).emit('host-disconnected');
        games.delete(code);
        return;
      }
      const before = game.players.length;
      game.players = game.players.filter(p => p.id !== socket.id);
      if (game.players.length !== before) {
        io.to(`game-${code}`).emit('players-updated', {
          players: game.players.map(p => ({ code: p.code, name: p.name, team: p.team })),
          playerCount: game.players.length
        });
        if (game.gameState === 'playing') sendHostSuspicionStatus(io, game);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎃 Imposter running on port ${PORT}`);
});
