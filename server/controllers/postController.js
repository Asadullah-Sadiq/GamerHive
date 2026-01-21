const Post = require('../models/Post');
const User = require('../models/User');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Create Post
exports.createPost = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    
    if (!userId) {
      // If file was uploaded but no userId, delete the uploaded file and return error
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const { description } = req.body;

    // Validation - at least description or media should be provided
    if (!description && !req.file) {
      // Delete uploaded file if validation fails
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'Post must have either description or media',
      });
    }

    let mediaUrl = null;
    let mediaType = null;

    // Check if file was uploaded
    if (req.file) {
      // Always use localhost for file URLs
      const port = process.env.PORT || 3000;
      mediaUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
      
      // Determine media type
      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      }
    }

    // Create new post
    const post = new Post({
      userId,
      description: description || '',
      media: mediaUrl,
      mediaType,
    });

    await post.save();

    // Populate user data for response
    await post.populate('userId', 'username name picture');

    // Check moderation asynchronously after post is created (don't block response)
    if (description && description.trim()) {
      setImmediate(async () => {
        try {
          const { classifyContent } = require('../utils/geminiModeration');
          const { getQualityScoreFromCategory, updateContentStats } = require('../utils/contentQualityScoring');
          
          console.log('[Post Moderation] Checking post description:', description.substring(0, 50) + '...');
          
          const moderationResult = await classifyContent(description);
          const qualityScore = getQualityScoreFromCategory(moderationResult.category);
          
          // Update post with moderation result
          post.descriptionModeration = {
            category: moderationResult.category,
            hasWarning: moderationResult.isMildInsult,
            qualityScore: qualityScore,
          };
          await post.save();
          
          // Update user content quality stats
          const user = await User.findById(userId);
          if (user) {
            const updatedStats = updateContentStats(
              user.contentQuality || {},
              'post',
              qualityScore
            );
            updatedStats.averageQualityScore = Math.round(
              updatedStats.qualityScoreSum / updatedStats.totalContent
            );
            user.contentQuality = updatedStats;
            await user.save();
            
            console.log('[Post Moderation] ✅ Updated user content quality:', {
              userId: userId,
              averageQuality: updatedStats.averageQualityScore,
            });
          }
          
          console.log('[Post Moderation] ✅ Post moderated:', {
            postId: post._id.toString(),
            category: moderationResult.category,
            qualityScore: qualityScore,
          });
        } catch (error) {
          console.error('[Post Moderation] ❌ Error during moderation check:', error);
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
        post: {
          id: post._id,
          userId: post.userId._id,
          user: {
            id: post.userId._id,
            username: post.userId.username,
            name: post.userId.name,
            picture: post.userId.picture,
          },
          description: post.description,
          media: post.media,
          mediaType: post.mediaType,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          createdAt: post.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create post',
    });
  }
};

// Get User Posts
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const posts = await Post.find({ userId })
      .populate('userId', 'username name picture')
      .populate('likes', 'username name picture')
      .sort({ createdAt: -1 }); // Newest first

    // Collect all user IDs that need to be populated from comments and replies
    const userIdsToPopulate = new Set();
    posts.forEach(post => {
      post.comments.forEach(comment => {
        if (comment.userId) {
          // Check if it's already populated (has username property) or if it's just an ObjectId
          const userIdStr = comment.userId._id ? comment.userId._id.toString() : comment.userId.toString();
          // Only add if not already populated (doesn't have username property)
          if (!comment.userId.username && !comment.userId.name) {
            userIdsToPopulate.add(userIdStr);
          }
        }
        comment.replies.forEach(reply => {
          if (reply.userId) {
            const userIdStr = reply.userId._id ? reply.userId._id.toString() : reply.userId.toString();
            // Only add if not already populated
            if (!reply.userId.username && !reply.userId.name) {
              userIdsToPopulate.add(userIdStr);
            }
          }
        });
      });
    });

    // Fetch all users at once
    const usersMap = new Map();
    if (userIdsToPopulate.size > 0) {
      const userIdsArray = Array.from(userIdsToPopulate).map(id => {
        try {
          return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
        } catch (e) {
          return id;
        }
      });
      const users = await User.find({ _id: { $in: userIdsArray } })
        .select('username name picture');
      users.forEach(user => {
        usersMap.set(user._id.toString(), {
          _id: user._id,
          username: user.username,
          name: user.name,
          picture: user.picture,
        });
      });
    }

    // Populate comments and replies with user data
    posts.forEach(post => {
      post.comments.forEach(comment => {
        if (comment.userId) {
          const userIdStr = comment.userId._id ? comment.userId._id.toString() : comment.userId.toString();
          // If not already populated (no username), populate it
          if (!comment.userId.username && !comment.userId.name) {
            const user = usersMap.get(userIdStr);
            if (user) {
              comment.userId = user;
            }
          }
        }
        
        comment.replies.forEach(reply => {
          if (reply.userId) {
            const userIdStr = reply.userId._id ? reply.userId._id.toString() : reply.userId.toString();
            // If not already populated, populate it
            if (!reply.userId.username && !reply.userId.name) {
              const user = usersMap.get(userIdStr);
              if (user) {
                reply.userId = user;
              }
            }
          }
        });
      });
    });

    res.json({
      success: true,
      data: {
        posts: posts.map(post => ({
          id: post._id,
          userId: post.userId._id,
          user: {
            id: post.userId._id,
            username: post.userId.username,
            name: post.userId.name,
            picture: post.userId.picture,
          },
          description: post.description,
          media: post.media,
          mediaType: post.mediaType,
          likes: post.likes.map(like => ({
            id: like._id,
            username: like.username,
            name: like.name,
            picture: like.picture,
          })),
          likesCount: post.likes.length,
          comments: post.comments.map(comment => {
            // Get user ID - handle both populated and unpopulated cases
            const commentUserId = comment.userId?._id ? comment.userId._id.toString() : (comment.userId?.toString ? comment.userId.toString() : comment.userId);
            // Get user object - check if it's populated (has username/name) or just ObjectId
            const commentUser = comment.userId && (comment.userId.username || comment.userId.name) ? comment.userId : null;
            
            return {
              id: comment._id,
              userId: commentUserId,
              user: {
                id: commentUserId,
                username: commentUser?.username || commentUser?.name || 'User',
                name: commentUser?.name || commentUser?.username || 'User',
                picture: commentUser?.picture || null,
              },
              text: comment.text,
              replies: comment.replies.map(reply => {
                // Get user ID for reply
                const replyUserId = reply.userId?._id ? reply.userId._id.toString() : (reply.userId?.toString ? reply.userId.toString() : reply.userId);
                // Get user object for reply
                const replyUser = reply.userId && (reply.userId.username || reply.userId.name) ? reply.userId : null;
                
                return {
                  id: reply._id,
                  userId: replyUserId,
                  user: {
                    id: replyUserId,
                    username: replyUser?.username || replyUser?.name || 'User',
                    name: replyUser?.name || replyUser?.username || 'User',
                    picture: replyUser?.picture || null,
                  },
                  text: reply.text,
                  createdAt: reply.createdAt,
                };
              }),
              repliesCount: comment.replies.length,
              createdAt: comment.createdAt,
            };
          }),
          commentsCount: post.comments.length,
          shares: post.shares,
          createdAt: post.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get posts',
    });
  }
};

// Delete Post
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body.userId || req.query.userId;
    
    if (!postId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID is required',
      });
    }

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user owns the post
    if (post.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own posts',
      });
    }

    // Delete media file if exists
    if (post.media && post.media.includes('/uploads/')) {
      try {
        // Extract filename from various URL formats
        let fileName = null;
        const urlParts = post.media.split('/uploads/');
        if (urlParts.length > 1) {
          fileName = urlParts[1].split('?')[0].split('#')[0];
        }
        
        if (fileName) {
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.error('Error deleting post media:', error);
      }
    }

    await Post.findByIdAndDelete(postId);

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete post',
    });
  }
};

