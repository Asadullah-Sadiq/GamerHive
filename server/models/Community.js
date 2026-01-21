const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Community name is required'],
    trim: true,
    minlength: [3, 'Community name must be at least 3 characters'],
    maxlength: [50, 'Community name cannot exceed 50 characters'],
  },
  game: {
    type: String,
    required: [true, 'Game name is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  categories: {
    type: [String],
    required: [true, 'At least one category is required'],
    validate: {
      validator: function(categories) {
        const validCategories = ['Battle Royale', 'FPS', 'Sports', 'Fighting', 'MOBA', 'Sandbox', 'Other'];
        return categories.length > 0 && categories.every(cat => validCategories.includes(cat));
      },
      message: 'Invalid category or at least one category is required'
    }
  },
  image: {
    type: String,
    required: [true, 'Community image is required'],
  },
  color: {
    type: String,
    default: '#7c3aed',
  },
  icon: {
    type: String,
    default: 'Target', // Icon name as string
  },
  members: {
    type: Number,
    default: 0,
  },
  activeMembers: {
    type: Number,
    default: 0,
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
communitySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Community = mongoose.model('Community', communitySchema);

module.exports = Community;

