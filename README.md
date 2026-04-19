# HRMS — Human Resource Management System

A full-stack web application for managing employees, attendance, leaves, and payroll.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js + Vite, Recharts |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Auth** | JWT + bcryptjs |
| **Security** | Helmet, Rate Limiting, XSS Clean, NoSQL Sanitize |

## Roles & Access

| Role | Access |
|---|---|
| **Admin** | Full system access |
| **HR Officer** | Employees, Attendance, Leaves |
| **Payroll Officer** | Payroll & Reports |
| **Employee** | Own data only |

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/hrms-project.git
cd hrms-project
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env    # Then fill in your values
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

### 4. Seed the database with demo data

```bash
cd ../backend
node scripts/seed.js
```

### 5. Run the app

**Backend** (terminal 1):
```bash
cd backend
npm run dev
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hrms.com | admin123 |
| HR Officer | priya@hrms.com | priya123 |
| Payroll Officer | raj@hrms.com | raj123 |
| Employee (Alice) | alice@hrms.com | alice123 |
| Employee (Bob) | bob@hrms.com | bob123 |

---

## Project Structure

```
AWT-Project---HRMS/
├── backend/
│   └── src/
│       ├── config/          # MongoDB connection
│       ├── controllers/     # Route handlers (auth, employee, attendance, leave, payroll, dashboard, admin)
│       ├── middleware/      # Auth, error handling, validation
│       ├── models/          # Mongoose schemas
│       ├── routes/          # Express routers
│       ├── utils/           # JWT helpers, payroll calculator
│   ├── scripts/             # seed.js, seedSettings.js
│   ├── app.js               # Express app with all middleware
│   └── server.js            # Entry point
└── frontend/
    └── src/
        ├── components/      # StatCard, LoadingSpinner, EmptyState, ErrorMessage
        ├── context/         # AuthContext (JWT decode, role)
        ├── hooks/           # useFetch
        ├── pages/           # All route-level pages per role
        └── services/        # API call helpers per module
```

---

## Features

- ✅ **JWT Authentication** with role-based access control (Admin / HR / Payroll / Employee)
- ✅ **Employee Management** — create, edit, deactivate employee profiles
- ✅ **Attendance Tracking** — daily mark attendance, bulk mark, monthly calendar view
- ✅ **Leave Management** — apply, approve/reject workflow with balance enforcement
- ✅ **Payroll Generation** — automatic salary calc with PF, LOP deductions, printable payslips
- ✅ **Dashboards & Analytics** — role-specific charts (Recharts: Bar, Line, Pie)
- ✅ **Admin Controls** — user management, role assignment, system settings
- ✅ **Security** — rate limiting, XSS/NoSQL protection, input validation

---

## Environment Variables

See `backend/.env.example` for all required variables.
