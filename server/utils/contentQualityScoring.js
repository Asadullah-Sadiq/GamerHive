/**
 * Content Quality Scoring System
 * Calculates user content quality score based on moderation results
 */

/**
 * Calculate quality score from moderation category
 * @param {string} category - Moderation category (SAFE, MILD_INSULT, HARMFUL)
 * @returns {number} Quality score (0-100)
 */
function getQualityScoreFromCategory(category) {
  switch (category) {
    case 'SAFE':
      return 100; // Perfect quality
    case 'MILD_INSULT':
      return 50; // Reduced quality
    case 'HARMFUL':
      return 0; // No quality points
    default:
      return 50; // Default to medium if not yet moderated
  }
}

/**
 * Calculate average content quality score for a user
 * @param {Object} userContentStats - User's content statistics
 * @returns {number} Average quality score (0-100)
 */
function calculateAverageQualityScore(userContentStats) {
  const {
    totalPosts = 0,
    totalComments = 0,
    totalReplies = 0,
    totalContent = 0,
    qualityScoreSum = 0,
  } = userContentStats;

  if (totalContent === 0) {
    return 50; // Default score for users with no content
  }

  // Calculate average: sum of all quality scores / total content
  const averageScore = qualityScoreSum / totalContent;
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(averageScore)));
}

/**
 * Update user content statistics when new content is moderated
 * @param {Object} userContentStats - Current user content statistics
 * @param {string} contentType - Type of content ('post', 'comment', 'reply')
 * @param {number} qualityScore - Quality score for this content (0-100)
 * @returns {Object} Updated content statistics
 */
function updateContentStats(userContentStats, contentType, qualityScore) {
  const stats = {
    totalPosts: userContentStats.totalPosts || 0,
    totalComments: userContentStats.totalComments || 0,
    totalReplies: userContentStats.totalReplies || 0,
    totalContent: userContentStats.totalContent || 0,
    qualityScoreSum: userContentStats.qualityScoreSum || 0,
    lastUpdated: new Date(),
  };

  // Increment appropriate counter
  if (contentType === 'post') {
    stats.totalPosts += 1;
  } else if (contentType === 'comment') {
    stats.totalComments += 1;
  } else if (contentType === 'reply') {
    stats.totalReplies += 1;
  }

  // Update total content and quality score sum
  stats.totalContent += 1;
  stats.qualityScoreSum += qualityScore;

  return stats;
}

/**
 * Calculate content quality bonus for ranking
 * Higher quality content creators get bonus points
 * @param {number} averageQualityScore - Average quality score (0-100)
 * @returns {number} Bonus points for ranking (0-200)
 */
function calculateQualityBonus(averageQualityScore) {
  // Scale quality score (0-100) to bonus points (0-200)
  // Users with 100% quality get 200 bonus points
  // Users with 50% quality get 100 bonus points
  // Users with 0% quality get 0 bonus points
  return Math.round((averageQualityScore / 100) * 200);
}

module.exports = {
  getQualityScoreFromCategory,
  calculateAverageQualityScore,
  updateContentStats,
  calculateQualityBonus,
};
