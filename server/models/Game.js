const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Game title is required'],
    trim: true,
    maxlength: [100, 'Game title cannot exceed 100 characters'],
  },
  genre: {
    type: String,
    required: [true, 'Genre is required'],
    trim: true,
  },
  platform: {
    type: [String],
    required: [true, 'At least one platform is required'],
    validate: {
      validator: function(platforms) {
        return platforms.length > 0;
      },
      message: 'At least one platform is required'
    }
  },
  fileSize: {
    type: String,
    required: [true, 'File size is required'],
    trim: true,
  },
  version: {
    type: String,
    default: '1.0.0',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  image: {
    type: String,
    required: [true, 'Game image is required'],
  },
  status: {
    type: String,
    enum: ['available', 'borrowed', 'maintenance'],
    default: 'available',
  },
  totalCopies: {
    type: Number,
    default: 1,
    min: [1, 'Total copies must be at least 1'],
  },
  availableCopies: {
    type: Number,
    default: 1,
    min: [0, 'Available copies cannot be negative'],
  },
  borrowedCount: {
    type: Number,
    default: 0,
    min: [0, 'Borrowed count cannot be negative'],
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  addedDate: {
    type: Date,
    default: Date.now,
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

// Update updatedAt field before saving
gameSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;

