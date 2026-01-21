const mongoose = require('mongoose');

const gameBorrowSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
    index: true,
  },
  borrowerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'returned', 'cancelled'],
    default: 'pending',
    index: true,
  },
  borrowDate: {
    type: Date,
    default: null,
  },
  returnDate: {
    type: Date,
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  borrowDuration: {
    type: Number,
    default: 14, // 14 days default
    min: 1,
  },
  message: {
    type: String,
    default: '',
    maxlength: [500, 'Message cannot exceed 500 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Update updatedAt before saving
gameBorrowSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Compound indexes for efficient queries
gameBorrowSchema.index({ borrowerId: 1, status: 1 });
gameBorrowSchema.index({ lenderId: 1, status: 1 });
gameBorrowSchema.index({ gameId: 1, status: 1 });

const GameBorrow = mongoose.model('GameBorrow', gameBorrowSchema);

module.exports = GameBorrow;
