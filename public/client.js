const socket = io();

let currentRole = null;
let gameCode = null;
let playerCode = null;
let teamName = null;
let myVote = null;
let allPlayers = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function backToStart() {
  showScreen('start-screen');
  currentRole = null;
  gameCode = null;
  playerCode = null;
}

// ---------- Ambient particle background ----------
const PARTICLE_EMOJI = ['🦇', '👻', '🕸️', '🎃', '🕷️'];

function spawnParticle() {
  const container = document.getElementById('particles');
  if (!container) return;
  const span = el('span', 'particle', PARTICLE_EMOJI[Math.floor(Math.random() * PARTICLE_EMOJI.length)]);
  const startX = Math.random() * 100;
  const driftX = (Math.random() * 160 - 80).toFixed(0) + 'px';
  const duration = 10 + Math.random() * 10;
  const size = 1.2 + Math.random() * 1.6;
  span.style.left = startX + 'vw';
  span.style.fontSize = size + 'rem';
  span.style.setProperty('--drift-x', driftX);
  span.style.animationDuration = duration + 's';
  container.appendChild(span);
  setTimeout(() => span.remove(), duration * 1000 + 500);
}

for (let i = 0; i < 6; i++) {
  setTimeout(spawnParticle, i * 1200);
}
setInterval(spawnParticle, 2600);

// ---------- Sound effects (Web Audio, no external assets) ----------
let audioCtx = null;
let muted = localStorage.getItem('imposter-muted') === 'true';

function updateMuteButton() {
  const btn = document.getElementById('btn-mute');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}

function playTone(freq, duration, type, gainValue) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainValue || 0.08;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    // Web Audio unavailable — fail silently
  }
}

function sfxVote() { playTone(520, 0.12, 'triangle', 0.06); }
function sfxJoin() { playTone(660, 0.15, 'sine', 0.06); }
function sfxReveal() { playTone(140, 0.6, 'sawtooth', 0.07); }
function sfxCorrect() {
  playTone(660, 0.15, 'sine', 0.08);
  setTimeout(() => playTone(880, 0.2, 'sine', 0.08), 130);
}

document.getElementById('btn-mute').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('imposter-muted', String(muted));
  updateMuteButton();
});
updateMuteButton();

// ---------- Confetti burst ----------
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff7f2d', '#ffaa4d', '#8b5cf6', '#22d38a', '#ffd700'];
  const pieces = Array.from({ length: 90 }, () => ({
    x: canvas.width / 2 + (Math.random() * 200 - 100),
    y: canvas.height / 2,
    vx: Math.random() * 8 - 4,
    vy: Math.random() * -8 - 3,
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    spin: Math.random() * 10 - 5
  }));

  let frame = 0;
  const maxFrames = 110;

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(step);
}

// ---------- Leaderboard / winner banner rendering ----------
function renderLeaderboard(container, leaderboard) {
  container.innerHTML = '';
  leaderboard.forEach((entry, index) => {
    const rank = index + 1;
    const item = el('div', `leaderboard-item${rank === 1 ? ' rank-1' : ''}`);
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    item.appendChild(el('span', 'rank', medal));
    item.appendChild(el('span', 'info', entry.team || entry.name));
    item.appendChild(el('span', 'score', String(entry.score)));
    item.style.animationDelay = `${index * 0.08}s`;
    container.appendChild(item);
  });
}

function renderWinnerBanner(container, leaderboard) {
  container.innerHTML = '';
  if (!leaderboard || leaderboard.length === 0) return;

  const topScore = leaderboard[0].score;
  const winners = leaderboard.filter(e => e.score === topScore).map(e => e.team || e.name);

  const banner = el('div');
  if (topScore === 0) {
    banner.className = 'winner-title tie';
    banner.textContent = "🎃 No one unmasked the imposter — everyone's still in costume!";
  } else if (winners.length === 1) {
    banner.className = 'winner-title';
    banner.textContent = `🏆 ${winners[0]} WINS!`;
  } else {
    banner.className = 'winner-title tie';
    banner.textContent = `🤝 ${winners.join(' & ')} TIE FOR THE WIN!`;
  }
  container.appendChild(banner);
}

// ---------- Start screen ----------
document.getElementById('btn-host').addEventListener('click', () => {
  currentRole = 'host';
  socket.emit('host-create-game', (data) => {
    gameCode = data.code;
    document.getElementById('game-code-display').textContent = gameCode;
    document.getElementById('btn-start-game').disabled = true;
    showScreen('host-screen');
  });
});

