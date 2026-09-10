# miniGram

A full-stack social media app — posts, stories, highlights, short-form video "loops", real-time DMs, notifications, and a follow/privacy system. Built as a MERN + Socket.IO project.

🔗 **Live app:** [mini-gram-client.vercel.app](https://mini-gram-client.vercel.app/signin)
🔗 **Client repo:** [miniGram-client](https://github.com/nitish100000100-found/miniGram-client)
🔗 **Server repo:** [miniGram-server](https://github.com/nitish100000100-found/miniGram-server)

---

## 📖 About the project

miniGram is split into two repos:

- **`miniGram-server`** — a Node.js/Express REST API + Socket.IO server that handles auth, posts, stories, loops (reels), messaging, and notifications, backed by MongoDB.
- **`miniGram-client`** — a React (Vite) single-page app that consumes that API, deployed on Vercel.

### What it can do

- **Auth** — sign up / sign in, OTP-based email verification, forgot/change password, logout (JWT stored in an httpOnly cookie)
- **Profiles** — edit profile (with photo upload), switch account between public/private, look up other users
- **Posts** — upload image/video posts, delete, save/unsave, feed, explore page, comments
- **Loops** — short-form videos (reels): upload, like, comment, save, explore/feed, per-user loop list
- **Stories** — 24-hour stories with automatic cleanup via a cron job, plus **Highlights** to pin stories to a profile permanently
- **Social graph** — follow requests (send/cancel/accept/reject), unfollow, remove follower, block/unblock, pending requests list
- **Engagement** — likes + comments (with delete) on posts and loops, "who liked this" lists
- **Search** — search users
- **Notifications** — in-app notifications with read/unread state
- **Direct messages** — 1:1 chat with media attachments, unsend, unread counts, chat list, search users to message, clear chat — all real-time via Socket.IO (with an online-users presence list)

### Tech stack

| | Server | Client |
|---|---|---|
| Core | Node.js, Express 5 | React 19, Vite |
| Data | MongoDB + Mongoose | — |
| Auth | JWT, bcryptjs, cookie-parser | LoaderFunction |
| Routing | Express Router | React Router v7 |
| Real-time | Socket.IO (server) | Socket.IO Client |
| Media | Multer + Cloudinary | — |
| Email | Brevo (OTP/password reset) | — |
| Scheduling | node-cron (story expiry cleanup) | — |
| HTTP | — | Axios |
| Misc | — | date-fns, react-icons, react-spinners |
| Hosting | Render | Vercel |

### Folder structure

```
miniGram-server/
├── config/         # env, DB connection, Cloudinary + Multer setup
├── controllers/    # auth, user, post, loop, story, highlight, interaction, message
├── cronjobs/       # story.cron.js — deletes expired stories every 15 min
├── middleware/     # isAuth, error handler
├── models/         # Mongoose schemas
├── routes/         # auth, user, post, interaction, loop, story, highlight, message
├── socket.js       # Socket.IO server + online-user presence
├── app.js          # Express app (CORS, middleware, route mounting)
└── server.js       # Entry point — connects DB, starts HTTP + Socket.IO server

miniGram-client/
├── public/         # Static assets
├── src/            # Components, pages, Redux store, routes
├── index.html
├── vite.config.js
└── vercel.json     # SPA rewrite config for Vercel
```

---

## 🚀 Getting Started

Clone both repos side by side (the client talks to the server over HTTP + WebSockets, so run the server first):

```bash
git clone https://github.com/nitish100000100-found/miniGram-server.git
git clone https://github.com/nitish100000100-found/miniGram-client.git
```

### 1. Start the server

```bash
cd miniGram-server
npm install
```

Create a `.env` file in `miniGram-server/`:

```env
PORT=3000
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# Cloudinary reads this single connection string
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Nodemailer (for OTP / password reset emails)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_email_or_app_password

ALLOWED_ORIGINS=http://localhost:5173
```

Run it:

```bash
npm run dev     # nodemon, for local development
# or
npm start       # plain node, for production
```

The API boots at `http://localhost:3000` and Socket.IO listens on the same server. You should see:

```
🚀 Server running on http://localhost:3000
🌐 Allowed Origins: http://localhost:5173
```

> Note: `app.js` currently hardcodes the CORS origin to the deployed client URL (`https://mini-gram-client.vercel.app`). For local development, update that origin (or read it from `ALLOWED_ORIGINS`) so your local client can talk to it.

### 2. Start the client

In a separate terminal:

```bash
cd miniGram-client
npm install
```

Create a `.env` file in `miniGram-client/`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

Run it:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`. Sign up, verify via OTP, and start posting.

### Production build (client)

```bash
npm run build
npm run preview
```

---

## 🌍 Deployment

- **Client** is deployed on **Vercel**: [mini-gram-client.vercel.app](https://mini-gram-client.vercel.app/signin) (SPA rewrites configured in `vercel.json`)
- **Server** can be deployed to any Node host (Render, Railway, Fly.io, etc.) — just set the same env vars there and point the client's `VITE_API_BASE_URL` / `VITE_SOCKET_URL` at it.

