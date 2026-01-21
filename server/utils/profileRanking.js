/**
 * Profile Ranking System
 * Calculates user rank based on followers count and average rating
 */

/**
 * Rank tiers configuration
 */
const RANK_TIERS = [
  { name: 'Bronze', minScore: 0, maxScore: 50, color: '#CD7F32' },
  { name: 'Silver', minScore: 51, maxScore: 100, color: '#C0C0C0' },
  { name: 'Gold', minScore: 101, maxScore: 200, color: '#FFD700' },
  { name: 'Platinum', minScore: 201, maxScore: 350, color: '#E5E4E2' },
  { name: 'Diamond', minScore: 351, maxScore: 550, color: '#B9F2FF' },
  { name: 'Master', minScore: 551, maxScore: 800, color: '#9B59B6' },
  { name: 'Grandmaster', minScore: 801, maxScore: 1200, color: '#E74C3C' },
  { name: 'Legend', minScore: 1201, maxScore: Infinity, color: '#FF6B35' },
];

/**
 * Calculate profile rank score
 * @param {number} followersCount - Number of followers
 * @param {number} averageRating - Average rating (1-5)
 * @param {number} contentQualityScore - Average content quality score (0-100)
 * @returns {number} Rank score
 */
function calculateRankScore(followersCount = 0, averageRating = 0, contentQualityScore = 50) {
  // Formula: (followers * 10) + (averageRating * 20) + (qualityBonus)
  // Quality bonus: (contentQualityScore / 100) * 200
  // This rewards users who create high-quality content
  const followersScore = followersCount * 10;
  const ratingScore = averageRating * 20;
  const qualityBonus = Math.round((contentQualityScore / 100) * 200);
  return Math.round(followersScore + ratingScore + qualityBonus);
}

/**
 * Get rank tier based on score
 * @param {number} score - Rank score
 * @returns {Object} Rank tier object with name, color, etc.
 */
function getRankTier(score) {
  for (const tier of RANK_TIERS) {
    if (score >= tier.minScore && score <= tier.maxScore) {
      return {
        name: tier.name,
        color: tier.color,
        minScore: tier.minScore,
        maxScore: tier.maxScore,
        score: score,
      };
    }
  }
  // Default to Bronze if score is negative
  return {
    name: 'Bronze',
    color: RANK_TIERS[0].color,
    minScore: RANK_TIERS[0].minScore,
    maxScore: RANK_TIERS[0].maxScore,
    score: score,
  };
}

/**
 * Calculate user profile rank
 * @param {number} followersCount - Number of followers
 * @param {number} averageRating - Average rating
 * @param {number} contentQualityScore - Average content quality score (0-100)
 * @returns {Object} Complete rank information
 */
function calculateProfileRank(followersCount = 0, averageRating = 0, contentQualityScore = 50) {
  const score = calculateRankScore(followersCount, averageRating, contentQualityScore);
  const tier = getRankTier(score);
  
  return {
    rank: tier.name,
    rankScore: score,
    rankColor: tier.color,
    followersCount: followersCount,
    averageRating: averageRating.toFixed(1),
    contentQualityScore: contentQualityScore.toFixed(1),
    progress: {
      current: score,
      min: tier.minScore,
      max: tier.maxScore,
      percentage: tier.maxScore === Infinity 
        ? 100 
        : Math.round(((score - tier.minScore) / (tier.maxScore - tier.minScore)) * 100),
    },
  };
}

/**
 * Get all rank tiers (for display purposes)
 * @returns {Array} All rank tiers
 */
function getAllRankTiers() {
  return RANK_TIERS.map(tier => ({
    name: tier.name,
    color: tier.color,
    minScore: tier.minScore,
    maxScore: tier.maxScore === Infinity ? '∞' : tier.maxScore,
  }));
}

module.exports = {
  calculateProfileRank,
  calculateRankScore,
  getRankTier,
  getAllRankTiers,
  RANK_TIERS,
};

