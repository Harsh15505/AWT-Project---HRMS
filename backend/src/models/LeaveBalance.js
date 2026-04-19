const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    casual:  { allocated: { type: Number, default: 12 }, used: { type: Number, default: 0 } },
    sick:    { allocated: { type: Number, default: 10 }, used: { type: Number, default: 0 } },
    annual:  { allocated: { type: Number, default: 15 }, used: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

// Compound unique: one balance record per employee per year
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });

// Virtual: remaining for each type
leaveBalanceSchema.virtual('remaining').get(function () {
  return {
    casual: this.casual.allocated - this.casual.used,
    sick:   this.sick.allocated   - this.sick.used,
    annual: this.annual.allocated - this.annual.used,
  };
});

leaveBalanceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
