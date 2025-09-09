const User = require('../models/User');

const handleCreateUser = async (ws, data) => {
  const { username } = data;
  if (!username) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Username required.' }));

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return ws.send(JSON.stringify({ action: 'ERROR', message: 'Username exists.' }));

    const user = new User({
      username,
      balances: { SOL: 1000, CHIPPY: 1000, DEMO: 1000 },
    });
    await user.save();

    ws.send(JSON.stringify({
      action: 'USER_CREATED',
      userId: user._id,
      username: user.username,
      balances: user.balances
    }));
  } catch (err) {
    console.error(err);
    ws.send(JSON.stringify({ action: 'ERROR', message: 'Failed to create user.' }));
  }
};

module.exports = { handleCreateUser };
