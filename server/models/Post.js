const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: '',
  },
  // Content moderation for post description
  descriptionModeration: {
    category: {
      type: String,
      enum: ['SAFE', 'MILD_INSULT', 'HARMFUL'],
      default: null,
    },
    hasWarning: {
      type: Boolean,
      default: false,
    },
    qualityScore: {
      type: Number,
      default: 0, // 0-100, higher is better
    },
  },
  media: {
    type: String, // URL to image or video
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', null],
    default: null,
  },
  likes: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    default: [],
  },
  comments: {
    type: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        text: {
          type: String,
          required: true,
          maxlength: [500, 'Comment cannot exceed 500 characters'],
        },
        // Content moderation for comment
        moderation: {
          category: {
            type: String,
            enum: ['SAFE', 'MILD_INSULT', 'HARMFUL'],
            default: null,
          },
          hasWarning: {
            type: Boolean,
            default: false,
          },
          qualityScore: {
            type: Number,
            default: 0, // 0-100, higher is better
          },
        },
        replies: {
          type: [
            {
              userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
              },
              text: {
                type: String,
                required: true,
                maxlength: [500, 'Reply cannot exceed 500 characters'],
              },
              // Content moderation for reply
              moderation: {
                category: {
                  type: String,
                  enum: ['SAFE', 'MILD_INSULT', 'HARMFUL'],
                  default: null,
                },
                hasWarning: {
                  type: Boolean,
                  default: false,
                },
                qualityScore: {
                  type: Number,
                  default: 0, // 0-100, higher is better
                },
              },
              createdAt: {
                type: Date,
                default: Date.now,
              },
            },
          ],
          default: [],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
  },
  shares: {
    type: Number,
    default: 0,
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

// Update updatedAt before saving
postSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
postSchema.index({ userId: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;

