# University System — Backend

Production-ready Node.js + Express + MySQL / MariaDB + Prisma + Socket.io backend for the **University System** platform.

Two isolated subsystems share one infrastructure but are logically separated by `System` enum and role middleware:

- **ONLINE** — Coursera-like (courses, modules, lessons, quizzes, certificates)
- **CLASSROOM** — Physical university (timetable, attendance, grades, finance, parent portal)

---

## Stack

- Node.js 20+ / Express 4
- MySQL 8+ or MariaDB 10.11+
- Prisma ORM
- JWT (access + refresh tokens)
- bcrypt password hashing
- Socket.io (chat + notifications + realtime updates)
- Helmet, CORS, rate limiting, Zod validation

---

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Full DB schema (all 2 subsystems)
│   └── seed.js              # Demo data
├── src/
│   ├── config/              # env, prisma client, constants
│   ├── database/            # prisma singleton
│   ├── middlewares/         # auth, rbac, error, validate
│   ├── modules/
│   │   ├── auth/            # login, register, refresh
│   │   ├── users/           # profiles, admin user mgmt
│   │   ├── online/          # courses, modules, lessons, quizzes
│   │   ├── classroom/       # classes, attendance, grades, announcements
│   │   ├── timetable/       # draft → approve → publish workflow
│   │   ├── finance/         # fees, payments, invoices
│   │   ├── chat/            # rooms, messages (REST + WS)
│   │   └── notifications/   # in-app notifications
│   ├── utils/               # jwt, hash, logger, asyncHandler
│   ├── socket/              # socket.io server
│   ├── app.js               # express app
│   └── server.js            # http + socket bootstrap
└── package.json
```

---

## Setup

```bash
cd backend
cp .env.example .env       # fill DATABASE_URL + JWT secrets
npm install
npm run prisma:migrate     # creates DB tables
npm run seed               # optional: demo users
npm run dev                # http://localhost:4000
```

---

## Roadmap (build by phases)

- ✅ **Phase 1** — Foundation: full Prisma schema, Auth (register/login/refresh), RBAC middleware, Users module
- ✅ **Phase 2** — Online: courses, modules, lessons, quizzes auto-grading, enrollment, progress, certificates, teacher analytics
- ✅ **Phase 3** — Classroom: departments, classes, profiles, timetable workflow, attendance, grades, announcements, reports
- ⏳ **Phase 4** — Finance + Parent portal
- ✅ **Phase 5** — Realtime: Socket.io chat (rooms + presence) + notifications REST/live *(live timetable updates land with Phase 3)*

> **Migration note:** Phase 5 adds `ChatRoomMember.lastReadAt` (nullable) for unread counts. Run `npm run prisma:migrate` after pulling.

---

## API — Phase 1 implemented

### Auth (`/api/auth`)
| Method | Path                  | Body                                                         | Auth |
|--------|-----------------------|--------------------------------------------------------------|------|
| POST   | `/register`           | `{ email, password, firstName, lastName, role, system }`     | -    |
| POST   | `/login`              | `{ email, password }`                                        | -    |
| POST   | `/refresh`            | `{ refreshToken }`                                           | -    |
| POST   | `/logout`             | `{ refreshToken }`                                           | -    |
| GET    | `/me`                 | -                                                            | JWT  |

### Users (`/api/users`) — admin only unless noted
| Method | Path           | Notes                                  |
|--------|----------------|----------------------------------------|
| GET    | `/`            | List users (admin)                     |
| GET    | `/:id`         | Get user                               |
| PATCH  | `/:id`         | Update user (admin or self)            |
| DELETE | `/:id`         | Soft-delete (admin)                    |
| PATCH  | `/:id/role`    | Change role (admin)                    |

---

## API — Phase 2 implemented (Online)

All routes are under `/api/online`, require a JWT, and are restricted to the **ONLINE** system.
Role column: **T** = `TEACHER_ONLINE`, **S** = `STUDENT_ONLINE`, **·** = any online user.

### Courses
| Method | Path                          | Role | Notes                                                        |
|--------|-------------------------------|------|--------------------------------------------------------------|
| GET    | `/courses`                    | ·    | Browse published courses (`?q&page&limit`)                   |
| GET    | `/courses/mine`               | T    | Teacher's own catalogue (`?status&q&page&limit`)             |
| GET    | `/courses/:id`                | ·    | Course tree; content locked unless owner/enrolled            |
| GET    | `/courses/slug/:slug`         | ·    | Same as above, by slug                                       |
| POST   | `/courses`                    | T    | Create course (DRAFT) — `{ title, description, thumbnail? }` |
| PATCH  | `/courses/:id`                | T    | Update (owner)                                               |
| DELETE | `/courses/:id`                | T    | Delete (owner, cascades)                                     |
| POST   | `/courses/:id/publish`        | T    | Publish (needs ≥1 lesson) → broadcast `course:published`     |
| POST   | `/courses/:id/archive`        | T    | Archive                                                      |
| GET    | `/courses/:id/analytics`      | T    | Enrollments, completion rate, avg progress, quiz pass rates  |

### Curriculum (modules & lessons) — teacher/owner
| Method | Path                                  | Body                                                  |
|--------|---------------------------------------|-------------------------------------------------------|
| POST   | `/courses/:courseId/modules`          | `{ title, order? }`                                   |
| PATCH  | `/modules/:moduleId`                  | `{ title?, order? }`                                  |
| DELETE | `/modules/:moduleId`                  | — (cascades to lessons)                               |
| POST   | `/modules/:moduleId/lessons`          | `{ title, type, contentUrl?, body?, duration?, order? }` |
| PATCH  | `/lessons/:lessonId`                  | partial of the above                                  |
| DELETE | `/lessons/:lessonId`                  | —                                                     |

`type` ∈ `VIDEO|PDF|TEXT`. `VIDEO`/`PDF` require `contentUrl`; `TEXT` requires `body`.

### Enrollment · Progress · Certificates — student
| Method | Path                              | Notes                                                      |
|--------|-----------------------------------|------------------------------------------------------------|
| POST   | `/courses/:courseId/enroll`       | Enroll (course must be PUBLISHED); idempotent              |
| GET    | `/enrollments`                    | My enrolled courses + progress                            |
| GET    | `/enrollments/:courseId`          | My per-lesson progress for a course                       |
| POST   | `/lessons/:lessonId/progress`     | `{ completed?, watchedSec? }` → recomputes %; 100% issues a certificate |
| GET    | `/certificates`                   | My certificates                                           |
| GET    | `/certificates/:code/verify`      | Verify a certificate by code (any online user)            |

### Quizzes & auto-grading
| Method | Path                              | Role | Notes                                                      |
|--------|-----------------------------------|------|------------------------------------------------------------|
| POST   | `/courses/:courseId/quizzes`      | T    | Create quiz + questions + options; notifies enrolled students |
| GET    | `/courses/:courseId/quizzes`      | T/S  | List quizzes (owner, or enrolled student + attempt summary) |
| GET    | `/quizzes/:quizId`                | T/S  | Owner gets answer key; student gets a takeable copy        |
| PATCH  | `/quizzes/:quizId`                | T    | Update quiz metadata                                       |
| DELETE | `/quizzes/:quizId`                | T    | Delete quiz                                                |
| POST   | `/quizzes/:quizId/submit`         | S    | `{ answers: [{ questionId, selectedOptionIds }] }` → auto-graded result |
| GET    | `/quizzes/:quizId/my-attempts`    | S    | My attempts on a quiz                                      |
| GET    | `/quizzes/:quizId/attempts`       | T    | All attempts + pass rate / avg score (analytics)          |

**Auto-grading** is all-or-nothing per question: the submitted option set must exactly
match the correct set (covers `MCQ_SINGLE`, `MCQ_MULTI`, `TRUE_FALSE`). Score is the sum of
awarded question points; `passed = (score / maxScore) × 100 ≥ quiz.passingScore`.

> **Realtime/notifications:** Phase 2 already **persists** `Notification` rows for online
> events (`EXAM_AVAILABLE`, `RESULTS_READY`, new enrollment) and best-effort emits them over
> Socket.io (`user:<id>` rooms) plus a `course:published` broadcast. The notifications **read
> API** and chat live in Phase 5.

---

## API — Phase 3 implemented (Classroom)

All routes require a JWT and the **CLASSROOM** system. Role keys: **A**=ADMIN, **St**=staff
(`ADMIN/SECRETARY/CHEF_DE_MENTION/PEDAGOGICAL_MANAGER`), **Ap**=approvers
(`ADMIN/CHEF_DE_MENTION/PEDAGOGICAL_MANAGER`), **T**=`TEACHER_CLASSROOM`, **S**=`STUDENT_CLASSROOM`, **·**=any.

### Structure — `/api/classroom`
| Method | Path                                   | Role | Notes                                  |
|--------|----------------------------------------|------|----------------------------------------|
| GET/POST/PATCH/DELETE | `/departments[...]`     | ·/A  | Read any; write ADMIN                  |
| GET    | `/classes` · `/classes/:id`            | T/St | List/detail (filters `departmentId,academicYear`) |
| POST/PATCH | `/classes[...]`                    | St   | Create/update (DELETE = ADMIN)         |
| GET/POST/DELETE | `/classes/:id/students`       | T/St·St | Roster: list / assign / remove      |
| GET/POST/PATCH | `/students[...]` `/teachers[...]` | T/St | Profiles (read T/St; write St)    |

### Timetable workflow — `/api/timetable`
| Method | Path                          | Role | Notes                                            |
|--------|-------------------------------|------|--------------------------------------------------|
| POST/PATCH/DELETE | `/entries[...]`    | T/St | Author draft entries (overlap-checked)           |
| GET    | `/class/:classId`             | ·    | Students see **PUBLISHED** (own class); staff see all/by `?status` |
| POST   | `/class/:classId/submit`      | T/St | DRAFT/REJECTED → PENDING_APPROVAL                |
| POST   | `/class/:classId/approve`     | Ap   | PENDING → APPROVED                               |
| POST   | `/class/:classId/reject`      | Ap   | PENDING → REJECTED (`{reason}`, notifies authors)|
| POST   | `/class/:classId/publish`     | Ap   | APPROVED → PUBLISHED + notify students/teachers  |

### Attendance · Grades · Announcements · Self · Reports — `/api/classroom`
| Method | Path                                  | Role | Notes                                     |
|--------|---------------------------------------|------|-------------------------------------------|
| POST   | `/attendance`                         | T/St | Bulk upsert `{classId,date,records[]}`    |
| GET    | `/attendance` · `/attendance/class/:id/summary` | T/St | By `classId&date/from&to`; per-student rate |
| POST   | `/grades` · GET `/grades` · GET `/grades/class/:id/gradebook` | T/St | Assign / list / weighted gradebook |
| GET/POST/DELETE | `/announcements`             | ·/T/St | Feed (scoped) · post (GLOBAL = staff) · delete (author/admin) |
| GET    | `/me/profile,timetable,class,attendance,grades` | S/T | Signed-in user's own data       |
| GET    | `/reports/overview`                   | St   | Counts + attendance rate dashboard        |

---

## API — Phase 5 implemented (Realtime)

### Notifications (`/api/notifications`) — any authenticated user
| Method | Path             | Notes                                       |
|--------|------------------|---------------------------------------------|
| GET    | `/`              | List + `unreadCount` (`?page&limit`)        |
| GET    | `/unread-count`  | `{ count }`                                 |
| POST   | `/:id/read`      | Mark one read                               |
| POST   | `/read-all`      | Mark all read                               |

### Chat (`/api/chat`) — any authenticated user (membership-enforced)
| Method | Path                          | Notes                                                  |
|--------|-------------------------------|--------------------------------------------------------|
| GET    | `/rooms`                      | My rooms + last message + unread count                 |
| GET    | `/presence`                   | `{ online: [userId] }` snapshot                        |
| POST   | `/courses/:courseId/room`     | Get-or-create a course chat room (owner/enrolled)      |
| POST   | `/private/:userId`            | Get-or-create a 1:1 room                               |
| GET    | `/rooms/:roomId/messages`     | History (`?limit&before`); marks the room read         |
| POST   | `/rooms/:roomId/messages`     | Send (REST fallback; Socket.io is primary)             |
| POST   | `/rooms/:roomId/read`         | Mark room read                                         |

### Socket.io (`ws`, handshake `auth: { token }`)
Server → client: `connected`, `notification`, `chat:message`, `chat:typing`, `chat:notify`, `presence:update`, `course:published`.
Client → server: `chat:join(roomId)`, `chat:leave(roomId)`, `chat:message({roomId,body})` *(ack)*, `chat:typing(roomId)`, `chat:read(roomId)`.

Each socket joins its private `user:<id>` room (notification + chat-notify fan-out) and opt-in `room:<id>` chat rooms. Presence is in-memory (single-process; swap for Redis to scale out).

---

## Roles

```
ONLINE:    STUDENT_ONLINE, TEACHER_ONLINE
CLASSROOM: STUDENT_CLASSROOM, TEACHER_CLASSROOM, ADMIN,
           CHEF_DE_MENTION, SECRETARY, TREASURER,
           PEDAGOGICAL_MANAGER, PARENT
```

A user belongs to exactly one `system` (`ONLINE` or `CLASSROOM`) — enforced by middleware.

---

## Security

- bcrypt (12 rounds) for passwords
- JWT access (15m) + refresh (7d) rotation; refresh tokens stored hashed in DB
- Helmet HTTP headers, CORS allowlist, global rate limit + stricter limit on `/auth`
- Zod schema validation on every body/param
- Role + system guards on every protected route
