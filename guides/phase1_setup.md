# Phase 1 — Project Setup & Architecture

## 🎯 What You'll Build in This Phase
By the end of this phase you will have:
- A working **Express.js backend** connected to **MongoDB**
- A **React + Vite frontend** running on a dev server
- A clean **folder structure** you'll use for the entire project
- Environment variable configuration
- A proxy set up so React can talk to your Express API

---

## 📚 Theory

### What is Node.js?
Node.js is a **JavaScript runtime** built on Chrome's V8 engine. It lets you run JavaScript *outside* the browser — on your computer or a server. Before Node.js, JavaScript could only run in browsers.

Key properties:
- **Non-blocking / Asynchronous**: Node doesn't wait for one task to finish before starting another. It uses an **event loop** to handle multiple requests efficiently.
- **Single-threaded**: Node runs on one thread, but handles concurrency through callbacks, Promises, and async/await.
- **npm (Node Package Manager)**: The world's largest software registry — you use it to install libraries.

### What is Express.js?
Express is a **minimal web framework for Node.js**. It makes building APIs easy by giving you:
- **Routing** — map URLs to functions (`GET /api/employees`)
- **Middleware** — functions that run before your route handler (e.g., parse JSON body, check auth token)
- **Error handling** — catch problems centrally

### What is React + Vite?
**React** is a JavaScript library for building user interfaces using reusable **components**. Each component is a function that returns JSX (HTML-like syntax in JS).

**Vite** is a modern build tool and dev server. It replaces Create React App and is significantly faster because it uses native ES modules during development instead of bundling everything upfront.

### What is MongoDB?
MongoDB is a **NoSQL database** — instead of storing data in tables (like MySQL), it stores data in **documents** (JSON-like objects called BSON). A collection in MongoDB = a table in SQL. A document = a row.

Example document:
```json
{
  "_id": "abc123",
  "name": "Alice",
  "role": "Employee",
  "email": "alice@company.com"
}
```

### What is Mongoose?
Mongoose is an **ODM (Object Data Modeling)** library for MongoDB in Node.js. It lets you:
- Define **schemas** (the shape of your data)
- Create **models** (a class that represents a collection)
- Do validation, type casting, and query building easily

### What is a .env file?
A `.env` file stores **environment variables** — configuration values that shouldn't be hardcoded in your code (like database passwords, secret keys, port numbers). The `dotenv` npm package reads these into `process.env`.

---

## 🗂️ Final Folder Structure for This Phase

```
HRMS PROJECT/
├── backend/
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── .env                   ← secret config
│   ├── .gitignore
│   ├── package.json
│   ├── app.js                 ← Express app
│   └── server.js              ← Entry point
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── context/
    │   ├── services/           ← API call functions
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    ├── index.html
    └── vite.config.js
```

---

## 🔧 Step-by-Step Implementation

### Step 1 — Create the root project folder

```bash
mkdir "HRMS PROJECT"
cd "HRMS PROJECT"
git init
```

Create a root `.gitignore`:

```gitignore
# root .gitignore
node_modules/
.env
dist/
```

---

### Step 2 — Set up the Backend

```bash
mkdir backend
cd backend
npm init -y
```

Install backend dependencies:

```bash
npm install express mongoose dotenv cors morgan helmet bcryptjs jsonwebtoken express-validator
npm install --save-dev nodemon
```

**What each package does:**
| Package | Purpose |
|---|---|
| `express` | Web framework / routing |
| `mongoose` | MongoDB ODM |
| `dotenv` | Load `.env` variables |
| `cors` | Allow cross-origin requests from React |
| `morgan` | HTTP request logger (for dev) |
| `helmet` | Sets secure HTTP headers |
| `bcryptjs` | Hash passwords |
| `jsonwebtoken` | Create & verify JWT tokens |
| `express-validator` | Validate request inputs |
| `nodemon` | Auto-restart server on file changes |

Update `package.json` scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

### Step 3 — Create the `.env` file

📁 `backend/.env`
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/hrmsdb
JWT_SECRET=your_super_secret_key_change_this_in_production
NODE_ENV=development
```

> ⚠️ **Never commit `.env` to GitHub.** Add it to `.gitignore`.

---

### Step 4 — MongoDB Connection

📁 `backend/config/db.js`
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure code
  }
};

module.exports = connectDB;
```

