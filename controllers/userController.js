const User = require('../models/user');

/**
 * Maps a Mongoose user document to a safe public profile object.
 * Omits passwordHash, resetPasswordToken, and resetPasswordExpires.
 * @param {Object} user - Mongoose User document
 * @returns {Object} Public_Profile
 */
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
  updatedAt:  user.updatedAt,
});

/**
 * Escapes special regex characters in a string to prevent ReDoS.
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, (char) => '\\' + char);

/**
 * GET /api/users
 * Returns all users as Public_Profile objects.
 * Supports optional case-insensitive search on fullName and email
 * via the `search` query parameter.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getAllUsers = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.search && req.query.search.trim() !== '') {
      const regex = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

    const users = await User.find(filter).select('-passwordHash');
    return res.status(200).json(users.map(buildPublicProfile));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/role
 * Updates the role of the target user.
 * Guards against self-modification.
 *
 * @param {import('express').Request}  req  - req.body.role, req.params.id, req.user
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id }   = req.params;

    // Self-modification guard
    if (req.user._id.toString() === id) {
      return res.status(403).json({ message: 'You cannot modify your own role' });
    }

    // Role validation
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ message: 'Role must be either "user" or "admin"' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (user === null) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(buildPublicProfile(user));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Deletes the target user account.
 * Guards against self-deletion.
 *
 * @param {import('express').Request}  req  - req.params.id, req.user
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Self-deletion guard
    if (req.user._id.toString() === id) {
      return res.status(403).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(id);

    if (user === null) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, updateUserRole, deleteUser };
