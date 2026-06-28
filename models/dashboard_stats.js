const mongoose = require('mongoose');

const dashboardStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user_detail',
    required: true,
    index: true,
    unique: true
  },
  pending: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  finished: { type: Number, default: 0 },
  energy: { type: Number, default: 3 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DashboardStats', dashboardStatsSchema);
