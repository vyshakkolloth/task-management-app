# Task Management API

Lightweight Express + MongoDB API for managing users, tasks, and categories.

Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and `JWT_SECRET`.
2. Install dependencies: `npm install`.
3. Start in development: `npm run dev`.

Routes

- `POST /api/auth/register` - register
- `POST /api/auth/login` - login
- `GET /api/auth/me` - profile (requires Bearer token)
- `GET/POST/PUT/DELETE /api/tasks` - task operations (auth required)
- `GET/POST/PUT/DELETE /api/categories` - category operations (auth required)

Notes

This is a minimal skeleton suitable for extension and testing.