// Like/Unlike Post
exports.toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body.userId;
    
    if (!postId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and User ID are required',
      });
    }

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const likeIndex = post.likes.findIndex(
      like => like.toString() === userId
    );

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userId);
      
      // Notify post owner about like
      const { notifyPostLike } = require('../utils/notificationService');
      notifyPostLike(post.userId.toString(), userId, postId).catch((err) => {
        console.error('[PostController] Error notifying post like:', err);
      });
    }

    await post.save();

    // Populate likes for response
    await post.populate('likes', 'username name picture');

    res.json({
      success: true,
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      data: {
        likesCount: post.likes.length,
        isLiked: likeIndex === -1,
        likes: post.likes.map(like => ({
          id: like._id,
          username: like.username,
          name: like.name,
          picture: like.picture,
        })),
      },
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle like',
    });
  }
};

// Add Comment
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, text, parentCommentId } = req.body;
    
    if (!postId || !userId || !text) {
      return res.status(400).json({
        success: false,
        message: 'Post ID, User ID, and text are required',
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text cannot be empty',
      });
    }

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (parentCommentId) {
      // Add reply to existing comment
      const parentComment = post.comments.id(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found',
        });
      }

      parentComment.replies.push({
        userId,
        text: text.trim(),
      });

      await post.save();

      // Re-fetch the post
      const updatedPost = await Post.findById(postId);
      const updatedParentComment = updatedPost.comments.id(parentCommentId);
      const newReply = updatedParentComment.replies[updatedParentComment.replies.length - 1];

      // Fetch user data for the reply
      const replyUser = await User.findById(userId).select('username name picture');

      // Check moderation asynchronously for reply
      if (text && text.trim()) {
        setImmediate(async () => {
          try {
            const { classifyContent } = require('../utils/geminiModeration');
            const { getQualityScoreFromCategory, updateContentStats } = require('../utils/contentQualityScoring');
            
            const moderationResult = await classifyContent(text.trim());
            const qualityScore = getQualityScoreFromCategory(moderationResult.category);
            
            // Update reply with moderation result
            const replyToUpdate = updatedPost.comments.id(parentCommentId).replies.id(newReply._id);
            if (replyToUpdate) {
              replyToUpdate.moderation = {
                category: moderationResult.category,
                hasWarning: moderationResult.isMildInsult,
                qualityScore: qualityScore,
              };
              await updatedPost.save();
            }
            
            // Update user content quality stats
            const user = await User.findById(userId);
            if (user) {
              const updatedStats = updateContentStats(
                user.contentQuality || {},
                'reply',
                qualityScore
              );
              updatedStats.averageQualityScore = Math.round(
                updatedStats.qualityScoreSum / updatedStats.totalContent
              );
              user.contentQuality = updatedStats;
              await user.save();
            }
          } catch (error) {
            console.error('[Reply Moderation] ❌ Error:', error);
          }
        });
      }

      res.json({
        success: true,
        message: 'Reply added successfully',
        data: {
          reply: {
            id: newReply._id,
            userId: userId,
            user: {
              id: userId,
              username: replyUser?.username || replyUser?.name || 'User',
              name: replyUser?.name || replyUser?.username || 'User',
              picture: replyUser?.picture || null,
            },
            text: newReply.text,
            createdAt: newReply.createdAt,
          },
          repliesCount: updatedParentComment.replies.length,
        },
      });
    } else {
      // Add new top-level comment
      post.comments.push({
        userId,
        text: text.trim(),
      });

      await post.save();

      // Re-fetch the post
      const updatedPost = await Post.findById(postId);
      const newComment = updatedPost.comments[updatedPost.comments.length - 1];

      // Fetch user data for the comment
      const commentUser = await User.findById(userId).select('username name picture');

      // Notify post owner about comment
      const { notifyPostComment } = require('../utils/notificationService');
      notifyPostComment(post.userId.toString(), userId, postId, text.trim()).catch((err) => {
        console.error('[PostController] Error notifying post comment:', err);
      });

      // Check moderation asynchronously for comment
      if (text && text.trim()) {
        setImmediate(async () => {
          try {
            const { classifyContent } = require('../utils/geminiModeration');
            const { getQualityScoreFromCategory, updateContentStats } = require('../utils/contentQualityScoring');
            
            const moderationResult = await classifyContent(text.trim());
            const qualityScore = getQualityScoreFromCategory(moderationResult.category);
            
            // Update comment with moderation result
            const commentToUpdate = updatedPost.comments.id(newComment._id);
            if (commentToUpdate) {
              commentToUpdate.moderation = {
                category: moderationResult.category,
                hasWarning: moderationResult.isMildInsult,
                qualityScore: qualityScore,
              };
              await updatedPost.save();
            }
            
            // Update user content quality stats
            const user = await User.findById(userId);
            if (user) {
              const updatedStats = updateContentStats(
                user.contentQuality || {},
                'comment',
                qualityScore
              );
              updatedStats.averageQualityScore = Math.round(
                updatedStats.qualityScoreSum / updatedStats.totalContent
              );
              user.contentQuality = updatedStats;
              await user.save();
            }
          } catch (error) {
            console.error('[Comment Moderation] ❌ Error:', error);
          }
        });
      }

      res.json({
        success: true,
        message: 'Comment added successfully',
        data: {
          comment: {
            id: newComment._id,
            userId: userId,
            user: {
              id: userId,
              username: commentUser?.username || commentUser?.name || 'User',
              name: commentUser?.name || commentUser?.username || 'User',
              picture: commentUser?.picture || null,
            },
            text: newComment.text,
            replies: [],
            repliesCount: 0,
            createdAt: newComment.createdAt,
          },
          commentsCount: updatedPost.comments.length,
        },
      });
    }
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add comment',
    });
  }
};

