const BetSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  amount: Number,
  currency: String,
  cashedOut: { type: Boolean, default: false }
});

const GameRoundSchema = new mongoose.Schema({
  startTime: Date,
  crashMultiplier: Number,
  bets: [BetSchema]
});

module.exports = mongoose.model('GameRound', GameRoundSchema);
