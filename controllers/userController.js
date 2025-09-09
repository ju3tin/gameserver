const User = require('../models/User');

const handleCreateUser = async (ws, data) => {
  const { username, walletAddress } = data;

  if (!username || !walletAddress) {
    return ws.send(JSON.stringify({ action: 'ERROR', message: 'Username and wallet address are required.' }));
  }

  try {
    // Check if username or wallet already exists
    const existingUser = await User.findOne({ $or: [{ username }, { walletAddress }] });
    if (existingUser) {
      return ws.send(JSON.stringify({ action: 'ERROR', message: 'Username or wallet address already exists.' }));
    }

    const user1 = new User({
      username,
      walletAddress,
      balances: { SOL: 1000, CHIPPY: 1000, DEMO: 1000 }
    });
    await user1.save();

    ws.send(JSON.stringify({
      action: 'USER_CREATED',
      userId: user1._id,
      username: user1.username,
      walletAddress: user1.walletAddress,
      balances: user1.balances
    }));
  } catch (err) {
    console.error(err);
    ws.send(JSON.stringify({ action: 'ERROR', message: 'Failed to create user.' }));
  }
};

module.exports = { handleCreateUser };
