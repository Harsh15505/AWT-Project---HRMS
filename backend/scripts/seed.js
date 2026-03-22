const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Employee = require('../src/models/Employee');

dotenv.config({ path: '../.env' });

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding...');

        // 1. Clear existing data (Optional, but good for a fresh start)
        await User.deleteMany();
        await Department.deleteMany();
        await Employee.deleteMany();
        console.log('Existing data cleared.');

        // 2. Create Departments
        const departments = await Department.insertMany([
            { name: 'Engineering', code: 'ENG', description: 'Software and Infrastructure' },
            { name: 'Human Resources', code: 'HR', description: 'People and Culture' },
            { name: 'Marketing', code: 'MKT', description: 'Growth and Branding' }
        ]);
        console.log('Departments seeded.');

        // 3. Create Admin and HR Users
        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@hrms.com',
            password: 'password123',
            role: 'Admin'
        });

        const hrUser = await User.create({
            name: 'HR Manager',
            email: 'hr@hrms.com',
            password: 'password123',
            role: 'HR Officer'
        });
        console.log('Users seeded (Admin & HR).');

        // 4. Create Initial Employees
        const employeeId1 = await Employee.generateEmployeeId();
        await Employee.create({
            employeeId: employeeId1,
            firstName: 'John',
            lastName: 'Doe',
            gender: 'Male',
            department: departments[0]._id, // Engineering
            designation: 'Senior Developer',
            baseSalary: 85000,
            phone: '1234567890',
            address: '123 Tech Lane',
            dateOfJoining: new Date(),
            employmentType: 'Full-Time'
        });

        const employeeId2 = await Employee.generateEmployeeId();
        await Employee.create({
            employeeId: employeeId2,
            firstName: 'Jane',
            lastName: 'Smith',
            gender: 'Female',
            department: departments[1]._id, // HR
            designation: 'HR Specialist',
            baseSalary: 60000,
            phone: '0987654321',
            address: '456 People Street',
            dateOfJoining: new Date(),
            employmentType: 'Full-Time'
        });
        console.log('Initial employees seeded.');

        console.log('Seeding completed successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
