import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { ACTIONS } from "./SocketActions";
import os from "os";

const cors = require("cors");

const userSocketMap: Record<string, string> = {};

const app = express();
const server = http.createServer(app);

// ✅ Enable CORS for Express
// app.use(
//   cors({
//     origin: "*", // Allow all origins (Change to your frontend for security)
//     methods: ["GET", "POST"],
//   })
// );

// ✅ Enable CORS for Socket.io
const io = new Server(server, {
  cors: {
    origin: ["collaborative-coding-delta.vercel.app"], // Allow Vercel frontend & local dev
    methods: ["GET", "POST"],
  },
});

const corsOptions = {
  origin: [
    "https://collaborative-coding-delta.vercel.app",
    "http://localhost:5173",
  ], // Allow frontend & local dev
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Helper function to get all connected clients in a room
function getAllConnectedClients(roomId: string) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      username: userSocketMap[socketId],
    })
  );
}

// Listen for socket connections
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);

    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, html, css, js }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, html, css, js }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
      socket.leave(roomId);
    });
    delete userSocketMap[socket.id];
  });
});

// ✅ Use Railway's PORT
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

// ✅ Log Railway's public URL instead of local IP
server.listen(PORT, HOST, () => {
  console.log(
    `Server running on: https://pure-courage-production.up.railway.app`
  );
});
