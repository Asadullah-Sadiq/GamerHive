const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  totalTournamentsCreated: {
    type: Number,
    default: 0,
    required: true,
  },
}, {
  timestamps: true,
});

// Ensure only one stats document exists
statsSchema.statics.getOrCreate = async function() {
  let stats = await this.findOne();
  if (!stats) {
    stats = await this.create({ totalTournamentsCreated: 0 });
  }
  return stats;
};

const Stats = mongoose.model('Stats', statsSchema);

module.exports = Stats;

