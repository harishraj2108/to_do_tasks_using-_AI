const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user_detail',
    required: true,
    index: true
  },
  id: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  streak: {
    type: Number,
    required: true,
    default: 0
  },
  lastChecked: {
    type: Date,
    default: null
  },
  completedToday: {
    type: Boolean,
    required: true,
    default: false
  },
  microHabit: {
    type: String,
    required: true,
    trim: true
  }
});

module.exports = mongoose.model('Habit', habitSchema);
