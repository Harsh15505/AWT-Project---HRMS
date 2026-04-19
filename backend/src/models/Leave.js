const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Casual', 'Sick', 'Annual', 'LOP'],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate:   { type: Date, required: true },
    numberOfDays: { type: Number, required: true, min: 0.5 },
    reason:   { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approverRemarks: { type: String, trim: true },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for fast lookups
leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