> 📝 **Code Breakdown:**
> - `require('mongoose')` — imports Mongoose so we can use it to talk to MongoDB
> - `async () => {}` — `async` means this function can use `await` inside to pause and wait for Promises to resolve
> - `await mongoose.connect(process.env.MONGO_URI)` — connects to the DB URL stored in `.env`. `await` pauses until the connection is ready
> - `conn.connection.host` — prints which host Mongoose connected to (e.g. `localhost`), confirming the right DB is used
> - `catch (error)` — if anything fails (wrong URL, MongoDB not running), code jumps here instead of crashing silently
> - `process.exit(1)` — forcefully stops Node.js. Code `1` means failure. Process managers like PM2 will automatically restart the server
> - `module.exports = connectDB` — exports the function so `server.js` can import and call it

**Why `process.exit(1)`?**
If the database can't connect, the entire app is useless. Exiting with code `1` signals a failure — process managers (like PM2) will restart the app automatically.

---

### Step 5 — Create Error Middleware

Separating error handling and an `asyncHandler` wrapper keeps our controllers extremely clean and avoids writing `try { } catch (error) { }` hundreds of times.

📁 `backend/middleware/errorMiddleware.js`
```javascript
const errorHandler = (err, req, res, next) => {
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

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
```

---

### Step 6 — Create the Express App and Server

Separating `app.js` and `server.js` is a Node.js best practice. It makes testing easier (you can test `app` without listening on a port) and isolates logic.

📁 `backend/app.js`
```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());          // Security headers
app.use(cors({
  origin: 'http://localhost:5173', // Vite's default port
  credentials: true,
}));
app.use(morgan('dev'));      // Request logging: "GET /api/... 200 5ms"
app.use(express.json());    // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse form data

// ─── Routes ───────────────────────────────────────────────────
// Placeholder — we'll add real routes in later phases
app.get('/', (req, res) => {
  res.json({ message: '🏢 HRMS API is running' });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
```

📁 `backend/server.js`
```javascript
const dotenv = require('dotenv');
// Load environment variables FIRST before anything else
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} in ${process.env.NODE_ENV} mode`);
});
```

> 📝 **Code Breakdown:**
> - `dotenv.config()` — reads `.env` and loads all variables into `process.env`. Must be called **first** before anything reads from `process.env`
> - `const app = express()` — creates your Express application. Think of `app` as the entire server object
> - `module.exports = app` — exporting the configured app makes writing tests infinitely easier because the server won't bind to a port during testing
> - `app.use(helmet())` — automatically adds security HTTP headers to every response (prevents clickjacking, MIME sniffing, etc.)
> - `app.use(cors({ origin: '...' }))` — tells browsers: "it is OK for JavaScript from this URL to call my API". Without this, browsers block cross-origin requests by default
> - `credentials: true` — allows cookies and `Authorization` headers to be included in cross-origin requests
> - `app.use(morgan('dev'))` — logs every HTTP request to the console: `GET /api/users 200 12ms`
> - `app.use(express.json())` — parses incoming request bodies that contain JSON. Without this, `req.body` is always `undefined`
> - `app.get('/', handler)` — registers a route: GET requests to `/` are handled by this function
> - `(req, res) => res.json({...})` — `req` is the incoming request, `res` is used to send the response. `res.json()` sends a JSON body automatically
> - `app.use((req, res) => ...)` with no path — this catch-all runs for any request that didn't match a route above → 404
> - `app.use((err, req, res, next) => ...)` — Express identifies **4-parameter** functions as error handlers. `next` is included even if unused (required by Express)
> - `process.env.PORT || 5000` — use whatever port is in `.env`, or fall back to 5000 if absent
> - `app.listen(PORT, callback)` — starts the HTTP server. The callback runs once the server is successfully listening

Run the server:
```bash
npm run dev
```

You should see:
```
✅ MongoDB Connected: localhost
🚀 Server running on http://localhost:5000 in development mode
```

---

### Step 6 — Set up the Frontend (React + Vite)

Go back to the root project folder:

```bash
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

Install frontend dependencies:

```bash
npm install axios react-router-dom recharts
```

**What each package does:**
| Package | Purpose |
|---|---|
| `axios` | Make HTTP requests to our backend API |
| `react-router-dom` | Client-side routing (different pages) |
| `recharts` | Charts and analytics visualizations |

---

### Step 7 — Configure Vite Proxy

This is important! Without this, your React app (port 5173) can't talk to your Express app (port 5000) easily because of CORS during development.

📁 `frontend/vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Any request to /api will be forwarded to your backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

> 📝 **Code Breakdown:**
> - `defineConfig({})` — Vite's helper to write your config with autocomplete support
> - `plugins: [react()]` — enables React JSX support and hot module replacement (page updates without full refresh during dev)
> - `server.proxy` — tells Vite's dev server to act as a middleman: any request to `/api/...` gets forwarded to the backend
> - `'/api'` — the URL prefix to intercept; only requests starting with `/api` are proxied
> - `target: 'http://localhost:5000'` — the backend server to forward the request to
> - `changeOrigin: true` — rewrites the `Host` header to match the target (required for some servers)
> - `secure: false` — allows proxying to HTTP (non-HTTPS). Fine for local development

Now in your React code, instead of writing `http://localhost:5000/api/users`, you just write `/api/users`.

