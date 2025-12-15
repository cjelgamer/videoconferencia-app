require('dotenv').config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectMongoDB = require('./db/mongodb');
const Room = require('./models/Room');
const Message = require('./models/Message');

const app = express();
app.use(cors({
  origin: "*" // Allow all origins for local network access
}));
app.use(express.json());

// Connect to MongoDB
connectMongoDB();

// Routes
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const chatRoutes = require('./routes/chatRoutes');
const pdfRoutes = require('./routes/pdfRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pdf', pdfRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Socket.IO connection handling
io.on("connection", socket => {
  console.log("Usuario conectado:", socket.id);

  // Join room
  socket.on("join-room", async ({ roomId, userId, userName }) => {
    try {
      socket.join(roomId);
      console.log(`${userName} (${socket.id}) joined room ${roomId}`);

      let room;
      let userObjectId;

      // Robust ID handling
      try {
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(userId)) {
          userObjectId = new mongoose.Types.ObjectId(userId);
        } else {
          console.warn(`[WARN] Invalid ObjectId received: ${userId}. Using as string/raw.`);
          userObjectId = userId; // Fallback (might fail schema validation but won't crash process)
        }
      } catch (e) {
        console.error(`[ERROR] ID casting failed for ${userId}:`, e);
        userObjectId = userId;
      }

      // 1. Try to update existing participant's socketId (Atomic)
      room = await Room.findOneAndUpdate(
        { roomId, "participantes.userId": userObjectId },
        {
          $set: { "participantes.$.socketId": socket.id, "participantes.$.nombre": userName }
        },
        { new: true }
      );

      // 2. If user wasn't in list, push new participant (Atomic)
      if (!room) {
        room = await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              participantes: {
                userId: userObjectId,
                nombre: userName,
                socketId: socket.id,
                joinedAt: new Date()
              }
            }
          },
          { new: true }
        );
      }

      if (room) {
        // Notify others in the room
        socket.to(roomId).emit("user-joined", {
          userId,
          userName,
          participants: room.participantes
        });

        // Send current participants (and PDF state) to the new user
        socket.emit("room-participants", room.participantes);

        if (room.pdfActual && room.pdfActual.filename) {
          socket.emit("pdf-state", room.pdfActual);
        }

        if (room.screenSharing?.active) {
          socket.emit("screen-share-active", {
            userId: room.screenSharing.userId,
            socketId: room.screenSharing.socketId
          });
        }
      }
    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  // WebRTC signaling
  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", data);
  });

  // Offer/Answer for WebRTC
  socket.on("offer", ({ roomId, offer, to }) => {
    socket.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ roomId, answer, to }) => {
    socket.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate, to }) => {
    socket.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  // Chat messages
  socket.on("send-message", async ({ roomId, userId, userName, texto }) => {
    try {
      // Save to MongoDB
      const message = new Message({
        roomId,
        userId,
        userName,
        texto
      });
      await message.save();

      // Broadcast to all in room including sender
      io.to(roomId).emit("receive-message", {
        _id: message._id,
        userId,
        userName,
        texto,
        timestamp: message.timestamp
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  // PDF sharing events
  socket.on("pdf-uploaded", async ({ roomId, pdfData }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.pdfActual = pdfData;
        await room.save();

        // Notify all users in room
        io.to(roomId).emit("pdf-state", pdfData);
      }
    } catch (error) {
      console.error("Error updating PDF:", error);
    }
  });

  socket.on("pdf-page-changed", async ({ roomId, currentPage }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        room.pdfActual.currentPage = currentPage;
        await room.save();

        // Broadcast to all users in room
        io.to(roomId).emit("pdf-page-update", { currentPage });
      }
    } catch (error) {
      console.error("Error updating PDF page:", error);
    }
  });

  socket.on("remove-pdf", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.pdfActual = undefined;
        await room.save();

        io.to(roomId).emit("pdf-removed");
      }
    } catch (error) {
      console.error("Error removing PDF:", error);
    }
  });

  // Screen sharing events
  socket.on("request-screen-share", ({ roomId, userId, userName }) => {
    io.to(roomId).emit("screen-share-requested", { userId, userName });
  });

  socket.on("screen-share-started", async ({ roomId, userId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.screenSharing = {
          active: true,
          userId,
          socketId: socket.id
        };
        await room.save();

        io.to(roomId).emit("screen-share-active", { userId, socketId: socket.id });
      }
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  });

  socket.on("screen-share-stopped", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.screenSharing = {
          active: false,
          userId: null,
          socketId: null
        };
        await room.save();

        io.to(roomId).emit("screen-share-ended");
      }
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  });

  // Active speaker detection
  socket.on("user-speaking", ({ roomId, userId, userName }) => {
    socket.to(roomId).emit("user-speaking", { userId, userName, socketId: socket.id });
  });

  socket.on("user-stopped-speaking", ({ roomId, userId }) => {
    socket.to(roomId).emit("user-stopped-speaking", { userId, socketId: socket.id });
  });

  // Audio/Video state changes
  socket.on("toggle-audio", ({ roomId, userId, audioEnabled }) => {
    socket.to(roomId).emit("user-audio-toggled", { userId, audioEnabled, socketId: socket.id });
  });

  socket.on("toggle-video", ({ roomId, userId, videoEnabled }) => {
    socket.to(roomId).emit("user-video-toggled", { userId, videoEnabled, socketId: socket.id });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    console.log("Usuario desconectado:", socket.id);

    try {
      // Find rooms where this socket was a participant
      const rooms = await Room.find({ "participantes.socketId": socket.id });

      for (const room of rooms) {
        // Atomic pull to remove participant logic
        // We want to KEEP the user in the DB (for history?) or REMOVE?
        // Usually, in a meeting, if you leave, you leave.
        // Let's remove them from the active participants list.

        const updatedRoom = await Room.findOneAndUpdate(
          { _id: room._id },
          {
            $pull: { participantes: { socketId: socket.id } },
            $set: {
              // If he was sharing screen, reset it
              ...(room.screenSharing?.socketId === socket.id ? {
                screenSharing: { active: false, userId: null, socketId: null }
              } : {})
            }
          },
          { new: true }
        );

        if (updatedRoom) {
          io.to(room.roomId).emit("user-left", {
            socketId: socket.id,
            participants: updatedRoom.participantes
          });

          if (room.screenSharing?.socketId === socket.id) {
            io.to(room.roomId).emit("screen-share-ended");
          }
        }
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on port ${PORT} (accessible via LAN)`);
});

