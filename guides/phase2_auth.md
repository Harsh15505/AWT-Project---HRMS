# Phase 2 — Authentication & Role-Based Access Control (RBAC)

## 🎯 What You'll Build in This Phase
- User **registration** and **login** API endpoints
- **Password hashing** with bcryptjs
- **JWT token** generation and verification
- Backend **auth middleware** to protect routes
- **Role-based access** (Admin, HR Officer, Payroll Officer, Employee)
- React **Auth Context** (global login state)
- React **Login page** and **protected route** component

---

## 📚 Theory

### Authentication vs Authorization
These two words sound similar but mean very different things:

| Term | Meaning | Example |
|---|---|---|
| **Authentication** | *Who are you?* — verifying identity | Logging in with email + password |
| **Authorization** | *What can you do?* — checking permissions | Only Admin can delete users |

### What is a JWT (JSON Web Token)?
JWT is the industry standard for **stateless authentication**. When a user logs in, the server creates a signed token and sends it to the client. For future requests, the client sends this token back — and the server can verify it without looking up a database session.

A JWT has **3 parts** separated by dots:
```
xxxxx.yyyyy.zzzzz
Header.Payload.Signature
```

- **Header**: Algorithm used (e.g., HS256) + token type
- **Payload**: The data you store (user ID, role) — NOT encrypted, just encoded
- **Signature**: Server signs the header+payload with a secret key

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← Header (base64)
.eyJ1c2VySWQiOiI2NGYiLCJyb2xlIjoiQWRtaW4ifQ  ← Payload (base64)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c ← Signature
```

> ⚠️ **The payload is NOT encrypted.** Anyone can decode and read it. Never store passwords or sensitive info in a JWT. The signature just proves it hasn't been tampered with.

### Why Stateless Authentication?
Traditional sessions store session data on the server. JWTs store everything in the token itself. The server just needs to verify the signature — no database lookup needed for every request. This makes it scalable.

### What is bcrypt?
Bcrypt is a **password hashing function**. You should **never** store plain-text passwords. If your database is hacked, all passwords are exposed.

**Hashing** = one-way transformation. You can hash a password, but you can't reverse a hash back to a password.

When a user logs in, you hash what they typed and compare it to the stored hash.

```
"password123" → bcrypt.hash() → "$2b$10$N9qo8uLOickgx2ZMRZoMye..." (stored in DB)
```

The `10` is the **salt rounds** — how many times the algorithm runs. More rounds = slower but more secure. `10` is the standard.

### What is RBAC (Role-Based Access Control)?
Users are assigned **roles**, and roles determine **what they can access**.

```
Admin         → Full access to everything
HR Officer    → Manage employees, attendance, leaves
Payroll Officer → Generate payroll, view payslips
Employee      → View own data only
```

In practice, you create middleware that checks the user's role before allowing access to a route.

---

## 🗂️ Files You'll Create in This Phase

```
backend/
├── models/
│   └── User.js             ← User schema + password hashing
├── controllers/
│   └── authController.js   ← Register & login logic
├── routes/
│   └── authRoutes.js       ← /api/auth/register & /api/auth/login
├── middleware/
│   └── authMiddleware.js   ← protect & authorizeRoles