---

### Step 8 — Set up the Frontend `.env`

📁 `frontend/.env`
```env
VITE_API_URL=/api
```

> In Vite, all env variables **must start with `VITE_`** to be accessible inside React code via `import.meta.env.VITE_API_URL`.

---

### Step 9 — Clean up the React boilerplate

Replace the default files:

📁 `frontend/src/main.jsx`
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

📁 `frontend/src/App.jsx`
```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<h1>HRMS — App is running ✅</h1>} />
      </Routes>
    </Router>
  );
}

export default App;
```

📁 `frontend/src/index.css`
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: #f5f7fa;
  color: #333;
}
```

Start the frontend:
```bash
npm run dev
```

Visit `http://localhost:5173` — you should see "HRMS — App is running ✅".

---

### Step 10 — Create an Axios service file

📁 `frontend/src/services/api.js`
```javascript
import axios from 'axios';

// Create a reusable Axios instance
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Automatically attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
```

> 📝 **Code Breakdown:**
> - `axios.create({ baseURL })` — creates a custom Axios instance with a preset base URL. Every request automatically gets `/api` prepended, so you write `API.get('/users')` instead of `API.get('http://localhost:5000/api/users')`
> - `import.meta.env.VITE_API_URL` — reads the env var from `frontend/.env`. This is Vite's syntax; in CRA you'd use `process.env.REACT_APP_...`
> - `API.interceptors.request.use(callback)` — registers a function that **runs before every outgoing request**. Think of it as frontend middleware
> - `localStorage.getItem('hrms_token')` — retrieves the JWT saved in the browser after login
> - `config.headers.Authorization = \`Bearer ${token}\`` — adds the token to the HTTP `Authorization` header. The backend's `protect` middleware reads this to verify the user
> - `return config` — you MUST return the modified config, otherwise Axios won't send the request

**Why interceptors?**
Instead of manually adding the auth token to every API call, the interceptor adds it automatically. You add it once, it works everywhere.

---

## ⚠️ Edge Cases & Gotchas

### 1. `dotenv.config()` must be called FIRST
```javascript
// ✅ Correct
dotenv.config();
connectDB(); // process.env.MONGO_URI is now available

// ❌ Wrong — MONGO_URI will be undefined!
connectDB();
dotenv.config();
```

### 2. MongoDB must be running
If you're using a local MongoDB install, start it first:
```bash
mongod
```
Or use **MongoDB Atlas** (free cloud) — just paste the Atlas connection string in `.env`.

### 3. Vite vs CRA env variables
- **CRA**: `REACT_APP_MY_VAR` → accessed via `process.env.REACT_APP_MY_VAR`
- **Vite**: `VITE_MY_VAR` → accessed via `import.meta.env.VITE_MY_VAR`

### 4. CORS origin must match exactly
```javascript
// ✅ Correct (Vite default port)
cors({ origin: 'http://localhost:5173' })

// ❌ Wrong — trailing slash will fail in some browsers
cors({ origin: 'http://localhost:5173/' })
```

### 5. `express.json()` middleware is required
Without it, `req.body` will be `undefined` when you send JSON from React.

### 6. Order of middleware matters
```javascript
app.use(helmet());        // Security first
app.use(cors(...));       // Allow cross-origin
app.use(morgan('dev'));   // Log requests
app.use(express.json()); // Parse body BEFORE routes
app.use('/api', routes); // Routes come after parsers
app.use(errorHandler);   // Error handler always LAST
```

---

## ✅ Phase 1 Checklist

- [ ] Root folder created, Git initialized
- [ ] Backend: `npm init`, all dependencies installed
- [ ] `backend/.env` created with PORT, MONGO_URI, JWT_SECRET
- [ ] `backend/config/db.js` — MongoDB connection
- [ ] `backend/app.js` and `backend/server.js` — Express app with middleware
- [ ] Backend server starts successfully (`npm run dev`)
- [ ] Frontend: `npm create vite@latest` done
- [ ] Frontend dependencies installed (axios, react-router-dom, recharts)
- [ ] `vite.config.js` — proxy configured
- [ ] `frontend/.env` created
- [ ] React app starts successfully (`npm run dev`)
- [ ] `src/services/api.js` — reusable Axios instance created

---

## 🔗 What's Next?
**Phase 2** — We'll build User Registration, Login, and JWT-based Authentication with Role-Based Access Control.
