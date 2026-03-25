const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const Employee = require('../backend/src/models/Employee');

async function checkEmployees() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        const count = await Employee.countDocuments();
        console.log(`Total employees in database: ${count}`);
        const employees = await Employee.find().limit(5);
        console.log('Sample employees:', JSON.stringify(employees, null, 2));
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkEmployees();
