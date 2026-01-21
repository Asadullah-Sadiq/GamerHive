const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: function() {
      return !this.googleId && !this.auth0Id; // Username required only if not social login user
    },
    // unique: true, // Removed - multiple users can have the same username
    sparse: true, // Allow multiple null values
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId && !this.auth0Id; // Password required only if not social login user
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  auth0Id: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  name: {
    type: String,
    trim: true,
  },
  dateOfBirth: {
    type: Date,
  },
  picture: {
    type: String,
  },
  coverPhoto: {
    type: String,
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: '',
  },
  favoriteGames: {
    type: [String],
    default: [],
  },
  skillLevels: {
    type: Map,
    of: String, // Game name -> Skill level (e.g., "PUBG" -> "Expert", "Fortnite" -> "Intermediate")
    default: {},
  },
  joinedCommunities: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
      },
    ],
    default: [],
  },
  friends: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    default: [],
  },
  sentFriendRequests: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    default: [],
  },
  receivedFriendRequests: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    default: [],
  },
  blockedUsers: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    default: [],
  },
  games: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game',
      },
    ],
    default: [],
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false, // Email verification required via OTP
  },
  pushToken: {
    type: String,
    default: null,
  },
  pushTokenPlatform: {
    type: String,
    enum: ['ios', 'android', null],
    default: null,
  },
  profileRank: {
    rank: {
      type: String,
      default: 'Bronze',
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Legend'],
    },
    rankScore: {
      type: Number,
      default: 0,
    },
    rankColor: {
      type: String,
      default: '#CD7F32',
    },
    lastCalculated: {
      type: Date,
      default: Date.now,
    },
  },
  // Content quality tracking for ranking
  contentQuality: {
    totalPosts: {
      type: Number,
      default: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    totalReplies: {
      type: Number,
      default: 0,
    },
    totalContent: {
      type: Number,
      default: 0,
    },
    qualityScoreSum: {
      type: Number,
      default: 0,
    },
    averageQualityScore: {
      type: Number,
      default: 50, // Default to 50 (medium quality)
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Skip password hashing if flag is set (for OTP-first signup where password is already hashed)
  if (this._skipPasswordHash) {
    this._skipPasswordHash = false; // Clear flag
    return next();
  }

  // Only hash the password if it has been modified (or is new) and password exists
  if (!this.isModified('password') || !this.password) return next();

  // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  const isAlreadyHashed = /^\$2[ayb]\$\d{2}\$/.test(this.password);
  if (isAlreadyHashed) {
    return next(); // Password already hashed, skip
  }

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt field before saving
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

