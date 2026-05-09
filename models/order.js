const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    price:    { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    address:   { type: String, required: true },
    city:      { type: String, required: true },
    phone:     { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderItems:      [orderItemSchema],
    shippingAddress: { type: shippingAddressSchema, required: true },
    totalPrice:      { type: Number, required: true },
    paymentMethod:   { type: String, default: 'COD' },
    status:          { type: String, default: 'pending' },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
