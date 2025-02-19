// server/server.ts

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { ACTIONS } from "./SocketActions";
import cors from "cors";

// Define a type to store both username and peerId
interface UserInfo {
  username: string;
  peerId: string;
}

// Map to store user info by socket id
const userSocketMap: Record<string, UserInfo> = {};

const app = express();
const server = http.createServer(app);

// Enable CORS for your Express server
app.use(
  cors({
    origin: ["https://collaborative-coding-delta.vercel.app"], // Update to your frontend's URL
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Initialize Socket.io with proper CORS settings
const io = new Server(server, {
  cors: {
    origin: ["https://collaborative-coding-delta.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle JOIN event with peerId
  socket.on(ACTIONS.JOIN, ({ roomId, username, peerId }) => {
    // Use a default username if none was provided
    const actualUsername = username ? username : "Anonymous";

    // Store the username and peerId for this socket
    userSocketMap[socket.id] = { username: actualUsername, peerId };

    // Join the specified room
    socket.join(roomId);

    // Retrieve all clients in the room (with their username and peerId)
    const clients = getAllConnectedClients(roomId);

    // Emit the JOINED event to the joining client with their info and the list of clients
    socket.emit(ACTIONS.JOINED, {
      clients,
      username: actualUsername,
      socketId: socket.id,
    });

    // Broadcast to all other clients in the room that a new user has connected
    socket.to(roomId).emit("user-connected", {
      socketId: socket.id,
      username: actualUsername,
      peerId,
    });
  });

  // Broadcast code changes to others in the room
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, html, css, js }) => {
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  // Sync code on join
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, html, css, js }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  // When a socket is disconnecting, broadcast that to the room
  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("user-disconnected", {
          socketId: socket.id,
          username: userSocketMap[socket.id]?.username,
        });
      }
    });
  });

  // On disconnect, clean up the user map
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    delete userSocketMap[socket.id];
  });
});

// Helper function to retrieve all connected clients in a room
function getAllConnectedClients(roomId: string) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId]?.username,
        peerId: userSocketMap[socketId]?.peerId,
      };
    }
  );
}

// Start the server (using Railway's PORT if available)
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(
    `Server running on: https://pure-courage-production.up.railway.app`
  );
});
