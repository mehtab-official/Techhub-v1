const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    price:        { type: Number, required: true },
    rating:       { type: Number, default: 0 },
    image:        { type: String, required: true },
    description:  { type: String },
    category:     { type: String },
    countInStock: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
