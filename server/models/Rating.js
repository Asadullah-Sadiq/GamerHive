const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  ratedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Rated user ID is required'],
    index: true,
  },
  raterUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Rater user ID is required'],
    index: true,
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure one rating per user pair
ratingSchema.index({ ratedUserId: 1, raterUserId: 1 }, { unique: true });

// Update updatedAt before saving
ratingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;

