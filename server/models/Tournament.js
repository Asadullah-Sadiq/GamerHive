const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    minlength: [3, 'Tournament name must be at least 3 characters'],
    maxlength: [100, 'Tournament name cannot exceed 100 characters'],
  },
  image: {
    type: String,
    required: [true, 'Tournament image is required'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  prize: {
    type: String,
    required: [true, 'Prize is required'],
    trim: true,
  },
  entryFee: {
    type: Number,
    default: 0,
  },
  platform: {
    type: String,
    trim: true,
    default: 'Multi-Platform',
  },
  format: {
    type: String,
    trim: true,
    default: 'Single Elimination',
  },
  maxParticipants: {
    type: Number,
    default: 1000,
  },
  status: {
    type: String,
    enum: ['registration', 'live', 'upcoming', 'completed'],
    default: 'registration',
    required: true,
  },
  link: {
    type: String,
    required: [true, 'Link is required'],
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
tournamentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Tournament = mongoose.model('Tournament', tournamentSchema);

module.exports = Tournament;

