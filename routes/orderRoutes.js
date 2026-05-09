const router = require('express').Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

router.use(protect);

router.post('/', orderController.placeOrder);
router.get('/my', orderController.getMyOrders);

// Admin only
router.get('/all', isAdmin, orderController.getAllOrders);
router.put('/:id/status', isAdmin, orderController.updateOrderStatus);

module.exports = router;