document.getElementById('btn-player').addEventListener('click', () => {
  currentRole = 'player';
  showScreen('player-screen');
});

// Copy game code
function copyCode() {
  navigator.clipboard.writeText(gameCode);
  const btn = document.querySelector('[onclick="copyCode()"]');
  const original = btn.textContent;
  btn.textContent = 'COPIED!';
  setTimeout(() => btn.textContent = original, 2000);
}

// ---------- Player join ----------
document.getElementById('btn-join').addEventListener('click', () => {
  const gameCodeInput = document.getElementById('game-code-input').value.toUpperCase().trim();
  const teamNameInput = document.getElementById('team-name-input').value.trim();

  if (!gameCodeInput || !teamNameInput) {
    document.getElementById('join-error').textContent = 'Please enter game code and house color';
    return;
  }

  socket.emit('player-join-game', {
    gameCode: gameCodeInput,
    teamName: teamNameInput
  }, (response) => {
    if (response.success) {
      playerCode = response.playerCode;
      teamName = teamNameInput;
      gameCode = response.gameCode;

      document.getElementById('player-join').classList.add('hidden');
      document.getElementById('player-lobby').classList.remove('hidden');
      document.getElementById('your-name-display').textContent = `Welcome, ${teamName}!`;
      document.getElementById('your-team-display').textContent = '';
      document.getElementById('join-error').textContent = '';
      myVote = null;
      sfxJoin();
    } else {
      document.getElementById('join-error').textContent = response.error || 'Failed to join game';
    }
  });
});

// ---------- Host: lobby roster ----------
socket.on('players-updated', (data) => {
  allPlayers = data.players;
  document.getElementById('players-count-display').textContent = `Players: ${data.playerCount}`;

  if (currentRole !== 'host') return;

  const container = document.getElementById('players-container');
  container.innerHTML = '';

  if (data.players.length === 0) {
    container.appendChild(el('p', 'placeholder', 'Waiting for players to join...'));
  } else {
    data.players.forEach(player => {
      const tag = el('div', 'player-tag');
      tag.appendChild(el('div', null, player.team));
      container.appendChild(tag);
    });
  }

  document.getElementById('player-count').textContent = data.playerCount;

  const needed = Math.max(0, 4 - data.playerCount);
  document.getElementById('btn-start-game').disabled = needed > 0;
  document.getElementById('players-needed-text').textContent =
    needed > 0 ? `Need ${needed} more player${needed === 1 ? '' : 's'} to begin` : 'Ready to summon the game!';
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('start-game', { gameCode });
  document.getElementById('host-lobby').classList.add('hidden');
  document.getElementById('host-playing').classList.remove('hidden');
});

// ---------- Round start (personalized: word or imposter card) ----------
socket.on('round-started', (data) => {
  if (currentRole !== 'player') return;

  document.getElementById('player-lobby').classList.add('hidden');
  document.getElementById('player-reveal').classList.add('hidden');
  document.getElementById('player-playing').classList.remove('hidden');
  document.getElementById('player-round').textContent = data.round;

  document.getElementById('word-card-innocent').classList.toggle('hidden', data.isImposter);
  document.getElementById('word-card-imposter').classList.toggle('hidden', !data.isImposter);
  if (!data.isImposter) {
    document.getElementById('player-current-word').textContent = data.word;
  }

  myVote = null;
  document.getElementById('vote-status').textContent = '';

  const votingContainer = document.getElementById('voting-options');
  votingContainer.innerHTML = '';
  const others = allPlayers.filter(p => p.code !== playerCode);

  if (others.length === 0) {
    votingContainer.appendChild(el('p', 'placeholder', 'Waiting for players...'));
  } else {
    others.forEach(option => {
      const btn = el('button', 'vote-button');
      btn.appendChild(el('div', null, option.team));
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vote-button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        myVote = option.code;
        socket.emit('cast-suspicion', { gameCode, suspicionCode: option.code });
        document.getElementById('vote-status').textContent = `✓ You suspect ${option.team}`;
        sfxVote();
      });
      votingContainer.appendChild(btn);
    });
  }
});

// ---------- Host: round start (word for reference, reset UI) ----------
socket.on('host-round-started', (data) => {
  document.getElementById('host-current-word').textContent = data.word;
  document.getElementById('current-round').textContent = data.round;
  document.getElementById('suspicions-list').innerHTML = '';
  document.getElementById('btn-reveal').disabled = false;
});

