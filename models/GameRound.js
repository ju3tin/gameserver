const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  currency: String,
  cashedOut: { type: Boolean, default: false },
});

const GameRoundSchema = new mongoose.Schema({
  startTime: Date,
  crashMultiplier: Number,
  bets: [BetSchema],
});

module.exports = mongoose.model('GameRound', GameRoundSchema);
