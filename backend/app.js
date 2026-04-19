const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./src/middleware/errorMiddleware');
const authRoutes = require('./src/routes/authRoutes')
const employeeRoutes = require('./src/routes/employeeRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const leaveRoutes      = require('./src/routes/leaveRoutes');
const payrollRoutes    = require('./src/routes/payrollRoutes');
const dashboardRoutes  = require('./src/routes/dashboardRoutes');
const adminRoutes      = require('./src/routes/adminRoutes');
const rateLimit        = require('express-rate-limit');
const mongoSanitize    = require('express-mongo-sanitize');
const xss              = require('xss-clean');

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

const app = express();


app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use(mongoSanitize());
app.use(xss());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves',     leaveRoutes);
app.use('/api/payroll',    payrollRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/admin',      adminRoutes);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not Found' });
});

// Global Error Handler — must be defined LAST
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation error', errors });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Default
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
