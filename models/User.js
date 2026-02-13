import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: String,
  money: { type: Number, default: 10000000 },
  lastDaily: Date,
  partnerId: { type: String, default: null },
  marriedAt: { type: Date, default: null },
  lovePoints: { type: Number, default: 0 },
  lastLoveCommand: Date,
  inventory: [String],
  couplePhoto: { type: String, default: null }
});

export const User = mongoose.model('User', userSchema);