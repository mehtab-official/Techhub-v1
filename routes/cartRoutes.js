const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');

router.use(protect);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);

// DELETE / (clearCart) MUST be registered before DELETE /:productId
// to prevent Express matching the literal path "/" as a productId param
router.delete('/', cartController.clearCart);
router.delete('/:productId', cartController.removeFromCart);

module.exports = router;
