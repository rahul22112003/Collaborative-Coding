import express from "express";
import http from "http";
import { Server } from "socket.io";
import { ACTIONS } from "./SocketActions";
import cors from "cors";

const userSocketMap: Record<string, string> = {};

const app = express();
const server = http.createServer(app);

// ✅ Enable CORS for Express
app.use(
  cors({
    origin: ["https://collaborative-coding-delta.vercel.app"], // Allow only your frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// ✅ Initialize Socket.io only once
const io = new Server(server, {
  cors: {
    origin: ["https://collaborative-coding-delta.vercel.app"], // Allow Vercel frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });

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
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, html, css, js }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
  });
});

// ✅ Helper function to get all connected clients in a room
function getAllConnectedClients(roomId: string) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => ({
      socketId,
      username: userSocketMap[socketId],
    })
  );
}

// ✅ Use Railway's PORT
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

// ✅ Start server
server.listen(PORT, HOST, () => {
  console.log(`Server running on: https://pure-courage-production.up.railway.app`);
});
