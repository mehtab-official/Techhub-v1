const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const sendEmail = require('../utils/sendEmail');

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

const forgotPassword = async (req, res, next) => {
  try {
    if (!req.body.email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email address' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetURL = `${process.env.FRONT_URL}/reset-password/${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `You requested a password reset.\n\nClick the link below to reset your password:\n${resetURL}\n\nThis link expires in 1 hour.\n\nIf you did not request this, please ignore this email.`,
      });
      return res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (emailErr) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
    }
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    if (!req.body.password) {
      return res.status(400).json({ message: 'New password is required' });
    }

    user.passwordHash = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, forgotPassword, resetPassword };
