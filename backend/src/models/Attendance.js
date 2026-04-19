const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Half-Day', 'On-Leave', 'Holiday'],
      required: true,
    },
    checkIn:  { type: String }, // "09:05 AM" — stored as string for simplicity
    checkOut: { type: String }, // "06:00 PM"
    notes:    { type: String, trim: true },

    // Track who marked this (HR/Admin)
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Convenience fields for fast aggregation queries (avoid date math every time)
    month: { type: Number, required: true }, // 1–12
    year:  { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound unique index — one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Index for fast monthly queries
attendanceSchema.index({ employee: 1, month: 1, year: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
