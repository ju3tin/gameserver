const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true, unique: true },
  balances: {
    SOL: { type: Number, default: 1000 },
    CHIPPY: { type: Number, default: 1000 },
    DEMO: { type: Number, default: 1000 }
  }
});

module.exports = mongoose.model('User', UserSchema);
