const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName:     { type: String, required: true },
    username:     { type: String, required: true, unique: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    phone:        { type: String, required: true },
    address:      { type: String, required: true },
    city:         { type: String, required: true },
    postalCode:   { type: String, required: true },
    role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
