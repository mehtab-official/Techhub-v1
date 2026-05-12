const express = require('express');
const router = express.Router();

const { protect, isAdmin } = require('../middleware/authMiddleware');
const { getAllUsers, updateUserRole, deleteUser } = require('../controllers/userController');

router.get('/', protect, isAdmin, getAllUsers);
router.put('/:id/role', protect, isAdmin, updateUserRole);
router.delete('/:id', protect, isAdmin, deleteUser);

module.exports = router;
