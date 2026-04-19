const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const SystemSetting = require('../src/models/SystemSetting');

const defaults = [
  { key: 'company_name',       value: 'HRMS Corporation',      label: 'Company Name' },
  { key: 'casual_leave_quota', value: 12,                       label: 'Casual Leave Quota / Year' },
  { key: 'sick_leave_quota',   value: 10,                       label: 'Sick Leave Quota / Year' },
  { key: 'annual_leave_quota', value: 15,                       label: 'Annual Leave Quota / Year' },
  { key: 'working_days_week',  value: 5,                        label: 'Working Days per Week' },
  { key: 'pf_percentage',      value: 12,                       label: 'PF Deduction %' },
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  for (const s of defaults) {
    await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('✅ System settings seeded');
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
