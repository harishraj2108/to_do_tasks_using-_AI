const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user_detail',
    required: true,
    index: true
  },
  id: {
    type: String,
    required: true
  },
  taskId: {
    type: String,
    default: null
  },
  title: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  startHour: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    default: 'Work'
  },
  locked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
