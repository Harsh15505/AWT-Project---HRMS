const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
const connectDB = require('../src/config/db');

const User = require('../src/models/User');

const seedAdmin = async () => {
    try {
        await connectDB();
        const existing = await User.findOne({ email: 'admin@hrms.com' });
        if (existing) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        await User.create({
            name: 'Admin',
            email: 'admin@hrms.com',
            password: 'admin123',
            role: 'Admin',
        });

        console.log('Admin user created successfully: admin@hrms.com / admin123');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err);
        process.exit(1);
    }
};

seedAdmin();