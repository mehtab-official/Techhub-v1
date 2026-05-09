const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const buildPublicProfile = (user) => ({
  _id:        user._id,
  fullName:   user.fullName,
  username:   user.username,
  email:      user.email,
  phone:      user.phone,
  address:    user.address,
  city:       user.city,
  postalCode: user.postalCode,
  role:       user.role,
  createdAt:  user.createdAt,
});

const register = async (req, res, next) => {
  try {
    const { fullName, username, email, password, phone, address, city, postalCode } = req.body;

    if (!fullName || !username || !email || !password || !phone || !address || !city || !postalCode) {
      return res.status(400).json({
        message: 'All fields are required: fullName, username, email, password, phone, address, city, postalCode',
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ fullName, username, email, passwordHash, phone, address, city, postalCode });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ token, user: buildPublicProfile(user) });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({ token, user: buildPublicProfile(user) });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };
