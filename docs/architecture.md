# System Architecture & Technical Specifications

## 1. Overview
Digital Dead Man's Switch (DMS) protects sensitive whistleblowing, legal, personal, and investigative assets while ensuring their delivery to designated recipients if the account holder becomes unreachable, incapacitated, or endangered.

---

## 2. Structural Breakdown

```
DeadMan Switch/
├── client/                      # Frontend Application
│   ├── public/
│   ├── src/
│   │   ├── assets/              # Static branding and icons
│   │   ├── components/          # Reusable UI primitives and domain widgets
│   │   ├── context/             # React Contexts (Auth, Vault, Emergency status)
│   │   ├── hooks/               # Custom hooks
│   │   ├── layouts/             # App shell, Navbar, Sidebar
│   │   ├── pages/               # Route components (Dashboard, Vault, Contacts, etc.)
│   │   ├── routes/              # Protected & public routing
│   │   ├── services/            # Axios API clients
│   │   ├── utils/               # Formatting, date helpers, security utils
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                      # Backend REST API & Processing Engine
│   ├── src/
│   │   ├── config/              # DB connection, env configs, OAuth client
│   │   ├── controllers/         # Thin HTTP request handlers
│   │   ├── middleware/          # JWT auth, rate limiter, error handlers
│   │   ├── models/              # Mongoose schemas (User, Evidence, Contacts, etc.)
│   │   ├── queues/              # BullMQ queue definitions
│   │   ├── routes/              # Express route routers
│   │   ├── services/            # Core business & domain logic
│   │   │   ├── auth/            # Token generation, password hashing
│   │   │   ├── emergency/       # State machine transitions & guards
│   │   │   ├── encryption/      # AES-256-GCM cipher engines
│   │   │   ├── evidence/        # GridFS stream handling & chunking
│   │   │   ├── gmail/           # OAuth token refresh & MIME email dispatcher
│   │   │   └── notifications/   # Reminders & status broadcasts
│   │   ├── utils/               # App logger, crypto helpers, validation schemas
│   │   ├── validators/          # Zod request validators
│   │   ├── workers/             # Background job processors
│   │   ├── app.js               # Express app configuration & middleware pipeline
│   │   └── server.js            # Entry point & graceful shutdown listeners
│   ├── .env.example
│   └── package.json
│
├── docs/                        # Specifications, manuals, and schemas
├── README.md
└── .gitignore
```

---

## 3. Security Architecture
- **Encryption**: Evidence files are encrypted via AES-256-GCM before passing into MongoDB GridFS. Metadata and file digests (SHA-256) ensure tampering detection.
- **Fail-Closed Verification**: The system enters emergency workflows incrementally (Active -> Overdue -> Warning -> Grace Period -> Additional Verification -> Authorization -> Release). If any link in the chain fails or fails to verify recipient keys, disclosure aborts.
- **Minimum Permissions**: Gmail API only uses `https://www.googleapis.com/auth/gmail.send` to dispatch outgoing notifications on behalf of the owner without read access to private inbox messages.

