# 🛡️ DeadMan Switch (DMS)

> A simple, secure, and automated emergency safety switch. If you don't check in on time, your sensitive documents are automatically and safely sent to your trusted emergency contacts.

---

## 💡 How It Works (In Simple Terms)

1. **Sign Up & Connect Gmail**: Create your account and connect your Gmail so the system can send emergency emails.
2. **Upload Documents**: Store important files (PDFs, images, notes) in your encrypted vault.
3. **Add Emergency Contacts**: Add the people who should receive your documents if something happens to you.
4. **Set Your Timer**: Choose how often you want to check in (e.g., 1 minute for testing, or 24 hours / days) and how long your safety grace buffer should be (e.g., 1–2 hours).
5. **The Safety Check**:
   - When your timer runs out, the system **sends a confirmation email directly to you (the host)** asking: *"Are you safe?"*
   - **If you click "I Am Safe"**: Your timer resets back to normal.
   - **If you do not respond** before your grace buffer runs out: The system **automatically decrypts your files and emails them as attachments** to all your verified emergency contacts!
   - You can also cancel the emergency anytime directly from the dashboard.

---

## ✨ Key Features

- **⏱️ Flexible Custom Timers**: Test with 1 minute, 5 minutes, or set real schedules like 12 hours, 24 hours, or several days.
- **⏳ Safety Grace Period**: Gives you extra time to respond before anything is sent.
- **✉️ Automated Email Delivery**: Uses official Google Gmail API (OAuth 2.0) to send real file attachments directly to contacts.
- **🔐 Military-Grade Encryption**: Files are encrypted with **AES-256-GCM** before being saved to MongoDB GridFS. Even database administrators cannot read your files.
- **📊 Real-Time Emergency Pipeline**: Track your status live on the dashboard:
  - `1. Active` (Everything safe, timer running)
  - `2. Overdue` (Deadline missed, host notified)
  - `3. Grace Buffer` (Final safety countdown)
  - `4. Released` (Files safely sent to contacts)
- **🛑 Instant Emergency Cancel**: One click restores your account back to active status at any time.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (with GridFS for encrypted file chunks)
- **Email Service**: Google Gmail API (OAuth 2.0)
- **Security**: AES-256-GCM encryption, bcrypt password hashing, JWT authentication

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB Atlas** account (or local MongoDB)
- **Google Cloud Console** OAuth 2.0 credentials (for Gmail sending)

---

### 2. Setup Backend Server

```bash
cd server
npm install
```

Create a `.env` file in the `server` folder:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB Connection String
MONGODB_URI=your_mongodb_atlas_connection_string

# JWT Secret & Encryption Key (32-character random string)
JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/gmail/oauth2callback
```

Start the backend:
```bash
npm run dev
```
> Backend runs at: `http://localhost:5000`

---

### 3. Setup Frontend Client

Open a new terminal window:

```bash
cd client
npm install
npm run dev
```
> Frontend runs at: `http://localhost:5173`

---

## 🧪 Quick 3-Minute Testing Guide

Want to see the system in action? Follow these simple steps:

1. **Register** a new account at `http://localhost:5173/register` and log in.
2. Go to **Gmail Gateway** and click **Connect Gmail** to authorize email sending.
3. Go to **Evidence Vault** and upload a test file (e.g., a PDF or text document).
4. Go to **Emergency Contacts** and add your own secondary email address (or a friend's email).
5. Go to **Check-In Schedule**:
   - Set **Deadline Timer** to **1 minute** (click the preset pill).
   - Set **Grace Buffer** to **1 minute**.
   - Click **Save Check-in Configuration**.
6. **Watch the Magic**:
   - Wait 1 minute: Your status changes to **Grace Buffer**, and you will receive an *"🚨 URGENT: Check-in Deadline Missed"* email with an **"I Am Safe"** button.
   - If you do not click it and wait 1 more minute: The system automatically releases your document and emails it with the attached PDF to your contact!
   - Check the **Emergency Monitor** page to see the pipeline state update live.

---

## 📁 Project Structure

```
DeadMan Switch/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── pages/         # Dashboard, Vault, Contacts, Config, Monitor
│   │   ├── components/    # Navigation, Layouts, Protected Routes
│   │   └── services/      # API communication with backend
├── server/                 # Backend Node.js / Express API
│   ├── src/
│   │   ├── models/        # User, Evidence, Contact, EmergencyEvent
│   │   ├── services/      # Encryption, GridFS, Gmail, Emergency State Machine
│   │   ├── workers/       # Heartbeat deadline scanner (auto-checks every 15s)
│   │   └── controllers/   # Route handlers
└── README.md
```

---

## 🔒 Security & Privacy Guarantee

- **Your documents are never stored in plain text**: Every file is encrypted using a unique random Initialization Vector (IV) and AES-256-GCM.
- **Your Gmail password is never stored**: We only use Google's official, secure OAuth 2.0 token system with send-only permissions.
- **Fail-Safe Design**: If an error occurs or contacts are not verified, the system safely halts rather than leaking files incorrectly.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
