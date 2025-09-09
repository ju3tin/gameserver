const GameRound = require('../models/GameRound');
const User = require('../models/User');
const { generateCrashMultiplier } = require('../utils/gameUtils');

let currentMultiplier = 1.0;
let isRunning = false;
let gameState = 'waiting';
const GAME_INTERVAL = 50;

const broadcast = (wss, msg) => {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => c.readyState === 1 && c.send(data));
};

const startGame = async (wss) => {
  gameState = 'waiting';
  isRunning = false;
  currentMultiplier = 1.0;

  const gameRound = new GameRound({ startTime: new Date(), crashMultiplier: 0, bets: [] });
  await gameRound.save();

  broadcast(wss, { action: 'GAME_WAITING', message: 'Place your bets!' });

  let countdown = 10;
  const countdownInterval = setInterval(() => {
    countdown--;
    broadcast(wss, { action: 'SECOND_BEFORE_START', data: countdown });
    if (countdown <= 0) clearInterval(countdownInterval);
  }, 1000);

  setTimeout(async () => {
    gameState = 'running';
    isRunning = true;
    broadcast(wss, { action: 'ROUND_STARTED', message: 'Round started!' });

    const crashPoint = generateCrashMultiplier();
    gameRound.crashMultiplier = crashPoint;
    await gameRound.save();

    const interval = setInterval(async () => {
      currentMultiplier += 0.01;
      broadcast(wss, { action: 'CNT_MULTIPLY', multiplier: currentMultiplier.toFixed(2) });

      if (currentMultiplier >= crashPoint) {
        clearInterval(interval);
        isRunning = false;
        gameState = 'ended';
        await endGame(wss, gameRound._id);
      }
    }, GAME_INTERVAL);
  }, 10000);
};

const endGame = async (wss, gameRoundId) => {
  const round = await GameRound.findById(gameRoundId);
  round.crashMultiplier = currentMultiplier;
  await round.save();
  broadcast(wss, { action: 'ROUND_CRASHED', multiplier: currentMultiplier.toFixed(2) });
  setTimeout(() => startGame(wss), 5000);
};

const handleBet = async (ws, data) => {
  if (gameState !== 'waiting') return ws.send(JSON.stringify({ action: 'ERROR', message: 'Betting closed.' }));

  const { userId, amount, currency } = data;
  const user = await User.findById(userId);
  if (!user) return ws.send(JSON.stringify({ action: 'ERROR', message: 'User not found.' }));

  if (!['SOL', 'CHIPPY', 'DEMO'].includes(currency))
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'Invalid currency.' }));

  if (user.balances[currency] < amount)
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'Insufficient balance.' }));

  const round = await GameRound.findOne().sort({ startTime: -1 });
  if (round.bets.find(b => b.userId.toString() === userId))
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'Bet exists this round.' }));

  user.balances[currency] -= amount;
  await user.save();

  round.bets.push({ userId, amount, currency });
  await round.save();

  ws.send(JSON.stringify({ action: 'BET_PLACED', amount, currency, balance: user.balances[currency] }));
};

const handleCashout = async (ws, data) => {
  if (!isRunning) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Game not running.' }));

  const { userId } = data;
  const round = await GameRound.findOne().sort({ startTime: -1 });
  const bet = round.bets.find(b => b.userId.toString() === userId);
  if (!bet || bet.cashedOut) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Cannot cashout.' }));

  const winnings = Math.floor(bet.amount * currentMultiplier * 100) / 100;
  const user = await User.findById(userId);
  user.balances[bet.currency] += winnings;
  await user.save();

  bet.cashedOut = true;
  await round.save();

  ws.send(JSON.stringify({ action: 'CASHOUT_SUCCESS', currency: bet.currency, winnings, balance: user.balances[bet.currency], multiplier: currentMultiplier.toFixed(2) }));
};

module.exports = { startGame, handleBet, handleCashout };