// Update Post
exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, description } = req.body;
    
    if (!postId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and User ID are required',
      });
    }

    if (!description && description !== '') {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user owns the post
    if (post.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own posts',
      });
    }

    // Update description
    post.description = description.trim();
    await post.save();

    // Populate user data for response
    await post.populate('userId', 'username name picture');

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: {
        post: {
          id: post._id,
          userId: post.userId._id,
          user: {
            id: post.userId._id,
            username: post.userId.username,
            name: post.userId.name,
            picture: post.userId.picture,
          },
          description: post.description,
          media: post.media,
          mediaType: post.mediaType,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          createdAt: post.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update post',
    });
  }
};

// Delete Comment
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { userId, isReply, parentCommentId } = req.body;
    
    if (!postId || !commentId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID, Comment ID, and User ID are required',
      });
    }

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (isReply && parentCommentId) {
      // Delete reply
      const parentComment = post.comments.id(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found',
        });
      }

      const reply = parentComment.replies.id(commentId);
      if (!reply) {
        return res.status(404).json({
          success: false,
          message: 'Reply not found',
        });
      }

      // Check if user owns the reply
      if (reply.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own replies',
        });
      }

      parentComment.replies.pull(commentId);
      await post.save();

      res.json({
        success: true,
        message: 'Reply deleted successfully',
        data: {
          repliesCount: parentComment.replies.length,
        },
      });
    } else {
      // Delete top-level comment
      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      // Check if user owns the comment
      if (comment.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own comments',
        });
      }

      post.comments.pull(commentId);
      await post.save();

      res.json({
        success: true,
        message: 'Comment deleted successfully',
        data: {
          commentsCount: post.comments.length,
        },
      });
    }
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete comment',
    });
  }
};