frontend/src/
├── context/
│   └── AuthContext.jsx     ← Global auth state
├── pages/
│   └── Login.jsx           ← Login page
├── components/
│   └── ProtectedRoute.jsx  ← Redirect if not logged in
```

---

## 🔧 Step-by-Step Implementation

### Step 1 — Create the User Model

📁 `backend/models/User.js`
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in query results by default
    },
    role: {
      type: String,
      enum: ['Admin', 'HR Officer', 'Payroll Officer', 'Employee'],
      default: 'Employee',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── Hash password BEFORE saving ──────────────────────────────
// This is a Mongoose "pre-save hook"
userSchema.pre('save', async function (next) {
  // Only hash if the password field was changed (e.g., not when updating email)
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare passwords ───────────────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

> 📝 **Code Breakdown:**
> - `new mongoose.Schema({ ... }, { timestamps: true })` — defines the shape of User documents. `timestamps: true` auto-adds `createdAt` and `updatedAt` fields to every document
> - `required: [true, 'Name is required']` — array syntax lets you provide a custom error message when validation fails
> - `unique: true` — MongoDB creates an index ensuring no two users can have the same email
> - `lowercase: true` — automatically converts the email to lowercase before saving (so `Alice@HRMS.com` and `alice@hrms.com` are treated the same)
> - `match: [regex, message]` — validates the email against a regex pattern; saves you from writing manual email validation
> - `select: false` on password — Mongoose will **never include** this field in query results by default. You must explicitly request it with `.select('+password')`
> - `enum: ['Admin', ...]` — only these exact strings are accepted as valid roles. Saves the document if valid, throws a `ValidationError` if not
> - `userSchema.pre('save', async function(next) {...})` — a **Mongoose lifecycle hook** that runs automatically before every `.save()`.
>   > ⚠️ **CRITICAL WARNING about Arrow Functions:** Do **NOT** use arrow functions `() => {}` here! Arrow functions change how `this` works in JavaScript. Mongoose specifically relies on `this` referring to the current document you are trying to save. If you use an arrow function, `this.password` will be `undefined` and your hashing will fail!
> - `this.isModified('password')` — checks if the password field was actually changed. Without this guard, every time you update any field (like email), the already-hashed password would be hashed again, breaking login
> - `bcrypt.genSalt(10)` — generates a random salt. The `10` is the cost factor — higher = slower hashing = harder to brute force
> - `bcrypt.hash(password, salt)` — combines the plain password + salt and runs the hashing algorithm, returning the hashed string
> - `userSchema.methods.comparePassword` — adds an **instance method** to every User document. Call it like `user.comparePassword('enteredPwd')`
> - `bcrypt.compare(entered, stored)` — compares plain text against the hash. Returns `true` if they match, `false` otherwise
> - `mongoose.model('User', userSchema)` — registers the schema as a model named `'User'`. MongoDB creates a collection called `users` (lowercase plural)

---

### 🔍 Deep Dive: How the Password Hashing Works

Let's look specifically at this block of code, which is arguably the most important security feature in your app:

```javascript
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
```

**1. The `pre('save')` Hook**
Mongoose allows us to intercept a document *right before* it gets saved to the database. By hooking into `save`, we ensure that no matter where in your app a user is created or updated, their password will **always** be hashed. You don't have to remember to hash it manually in your Controllers.

**2. The `.isModified` Guard Clause**
Suppose an employee updates their own profile `name` or `phone`. When Mongoose runs `.save()`, this hook triggers. If we didn't have `if (!this.isModified('password')) return next();`, Mongoose would take their *already hashed* password from the database, hash it a *second time*, and overwrite it. The user would be permanently locked out! This line ensures we only run hashing if the password itself was typed out as fresh plain-text in this specific save operation.

**3. Generating the `salt`**
A "salt" is a string of random characters (`$2a$10$N9qo8uLOickgx...`) added to the password *before* hashing. If two users both have the password `"password123"`, their final hashes will look completely different because they each get a unique random salt. The `10` refers to "salt rounds" — how many times the algorithm runs. `10` is roughly 10 rounds of cryptographic math, making it securely slow enough to thwart brute-force hacking attempts, but fast enough (milliseconds) that users don't notice the delay.

**4. The `.hash()` Function**
Finally, `bcrypt.hash()` combines your typed password (`"admin123"`) with the unique salt, scrambles it cryptographically, and replaces `this.password` with the scrambled output.
Only then do we call `next()`, signaling to Mongoose: *"I'm done modifying the document, you may proceed with saving it to MongoDB!"*

**Key concepts here:**
- `select: false` on password — Mongoose won't include the password field in query results unless you explicitly ask for it (`.select('+password')`)
- `pre('save')` hook — runs automatically before every `.save()` call
- `isModified('password')` — prevents re-hashing the password when updating other fields
- `comparePassword` — a clean method to verify login attempts

---

### Step 2 — Create a JWT Utility

📁 `backend/utils/generateToken.js`
```javascript
const jwt = require('jsonwebtoken');

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },          // Payload — what's stored inside the token
    process.env.JWT_SECRET,    // Secret key used to sign
    { expiresIn: '7d' }        // Token expires in 7 days
  );
};

