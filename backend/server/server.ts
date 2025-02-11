import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { ACTIONS } from "./SocketActions";
import os from "os";

// Type for the userSocketMap, which maps socketId to username
const userSocketMap: Record<string, string> = {};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Helper function to get all connected clients in a room
function getAllConnectedClients(roomId: string) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

// Listen for socket connections
io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  // User joins a room
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);

    // Notify all clients in the room about the new user
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // Handle code change event
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, html, css, js }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  // Sync code with a specific user
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, html, css, js }) => {
    console.log(html, css, js);
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { html, css, js });
  });

  // Handle disconnection of the user
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



// Get the local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (iface) { // Check if iface is defined
      for (const info of iface) {
        if (info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
  }
  return "localhost";
}


// Set the port and host
const PORT = Number(process.env.PORT) || 5000; // Ensure PORT is a number
const HOST = '0.0.0.0'; // Accept connections from any IP

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${getLocalIP()}:${PORT}`);
});