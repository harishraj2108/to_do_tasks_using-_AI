const mongoose = require('mongoose');
const user_task_schema = new mongoose.Schema({
    userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title:{
    type:String,
    required: true
  },
  priority:{
    type: Number,
    required: true
  },
  duration:{
    type: Number,
    required:true
  },
  energy:{
      type: Number,
      required: true
  },
  deadline:{
    type:Date,
    required:true
  },
  category:{
    type:String,
    required: true
  },
  completed:{
    type:Boolean,
    required:true
  },
  subtasks:[{
    text: { type: String, required: true },
    completed: { type: Boolean, required: true }
  }]
});
module.exports = mongoose.model('user_tasks', user_task_schema);