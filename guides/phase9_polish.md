# Phase 9 — Polish, Security & Testing

## 🎯 What You'll Do
- Add **input validation** on all backend routes (express-validator)
- Add **rate limiting** to prevent brute-force attacks
- Enforce **security headers** (helmet)
- Create a consistent **API error response structure**
- Add **frontend form validation** and user feedback
- Add **loading, empty, and error states** to all pages
- **Manually test** every user flow end-to-end per role

---

## 📚 Theory

### Why Validate on Both Frontend AND Backend?
- **Frontend validation** = fast feedback for the user (no network round trip)
- **Backend validation** = the real security gate

Never trust the client. A user can bypass frontend validation using tools like Postman/curl. Always validate on the server.

### What is Rate Limiting?
Rate limiting restricts how many requests a client can make in a given timeframe. Without it, an attacker can:
- Brute-force login passwords at thousands of tries/second
- DDOS your API with millions of requests

```
Client → 6th request in 1 minute → 429 Too Many Requests
```

### What are Security Headers?
HTTP response headers can tell the browser how to behave securely. `helmet` sets these automatically:

| Header | Purpose |
|---|---|
| `X-Frame-Options` | Prevent clickjacking (embedding in iframes) |
| `Content-Security-Policy` | Control which scripts/resources can load |
| `X-Content-Type-Options` | Prevent MIME-type sniffing |
| `Strict-Transport-Security` | Force HTTPS |

### Consistent API Response Shape
All your API responses should follow a predictable structure so the frontend can handle them uniformly:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "message": "Something went wrong", "errors": [ ... ] }
```

---

## 🔧 Implementation

### Step 1 — Install Missing Security Packages

```bash
cd backend
npm install express-rate-limit express-mongo-sanitize xss-clean
```

| Package | Purpose |
|---|---|
| `express-rate-limit` | Limit requests per IP |
| `express-mongo-sanitize` | Strip `$` and `.` from inputs (prevent NoSQL injection) |
| `xss-clean` | Strip HTML tags from inputs (prevent XSS) |

---

### Step 2 — Add Security Middleware to app.js

📁 `backend/app.js` (add after existing middleware)
```javascript
const rateLimit        = require('express-rate-limit');
const mongoSanitize    = require('express-mongo-sanitize');
const xss              = require('xss-clean');

// ─── Rate Limiting ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // max 200 requests per IP per window
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
});

// Stricter limiter for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // only 10 login attempts per 15 min
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter); // Apply before auth router
app.use(mongoSanitize());  // NoSQL injection prevention
app.use(xss());            // XSS prevention
```

> 📝 **Code Breakdown:**
> - `rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })` — tracks the IP addresses of everyone making requests to your API. If any single IP makes more than 200 requests within a 15-minute rolling window, the server automatically starts rejecting them with a `429 Too Many Requests` status
> - `authLimiter` — we apply a much stricter rate limit specifically to the `/api/auth/login` route. This prevents attackers from running automated scripts that try thousands of password combinations per minute (brute forcing)
> - `mongoSanitize()` — malicious users sometimes send JSON containing MongoDB operators like `$gt` in fields that should just be strings (e.g., `{"email": {"$gt": ""}}`). This middleware intercepts incoming JSON and strips out any keys starting with `$` or `.`
> - `xss()` — strips malicious `<script>` tags from incoming user data so they can't be saved to the database and executed on another user's browser later

---

### Step 3 — Input Validation with express-validator

Example: validate the register endpoint.

📁 `backend/middleware/validators.js`
```javascript
const { body, validationResult } = require('express-validator');

// Middleware to check validation results
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

// Register validation rules
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['Admin','HR Officer','Payroll Officer','Employee']).withMessage('Invalid role'),
];

// Login validation rules
const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Leave application rules
const leaveRules = [
  body('leaveType').isIn(['Casual','Sick','Annual','LOP']).withMessage('Invalid leave type'),
  body('fromDate').isISO8601().withMessage('Valid from date required'),
  body('toDate').isISO8601().withMessage('Valid to date required'),
  body('reason').trim().notEmpty().withMessage('Reason is required').isLength({ max: 500 }).withMessage('Reason too long'),
];

