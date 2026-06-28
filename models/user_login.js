const mongoose = require('mongoose');

const user_login = new mongoose.Schema({
    fullname:{
      type:String,
      required:true
    },
    email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  }
})
module.exports = mongoose.model('user_detail', user_login);