const GameRound = require('../models/GameRound');
const User = require('../models/User');

const handleBet = async (ws, data) => {
  const { walletAddress, amount, currency } = data;

  if (!walletAddress) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Wallet address required.' }));
  if (gameState !== 'waiting') return ws.send(JSON.stringify({ action: 'ERROR', message: 'Bets can only be placed during waiting phase.' }));

  // Validate currency
  const supportedCurrencies = ['SOL', 'CHIPPY', 'DEMO'];
  if (!supportedCurrencies.includes(currency)) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Unsupported currency.' }));

  // Find user by wallet
  const user = await User.findOne({ walletAddress });
  if (!user) return ws.send(JSON.stringify({ action: 'ERROR', message: 'User not found.' }));

  if (user.balances[currency] < amount) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Insufficient balance.' }));

  // Get current round
  let round = await GameRound.findOne().sort({ startTime: -1 });
  if (!round || round.crashMultiplier > 0) {
    round = new GameRound({ startTime: new Date(), crashMultiplier: 0, bets: [] });
    await round.save();
  }

  // Check if user already bet in this round
  if (round.bets.find(b => b.walletAddress === walletAddress)) {
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'You already have a bet in this round.' }));
  }

  // Deduct balance
  user.balances[currency] -= amount;
  await user.save();

  // Add bet to round
  round.bets.push({ walletAddress, amount, currency, cashedOut: false });
  await round.save();

  // Confirm bet to player
  ws.send(JSON.stringify({
    action: 'BET_PLACED',
    walletAddress,
    amount,
    currency,
    balance: user.balances[currency]
  }));

  // Broadcast bet to other players
  ws._wss.clients.forEach(client => {
    if (client.readyState === 1 && client !== ws) {
      client.send(JSON.stringify({
        action: 'PLAYER_BET',
        walletAddress,
        amount,
        currency
      }));
    }
  });
};