module.exports = { validate, registerRules, loginRules, leaveRules };
```

> 📝 **Code Breakdown:**
> - `validationResult(req)` — after the individual rules run, this gathers up all the errors (if any) that were generated
> - `body('email').isEmail().normalizeEmail()` — checks that the field is actually an email format, and `normalizeEmail` cleans it up (e.g., converting `Alice@Example.com` to `alice@example.com`)
> - `body('password').isLength({ min: 6 })` — enforces a strict minimum password length on the server, ensuring that frontend validation bypasses still fail
> - `body('leaveType').isIn([...])` — guarantees that the user didn't try to submit a made-up leave type string

Apply to routes:

📁 `backend/routes/authRoutes.js` (updated)
```javascript
const { validate, registerRules, loginRules } = require('../middleware/validators');

router.post('/register', registerRules, validate, registerUser);
router.post('/login',    loginRules,    validate, loginUser);
```

📁 `backend/routes/leaveRoutes.js` (updated)
```javascript
const { validate, leaveRules } = require('../middleware/validators');

router.post('/', leaveRules, validate, applyLeave);
```

---

### Step 4 — Global Error Handler (Update app.js)

Replace the basic error handler with a smarter one:

📁 `backend/app.js`
```javascript
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
```

> 📝 **Code Breakdown:**
> - `app.use((err, req, res, next) => { ... })` — By defining an Express middleware with exactly 4 arguments, Express knows this is the global error handler. Any route that calls `throw new Error()` or `next(err)` will end up here
> - `if (err.name === 'ValidationError')` — intercepts Mongoose validation failures (e.g., a required field was missing) and reformats the ugly Mongoose error object into a clean array of `{ field, message }` objects for the frontend
> - `if (err.code === 11000)` — the MongoDB error code for "Duplicate Key" (e.g., trying to register an email that already exists). We catch this specific number to give the user a helpful "email already exists" message instead of a generic server crash
> - `JsonWebTokenError` and `TokenExpiredError` — catch scenarios where the user's login session is invalid or has timed out

---

### Step 5 — Frontend: Reusable Error & Loading Components

📁 `frontend/src/components/LoadingSpinner.jsx`
```jsx
import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%',
      border: '4px solid #f0f4ff', borderTop: '4px solid #667eea',
      animation: 'spin 0.8s linear infinite',
    }} />
    <p style={{ color: '#888', fontSize: '0.9rem' }}>{message}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingSpinner;
```

📁 `frontend/src/components/EmptyState.jsx`
```jsx
import React from 'react';

const EmptyState = ({ icon = '📭', title = 'Nothing here', subtitle = '' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: '#888' }}>
    <div style={{ fontSize: '3rem' }}>{icon}</div>
    <h3 style={{ margin: 0, color: '#555' }}>{title}</h3>
    {subtitle && <p style={{ margin: 0, fontSize: '0.9rem' }}>{subtitle}</p>}
  </div>
);

export default EmptyState;
```

📁 `frontend/src/components/ErrorMessage.jsx`
```jsx
import React from 'react';

const ErrorMessage = ({ message, onRetry }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
    <div style={{ fontSize: '2.5rem' }}>⚠️</div>
    <p style={{ color: '#c00', fontWeight: 600 }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry}
        style={{ padding: '0.6rem 1.5rem', background: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        Try Again
      </button>
    )}
  </div>
);

export default ErrorMessage;
```

---

### Step 6 — Wrap API Calls with a Custom Hook

This pattern keeps your pages clean — no scattered try/catch blocks everywhere.

📁 `frontend/src/hooks/useFetch.js`
```javascript
import { useState, useEffect } from 'react';

const useFetch = (fetchFn, deps = []) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetchFn();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, deps);

  return { data, loading, error, refetch: load };
};

export default useFetch;
```

> 📝 **Code Breakdown:**
> - `const load = async () => ...` — wraps the provided generic API call into a try/catch block that automatically manages React state (loading spinners and error messages) so you don't have to rewrite this boilerplate on every single page
> - `useEffect(() => { load(); }, deps)` — runs the fetch exactly once when the component mounts, or re-runs it if any of the dependencies in the `deps` array change
> - `return { data, loading, error, refetch: load }` — returns the state variables, plus the `load` function itself renamed as `refetch`, so the component can manually trigger a data refresh (e.g., after deleting an item)

Usage example:
```jsx
// Before (messy)
const [employees, setEmployees] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
useEffect(() => {
  setLoading(true);
  getAllEmployees().then(({ data }) => setEmployees(data.employees))
    .catch((e) => setError(e.message)).finally(() => setLoading(false));
}, []);