// ---------- Host: live suspicion status (who suspects whom) ----------
socket.on('host-suspicion-status', (data) => {
  if (currentRole !== 'host') return;
  const list = document.getElementById('suspicions-list');
  list.innerHTML = '';
  data.suspicions.forEach(s => {
    const item = el('div', `suspicion-item${s.voted ? ' voted' : ''}`);
    item.appendChild(el('span', 'team-name', s.team));
    item.appendChild(el('span', `status${s.voted ? ' voted' : ''}`, s.voted ? `suspects ${s.suspectsTeam}` : 'Waiting...'));
    list.appendChild(item);
  });
});

// ---------- Host: live scores (host-only, never sent to players) ----------
socket.on('host-scores-update', (data) => {
  if (currentRole !== 'host') return;
  const container = document.getElementById('host-live-scores');
  if (data.scores.length === 0) {
    container.innerHTML = '';
    container.appendChild(el('p', 'placeholder', 'No points yet'));
  } else {
    renderLeaderboard(container, data.scores);
  }
});

// ---------- Reveal ----------
document.getElementById('btn-reveal').addEventListener('click', () => {
  socket.emit('reveal-imposter', { gameCode });
  document.getElementById('btn-reveal').disabled = true;
});

socket.on('imposter-revealed', (data) => {
  if (currentRole !== 'player') return;
  sfxReveal();

  document.getElementById('player-playing').classList.add('hidden');
  document.getElementById('player-reveal').classList.remove('hidden');

  document.getElementById('reveal-text').textContent =
    `${data.imposterTeam} was the imposter! The word was ${data.word}.`;

  const youGotIt = document.getElementById('you-got-it');
  if (data.youScored) {
    youGotIt.classList.remove('hidden');
    sfxCorrect();
    fireConfetti();
  } else {
    youGotIt.classList.add('hidden');
  }

  document.getElementById('next-round-text').textContent = 'Preparing next round...';
});

socket.on('host-imposter-revealed', (data) => {
  if (currentRole !== 'host') return;
  sfxReveal();

  const suspicionsList = document.getElementById('suspicions-list');
  suspicionsList.innerHTML = '';

  const summary = el('div', 'reveal-summary');
  summary.appendChild(el('strong', null, `${data.imposterTeam} was the imposter!`));
  summary.appendChild(el('p', null, `The word was ${data.word}.`));
  const scoredText = data.scorers && data.scorers.length > 0
    ? `${data.scorers.join(', ')} scored!`
    : 'No one guessed correctly!';
  summary.appendChild(el('p', null, scoredText));
  suspicionsList.appendChild(summary);

  if (data.scorers && data.scorers.length > 0) fireConfetti();
});

// ---------- Game ended ----------
socket.on('game-ended', (data) => {
  if (currentRole === 'player') {
    document.getElementById('player-reveal').classList.add('hidden');
    document.getElementById('player-playing').classList.add('hidden');
    document.getElementById('player-ended').classList.remove('hidden');
    renderWinnerBanner(document.getElementById('player-winner-banner'), data.leaderboard);
    renderLeaderboard(document.getElementById('final-leaderboard'), data.leaderboard);
  } else {
    document.getElementById('host-playing').classList.add('hidden');
    document.getElementById('host-leaderboard').classList.remove('hidden');
    renderWinnerBanner(document.getElementById('host-winner-banner'), data.leaderboard);
    renderLeaderboard(document.getElementById('leaderboard-display'), data.leaderboard);
  }

  if (data.leaderboard && data.leaderboard.length > 0 && data.leaderboard[0].score > 0) {
    fireConfetti();
  }
});

socket.on('host-disconnected', () => {
  alert('Host disconnected. Game ended.');
  location.reload();
});

// Initialize — a dedicated launcher file (Host Game.html / Join Game.html) can jump
// straight past the start screen via #host or #join in the URL. Those dedicated
// links never expose a path to the other role, so their back buttons are hidden.
const entryMode = location.hash.replace('#', '');
if (entryMode === 'host') {
  document.getElementById('btn-host-back').classList.add('hidden');
  document.getElementById('btn-host').click();
} else if (entryMode === 'join') {
  document.getElementById('btn-player-back').classList.add('hidden');
  document.getElementById('btn-player').click();
} else {
  showScreen('start-screen');
}
