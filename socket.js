import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import app from "./app.js";

const userSocketMap = {};

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS.split(","),
    credentials: true,
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");

    const token = cookies.token;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.userId = decoded.id;

    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  if (!userSocketMap[socket.userId]) {
    userSocketMap[socket.userId] = [];
  }
  userSocketMap[socket.userId].push(socket.id);

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    if (userSocketMap[socket.userId]) {
      userSocketMap[socket.userId] = userSocketMap[socket.userId].filter(
        (id) => id !== socket.id
      );
      if (userSocketMap[socket.userId].length === 0) {
        delete userSocketMap[socket.userId];
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { server, io };