module.exports = generateToken;
```

> 📝 **Code Breakdown:**
> - `jwt.sign(payload, secret, options)` — creates the JWT. It encodes `payload` into the token and signs it with the `secret` so you can verify it wasn't tampered with later
> - `{ userId, role }` — the **payload** stored inside the token. This data can be read by anyone who decodes the token, so only store non-sensitive info here
> - `process.env.JWT_SECRET` — the signing secret from `.env`. Must match the key used in `jwt.verify()` later
> - `{ expiresIn: '7d' }` — automatically adds an expiry. After 7 days the token is invalid and the user must log in again. Other formats: `'1h'`, `'30m'`, `'86400'` (seconds)

### Step 3 — Validation Rules (Auth)

Using `express-validator` keeps our controllers skinny by offloading error checks to middleware.

📁 `backend/middleware/validators.js`
```javascript
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['Admin', 'HR Officer', 'Payroll Officer', 'Employee']).withMessage('Invalid role'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = { validate, registerRules, loginRules };
```

---

### Step 4 — Auth Controller (Register & Login)

📁 `backend/controllers/authController.js`
```javascript
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { asyncHandler } = require('../middleware/errorMiddleware');

// ─── REGISTER ─────────────────────────────────────────────────
// @route  POST /api/auth/register
// @access Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  // Create the user — password is hashed automatically via pre-save hook
  const user = await User.create({ name, email, password, role });

  // Generate token
  const token = generateToken(user._id, user.role);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ─── LOGIN ────────────────────────────────────────────────────
// @route  POST /api/auth/login
// @access Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation is now handled by express-validator middleware

  // Find user — use .select('+password') to include the hidden password field
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    res.status(403);
    throw new Error('Your account has been deactivated. Contact admin.');
  }

  // Compare passwords
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Generate token
  const token = generateToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ─── GET CURRENT USER ─────────────────────────────────────────
// @route  GET /api/auth/me
// @access Private (requires token)
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user.userId);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { registerUser, loginUser, getMe };
```

> 📝 **Code Breakdown:**
> - `const { name, email, password, role } = req.body` — **destructuring**: extracts named fields from `req.body` in one line instead of writing `req.body.name`, `req.body.email`, etc.
> - `await User.findOne({ email })` — searches the `users` collection for a document where `email` matches. Returns `null` if not found
> - `return res.status(400).json(...)` — `return` is important here! Without it, Express would continue running the rest of the function even after sending this response, causing a "headers already sent" error
> - `await User.create({ ... })` — creates a new document in MongoDB. This triggers the `pre('save')` hook, which automatically hashes the password before storing it
> - `res.status(201)` — `201 Created` is the correct HTTP status code when a new resource is successfully created (as opposed to `200 OK` for reads/updates)
> - `User.findOne({ email }).select('+password')` — normally password is hidden (`select: false`). The `+` prefix explicitly opts it back in for this one query
> - `'Invalid credentials'` — intentionally vague: don't reveal whether the email exists or the password is wrong, as that information helps attackers
> - `user.isActive` — if an admin deactivated the account, login is blocked at the application level (regardless of correct password)
> - `await user.comparePassword(password)` — calls the instance method we defined on the schema to safely compare the entered password against the stored bcrypt hash
> - `req.user.userId` in `getMe` — this was set by the `protect` middleware on the request object; it's the decoded JWT payload

---

### Step 5 — Auth Routes

📁 `backend/routes/authRoutes.js`
```javascript
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { registerRules, loginRules, validate } = require('../middleware/validators');

router.post('/register', registerRules, validate, registerUser);
router.post('/login', loginRules, validate, loginUser);
router.get('/me', protect, getMe); // Protected — requires token

module.exports = router;
```

---

### Step 6 — Auth Middleware (protect & authorizeRoles)

📁 `backend/middleware/authMiddleware.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── protect ──────────────────────────────────────────────────
// Verifies JWT token — use this on any protected route
const protect = async (req, res, next) => {
  let token;

  // Tokens are sent in the Authorization header as: "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Extract the token part
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  try {
    // Verify token — throws error if invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { userId: '...', role: 'Admin', iat: ..., exp: ... }

    req.user = decoded; // Attach user info to request object
    next(); // Pass control to the next middleware/route handler
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Not authorized — invalid token' });
  }
};

// ─── authorizeRoles ───────────────────────────────────────────
// Checks if logged-in user has the required role(s)
// Usage: authorizeRoles('Admin', 'HR Officer')
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
```

> 📝 **Code Breakdown:**
> - `protect` — verifies identity: "Are you logged in?"
> - `req.headers.authorization?.startsWith('Bearer')` — tokens are standardized to be sent in the `Authorization` HTTP header with a `Bearer ` prefix
> - `jwt.verify(token, ...)` — uses your secret to mathematically verify the token wasn't forged. If valid, it returns the decoded payload (e.g. `{ userId: '...', role: 'Admin' }`)
> - `req.user = decoded` — attaches the parsed user data to the Express request object so the next function in the chain can use it
> - `TokenExpiredError` — `jwt.verify` throws a specific error if the token has passed its expiration date
> - `authorizeRoles(...roles)` — a function that takes a list of allowed roles and returns a middleware function that checks if `req.user.role` (which we got from `protect`) is in the allowed list
> - `next()` — a required Express callback that tells the framework to move on to the actual route handler. If you don't call `next()` or send a `res`, the request hangs forever

**How `authorizeRoles` works:**
It's a function that returns a middleware function. This pattern is called a **middleware factory** or **higher-order function**. You call it like:
```javascript
router.delete('/user/:id', protect, authorizeRoles('Admin'), deleteUser);
// Only Admins can delete users
```

---

### Step 7 — Register Routes in app.js

📁 `backend/app.js` (add these lines)
```javascript
const authRoutes = require('./routes/authRoutes');

