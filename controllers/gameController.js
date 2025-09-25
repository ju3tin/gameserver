const GameRound = require('../models/GameRound');
const User = require('../models/User');

let currentMultiplier = 1.0;
let gameState = 'waiting'; // "waiting" | "running" | "ended"
let isRunning = false;

// Generate random crash point
const generateCrashMultiplier = () => (Math.random() * 10 + 1).toFixed(2);

const broadcast = (wss, msg) => {
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(JSON.stringify(msg));
  });
};

// --- Start Game Loop ---
const startGame = async (wss) => {
  gameState = 'waiting';
  isRunning = false;
  currentMultiplier = 1.0;

  const round = new GameRound({ startTime: new Date(), crashMultiplier: 0, bets: [] });
  await round.save();

  broadcast(wss, { action: 'GAME_WAITING', message: 'Place your bets!' });

  // Countdown 10 seconds
  let countdown = 11;
  const countdownInterval = setInterval(async () => {
    if (countdown == 10) {broadcast(wss, { action: 'ROUND_PREPARING' });}
    broadcast(wss, { action: 'SECOND_BEFORE_START', data: countdown - 1 });
    broadcast(wss, { action: 'COUNTDOWN', time: countdown - 1 });
    countdown--;
    if (countdown == 0) await new Promise(resolve => setTimeout(resolve, 1000));
    if (countdown == 0) {broadcast(wss, { action: 'Justin_was_here'});}
    if (countdown < 0) {broadcast(wss, { action: 'ROUND_STARTED'});}
    if (countdown < 0) clearInterval(countdownInterval);
  }, 1000);
  

  setTimeout(async () => {
    gameState = 'running';
    isRunning = true;

    const crashPoint = parseFloat(generateCrashMultiplier());
    round.crashMultiplier = crashPoint;
    await round.save();

  //  broadcast(wss, { action: 'ROUND_STARTED', message: 'Round started!' });

    const interval = setInterval(async () => {
      currentMultiplier = parseFloat((currentMultiplier + 0.01).toFixed(2));
      broadcast(wss, { action: 'CNT_MULTIPLY', multiplier: currentMultiplier.toFixed(2), data: currentMultiplier.toFixed(2) });

      if (currentMultiplier >= crashPoint) {
        clearInterval(interval);
        isRunning = false;
        await endGame(wss, round._id);
      }
    }, 50);
  }, 10000);
};

// --- End Game ---
const endGame = async (wss, roundId) => {
  const round = await GameRound.findById(roundId);
  round.crashMultiplier = currentMultiplier;
  await round.save();

  broadcast(wss, { action: 'ROUND_CRASHED', multiplier: currentMultiplier.toFixed(2) });

  setTimeout(() => startGame(wss), 5000);
};

// --- Handle Bet ---
const handleBet = async (ws, data, wss) => {
  const { walletAddress, amount, currency } = data;
  if (!amount) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Amount required.' }));
  if (!currency) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Currency required.' }));
  if (!walletAddress) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Wallet address required.' }));
  if (gameState !== 'waiting') return ws.send(JSON.stringify({ action: 'ERROR', message: 'Bets can only be placed during waiting phase.' }));

  const user = await User.findOne({ walletAddress });
  if (!user) return ws.send(JSON.stringify({ action: 'ERROR', message: 'User not found.' }));

  if (user.balances[currency] < amount) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Insufficient balance.' }));

  let round = await GameRound.findOne().sort({ startTime: -1 });
  if (!round || round.crashMultiplier > 0) {
    round = new GameRound({ startTime: new Date(), crashMultiplier: 0, bets: [] });
    await round.save();
  }

  if (round.bets.find(b => b.walletAddress === walletAddress)) {
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'You already have a bet in this round.' }));
  }

  user.balances[currency] -= amount;
  await user.save();

  round.bets.push({ walletAddress, amount, currency, cashedOut: false });
  await round.save();

  ws.send(JSON.stringify({ action: 'BET_PLACED', walletAddress, amount, currency, balance: user.balances[currency] }));
  broadcast(wss, { action: 'PLAYER_BET', walletAddress, amount, currency });
};

// --- Handle Cashout ---
const handleCashout = async (ws, data, wss) => {
  if (!isRunning) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Cannot cashout now.' }));

  const { walletAddress } = data;

  const round = await GameRound.findOne().sort({ startTime: -1 });
  const bet = round.bets.find(b => b.walletAddress === walletAddress);
  if (!bet) return ws.send(JSON.stringify({ action: 'ERROR', message: 'No active bet.' }));
  if (bet.cashedOut) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Already cashed out.' }));

  const user = await User.findOne({ walletAddress });
  const winnings = Math.floor(bet.amount * currentMultiplier * 100) / 100;

  user.balances[bet.currency] += winnings;
  await user.save();

  bet.cashedOut = true;
  await round.save();

  ws.send(JSON.stringify({ action: 'CASHOUT_SUCCESS', walletAddress, currency: bet.currency, winnings, balance: user.balances[bet.currency], multiplier: currentMultiplier.toFixed(2) }));

  broadcast(wss, { action: 'PLAYER_CASHED_OUT', walletAddress, winnings, multiplier: currentMultiplier.toFixed(2)});
};

module.exports = { startGame, handleBet, handleCashout };