// After (clean with useFetch)
const { data, loading, error, refetch } = useFetch(() => getAllEmployees());
const employees = data?.employees || [];
```

---

### Step 7 — Manual Testing Checklist

Run through each role end-to-end:

#### 🔐 Auth Tests
- [ ] Register a new user → verify token returned
- [ ] Login with wrong password → expect "Invalid credentials"
- [ ] Access a protected route without token → expect 401
- [ ] Access admin route as Employee → expect 403
- [ ] Token expiry: wait for expiry / tamper token → expect 401

#### 👥 Employee Tests
- [ ] Admin creates a new employee + user account
- [ ] Employee logs in and sees own profile only
- [ ] Employee cannot access `/api/employees` (all employees list)
- [ ] Employee updates own profile via HR
- [ ] Admin deactivates employee → their login returns 403

#### 📅 Attendance Tests
- [ ] HR marks attendance for a specific date
- [ ] HR marks attendance twice for the same date → record is updated, not duplicated
- [ ] Employee views their own attendance calendar
- [ ] Monthly summary returns correct counts

#### 🌴 Leave Tests
- [ ] Employee applies for leave on a valid date → Pending status
- [ ] Employee applies for overlapping dates → error returned
- [ ] Employee applies with insufficient balance → error returned
- [ ] HR approves leave → balance is reduced
- [ ] HR rejects leave → balance unchanged
- [ ] Employee cancels a Pending leave → status set to Cancelled

#### 💰 Payroll Tests
- [ ] Run payroll for one employee for current month
- [ ] Verify net salary formula is correct manually
- [ ] Run payroll twice → same record, not duplicate
- [ ] Payslip renders correctly in browser
- [ ] Print/PDF button works (Ctrl+P opens print dialog)

#### 📊 Dashboard Tests
- [ ] Admin dashboard shows correct employee counts
- [ ] HR dashboard pie chart shows attendance breakdown
- [ ] Payroll dashboard line chart shows monthly trend
- [ ] Employee dashboard shows correct leave balance

---

## ⚠️ Common Bugs Found During Testing

### 1. Mongoose `_id` vs string comparison
```javascript
// ❌ Will always be false — ObjectId !== string
if (leave.employee === employeeId) ...

// ✅ Correct
if (leave.employee.toString() === employeeId.toString()) ...
```

### 2. React state update on unmounted component
If an async fetch completes after the component is unmounted (e.g., user navigated away), React shows a warning. Fix with a cleanup flag:
```javascript
useEffect(() => {
  let mounted = true;
  fetchData().then(data => { if (mounted) setData(data); });
  return () => { mounted = false; };
}, []);
```

### 3. CORS errors in production
In development, the Vite proxy handles CORS. In production (when frontend and backend are separate domains), configure CORS properly:
```javascript
cors({ origin: process.env.FRONTEND_URL, credentials: true })
```

### 4. `select: false` on password — use explicit `.select('+password')`
Only in the login route. Forgetting this means `user.password` is `undefined` and `comparePassword` always fails.

---

## ✅ Phase 9 Checklist
- [ ] `express-rate-limit`, `express-mongo-sanitize`, `xss-clean` installed
- [ ] Rate limiter + NoSQL sanitize + XSS added to `app.js`
- [ ] `middleware/validators.js` created with rules for auth and leave
- [ ] Validators applied to `authRoutes.js` and `leaveRoutes.js`
- [ ] Global error handler updated in `app.js`
- [ ] `components/LoadingSpinner.jsx` created
- [ ] `components/EmptyState.jsx` created
- [ ] `components/ErrorMessage.jsx` created
- [ ] `hooks/useFetch.js` created and used in at least 2 pages
- [ ] All manual test scenarios from checklist passed

---

## 🔗 What's Next?
**Phase 10** — Final Delivery: README, demo seed data, cleanup, and GitHub push.
