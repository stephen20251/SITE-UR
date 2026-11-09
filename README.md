<div align="center">

# 🎓 University Reference

**A university platform that unifies online learning, campus management and administration**
— two isolated subsystems (ONLINE + CLASSROOM/ERP) on one infrastructure, with role-based
access and real-time features.

![TanStack Start](https://img.shields.io/badge/TanStack-Start-EF4444)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-Node.js-339933?logo=node.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![MariaDB](https://img.shields.io/badge/MySQL%20%2F%20MariaDB-003545?logo=mariadb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-realtime-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Overview

**University Reference** is a large full-stack platform (~40k LOC) that digitalizes an entire
university. One infrastructure hosts **two logically isolated subsystems**, separated by a
`System` enum and role-based middleware:

- 🟦 **ONLINE** — a Coursera-like learning platform: courses, modules, lessons, quizzes,
  certificates, live sessions and a studio for teachers.
- 🟨 **CLASSROOM / ERP** — a digitalized physical campus: timetable, attendance, grades &
  transcripts (bulletins), finance & payroll, admissions (candidats/inscription), HR, and a
  parent portal.

Real-time chat, notifications and presence run over **Socket.io**.

## ✨ Highlights

- 🔐 **Fine-grained RBAC** — `Permission` / `Role` / `RolePermission` / `UserRole` model with
  many roles: admin, chef de mention, responsable pédagogique, secrétaire, trésorier/finance,
  RH, teacher, student, candidate and parent.
- 🏛️ **Rich academic domain** — Campus → Faculty → Department → Mention → Parcours →
  Promotion → Group, plus Academic Years, Semesters, Teaching Units, Subjects and Rooms.
- 🟦 **Online learning** — course catalogue, player, quizzes with auto-grading, certificates
  (verifiable by code), live sessions and a course studio.
- 🟨 **Campus management** — weekly timetable/planning with availability, attendance, grades &
  bulletins, document/letter generation, announcements feed.
- 💰 **Finance & HR** — student fees, payments, invoices, salaries/payroll.
- ⚡ **Real-time** — chat rooms, notifications and presence via WebSocket.
- 🛡️ **Hardened API** — JWT auth, Helmet, rate limiting, Zod validation, QR codes.

## 🏗️ Architecture

```
┌──────────────────────── Frontend — TanStack Start (React) ─────────────────────────┐
│   /choice → { online.* · classroom.* · erp.* }   role-aware routing & layouts       │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                         │  REST (JSON) + Socket.io
┌────────────────────────────────────────▼───────────────────────────────────────────┐
│                         Backend — Express + Prisma                                   │
│   modules · middlewares (JWT, RBAC, rate-limit) · realtime/socket · services         │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                         │  Prisma ORM
                                ┌────────▼─────────┐
                                │  MySQL / MariaDB  │
                                └───────────────────┘
```

## 🛠️ Tech stack

| Layer | Technologies |
|---|---|
| Frontend | TanStack Start, React, TailwindCSS, Radix UI, dnd-kit (drag & drop), React Hook Form |
| Backend | Node.js, Express, Prisma ORM, Socket.io, JWT, Helmet, express-rate-limit, Zod, Multer, QRCode |
| Database | MySQL / MariaDB (MariaDB 10.11 in local Docker, MySQL on Hostinger) |
| Realtime | Socket.io (chat, notifications, presence) |

## 📁 Structure

```
UR3/
├── src/                      # TanStack Start frontend
│   └── routes/               # online.* · classroom.* · erp.* · choice
├── backend/
│   ├── src/
│   │   ├── modules/          # domain modules (online, classroom, finance, …)
│   │   ├── middlewares/      # auth (JWT), RBAC, rate limiting
│   │   ├── realtime/ socket/ # Socket.io chat, notifications, presence
│   │   ├── database/ config/ utils/
│   └── prisma/schema.prisma  # full domain model (RBAC + academic + finance)
```

## 🚀 Getting started

### Prerequisites
- Node.js 20+ · Docker Desktop (or Docker Engine with the Compose plugin)

### MariaDB with Docker Compose

From the project root, create the local Compose environment file and start MariaDB:

```bash
cp .env.example .env
docker compose up -d mariadb
```

The database is available to applications running on your computer at
`localhost:3307`. Compose stores its data in the persistent `mariadb_data` volume.
The example credentials are for local development only; change them in both `.env`
and `backend/.env` if you choose a different password. Do not use the example
credentials in production.

### Backend

```bash
cd backend
npm install
cp .env.example .env          # DATABASE_URL, JWT secrets, SMTP (Gmail)
npx prisma migrate deploy     # apply the schema
npm run seed:base             # permissions, roles, university structure, finance settings (no accounts)
npm run create:admin          # first Super Admin: asks for e-mail and password in the terminal
npm run dev
```

The other users are then created by the Super Admin in « Utilisateurs ».

Check the e-mail configuration with `node prisma/test-email.js you@gmail.com`.

#### Demo data (development only)

These scripts create accounts sharing a publicly known password. Never run them on a real
installation.

```bash
node prisma/seed.js           # demo university, accounts and grades
node prisma/seed-online.js    # online courses demo
node prisma/seed-cursus.js    # monthly tuition, cursus L1 demo (re-runnable)
node prisma/seed-news.js      # sample news (--remove to delete them)
```

#### Backup and restore (local Docker database)

On Hostinger, use hPanel → Databases → phpMyAdmin (Export / Import).

`backend/uploads` and `backend/private-uploads` hold the uploaded files: back them up too.

```bash
mkdir -p backend/backups && docker exec ur3-mariadb-1 sh -c 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" --single-transaction --routines "$MARIADB_DATABASE"' > backend/backups/backup.sql
```

```bash
docker exec -i ur3-mariadb-1 sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < backend/backups/backup.sql
```

### Frontend

```bash
npm install
npm run dev                   # TanStack Start dev server
```

## 👥 Roles

`admin` · `chef_de_mention` · `responsable_pédagogique` · `secrétaire` · `trésorier / finance` ·
`RH` · `teacher (online / classroom)` · `student (online / classroom)` · `candidate` · `parent` —
each with strict, permission-based access, and scoped to the ONLINE or CLASSROOM system.

## 🗺️ Roadmap

- [ ] API documentation (OpenAPI)
- [ ] Automated tests (unit + e2e)
- [ ] Dockerfile + docker-compose (app + MariaDB)
- [ ] CI (lint + build + migrate) via GitHub Actions
- [ ] Mobile companion app (React Native)

## 📄 License

MIT © Joel Stephen