// Add after existing middleware:
app.use('/api/auth', authRoutes);
```

---

### Step 8 — Create the Seed Script (First Admin User)

📁 `backend/scripts/seedAdmin.js`
```javascript
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: '../.env' }); // Adjust path as needed

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existing = await User.findOne({ email: 'admin@hrms.com' });
    if (existing) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    await User.create({
      name: 'Super Admin',
      email: 'admin@hrms.com',
      password: 'admin123',
      role: 'Admin',
    });

    console.log('✅ Admin user created: admin@hrms.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedAdmin();
```

Run it once:
```bash
node scripts/seedAdmin.js
```

---

### Step 9 — React Auth Context

📁 `frontend/src/context/AuthContext.jsx`
```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('hrms_token'));
  const [loading, setLoading] = useState(true);

  // On app load, if a token exists, fetch the current user
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const { data } = await API.get('/auth/me');
          setUser(data.user);
        } catch {
          // Token is invalid or expired
          logout();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const login = (userData, authToken) => {
    localStorage.setItem('hrms_token', authToken);
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('hrms_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook — cleaner than calling useContext(AuthContext) everywhere
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
```

> 📝 **Code Breakdown:**
> - `createContext` — creates a global state context that any React component can access without needing to pass props down multiple levels
> - `localStorage.getItem('hrms_token')` — checks if the user previously logged in, surviving browser refreshes
> - `useEffect(() => { loadUser() }, [token])` — runs when the app starts or when the token changes. It asks the backend `/auth/me` to verify the token and return the user profile
> - `login(userData, authToken)` — called by the Login page. Saves the token to localStorage and updates the state, instantly telling the rest of the app "This user is now logged in"
> - `logout()` — wipes the token and state, telling the app "The user is gone"
> - `AuthContext.Provider` — wraps the whole React app, injecting the `{ user, login, logout }` values down to every component
> - `useAuth` — a custom hook so other components can just do `const { user } = useAuth()` instead of importing `useContext` and `AuthContext` separately

Wrap your app with the provider in `main.jsx`:

📁 `frontend/src/main.jsx`
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

---

### Step 9 — Protected Route Component

📁 `frontend/src/components/ProtectedRoute.jsx`
```jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// roles: optional array of allowed roles e.g. ['Admin', 'HR Officer']
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → redirect to home (or show 403)
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

> 📝 **Code Breakdown:**
> - `<ProtectedRoute>` — a wrapper component we'll put around pages that require login (like dashboards). If a user isn't allowed to see the page, this component prevents it from rendering
> - `const { user, loading } = useAuth()` — grabs the current login state from the context we just built
> - `if (loading)` — prevents a flicker. While `/auth/me` is checking the token on initial load, show "Loading..." instead of instantly kicking them to the login screen
> - `if (!user)` — if no one is logged in, use React Router's `<Navigate>` to instantly redirect them to the `/login` page
> - `if (roles && !roles.includes(user.role))` — if the route requires an `'Admin'` and the user is an `'Employee'`, kick them to their default dashboard
> - `return children` — if all checks pass, render whatever component is wrapped inside (e.g., the actual dashboard page)

---

### Step 10 — Login Page

📁 `frontend/src/pages/Login.jsx`
```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await API.post('/auth/login', formData);
      login(data.user, data.token); // Store user + token in context

      // Redirect based on role
      const roleRoutes = {
        Admin: '/admin/dashboard',
        'HR Officer': '/hr/dashboard',
        'Payroll Officer': '/payroll/dashboard',
        Employee: '/employee/dashboard',
      };
      navigate(roleRoutes[data.user.role] || '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏢 HRMS</h1>
        <h2 style={styles.subtitle}>Sign In</h2>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="admin@hrms.com"
            />
          </div>

          <div style={styles.field}>
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    width: '100%',
    maxWidth: '420px',
  },
  title: { textAlign: 'center', fontSize: '2rem', marginBottom: '0.25rem' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: '1.5rem', fontWeight: 400 },
  error: {
    background: '#fee', border: '1px solid #fcc', color: '#c00',
    padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  input: {
    padding: '0.75rem 1rem', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '1rem', outline: 'none',
  },
  button: {
    padding: '0.85rem', background: '#667eea', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '1rem',
    cursor: 'pointer', fontWeight: '600', marginTop: '0.5rem',
  },
};

export default Login;
```

> 📝 **Code Breakdown:**
> - `const [formData, setFormData] = useState(...)` — state to hold what the user types in the email and password boxes
> - `handleChange` — dynamically updates `formData` based on which input triggered it (`e.target.name`)
> - `e.preventDefault()` — stops the browser from doing a full page refresh when the form is submitted
> - `await API.post('/auth/login', formData)` — makes the HTTP request to our backend login route using Axios
> - `login(data.user, data.token)` — calls our AuthContext function, which saves the token to localStorage and sets the global `user` state
> - `const roleRoutes = { ... }` — a dictionary mapping each role to their specific dashboard URL
> - `navigate(...)` — uses React Router to immediately send the user to the correct dashboard after successful login
> - `catch (err)` — if login fails (401 invalid credentials), we catch the error message sent by the backend and display it to the user

---

### Step 11 — Update App.jsx with Routes

📁 `frontend/src/App.jsx`
```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

// Placeholder dashboards (create simple components for now)
const AdminDashboard = () => <h1>Admin Dashboard 🛡️</h1>;
const HRDashboard = () => <h1>HR Dashboard 👔</h1>;
const PayrollDashboard = () => <h1>Payroll Dashboard 💰</h1>;
const EmployeeDashboard = () => <h1>Employee Dashboard 👤</h1>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/hr/dashboard" element={
          <ProtectedRoute roles={['Admin', 'HR Officer']}>
            <HRDashboard />
          </ProtectedRoute>
        } />

        <Route path="/payroll/dashboard" element={
          <ProtectedRoute roles={['Admin', 'Payroll Officer']}>
            <PayrollDashboard />
          </ProtectedRoute>
        } />

        <Route path="/employee/dashboard" element={
          <ProtectedRoute roles={['Admin', 'HR Officer', 'Payroll Officer', 'Employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        } />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

## ⚠️ Edge Cases & Gotchas

### 1. Always use `.select('+password')` when logging in
```javascript
// ❌ Wrong — password won't be present, comparePassword will fail
const user = await User.findOne({ email });

// ✅ Correct
const user = await User.findOne({ email }).select('+password');
```

### 2. Don't re-hash the password on update
The `pre('save')` hook runs on every `.save()`. If you change only the email and call `.save()`, without the `isModified('password')` guard, the password would be hashed again → login breaks.

### 3. Vague error messages on login failure
Don't say "Email not found" or "Wrong password" separately — attackers can use this to enumerate valid emails. Always say "Invalid credentials" for both cases.

### 4. JWT secret must be strong in production
```env
# ❌ Weak
JWT_SECRET=secret

# ✅ Strong (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=a9f2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

### 5. Handle token expiry on the frontend
In `api.js`, add a response interceptor:
```javascript
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hrms_token');
      window.location.href = '/login'; // Force logout
    }
    return Promise.reject(error);
  }
);
```

### 6. `loading` state prevents flash of unauthenticated content
Without the `loading` check in `ProtectedRoute`, a logged-in user visiting `/admin/dashboard` would briefly see a redirect to `/login` before the user data loads. The `loading` state prevents this flash.

### 7. HTTP-only cookies vs localStorage
Storing JWTs in `localStorage` is simple but vulnerable to **XSS (Cross-Site Scripting)** attacks. For higher security, use `httpOnly` cookies — JavaScript can't read them, only the browser sends them automatically. For a learning project, `localStorage` is acceptable.

---

## ✅ Phase 2 Checklist
- [ ] `models/User.js` — schema with password hashing hook
- [ ] `utils/generateToken.js` — JWT generator
- [ ] `controllers/authController.js` — register, login, getMe
- [ ] `routes/authRoutes.js` — auth routes
- [ ] `middleware/authMiddleware.js` — protect & authorizeRoles
- [ ] Server routes registered in `app.js`
- [ ] Admin seeded (`node scripts/seedAdmin.js`)
- [ ] Tested register & login with Postman / Thunder Client
- [ ] `context/AuthContext.jsx` — React global auth state
- [ ] `components/ProtectedRoute.jsx` — route guard
- [ ] `pages/Login.jsx` — login form
- [ ] `App.jsx` — routes with protection

---

## 🔗 What's Next?
**Phase 3** — Employee profile management: creating, viewing, editing employees, and linking them to departments.
