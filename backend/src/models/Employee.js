const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dateOfBirth: { type: Date },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    designation: { type: String, required: true, trim: true },
    dateOfJoining: { type: Date, default: Date.now },
    employmentType: {
        type: String,
        enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
        default: 'Full-Time',
    },
    baseSalary: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },

    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        phone: { type: String },
    },
},
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }

);

employeeSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

employeeSchema.statics.generateEmployeeId = async function () {
    const last = await this.findOne().sort({ createdAt: -1 }).select('employeeId');
    if (!last) return 'EMP001';
    const num = parseInt(last.employeeId.replace('EMP', ''), 10) + 1;
    return `EMP${String(num).padStart(3, '0')}`;
};

module.exports = mongoose.model('Employee', employeeSchema);
