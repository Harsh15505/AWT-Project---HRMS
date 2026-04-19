const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month:         { type: Number, required: true },
  year:          { type: Number, required: true },
  baseSalary:    { type: Number, required: true },
  perDaySalary:  { type: Number, required: true },
  workingDays:   { type: Number, required: true },
  daysPresent:   { type: Number, default: 0 },
  halfDays:      { type: Number, default: 0 },
  lopDays:       { type: Number, default: 0 },
  grossSalary:   { type: Number, required: true },
  pfDeduction:   { type: Number, default: 0 },
  taxDeduction:  { type: Number, default: 0 },
  lopDeduction:  { type: Number, default: 0 },
  bonuses:       { type: Number, default: 0 },
  netSalary:     { type: Number, required: true },
  status:        { type: String, enum: ['Generated', 'Paid'], default: 'Generated' },
  generatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt:        { type: Date },
}, { timestamps: true });

// One payroll record per employee per month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
