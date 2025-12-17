require('dotenv').config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectMongoDB = require('./db/mongodb');
const Room = require('./models/Room');
const Message = require('./models/Message');
const path = require('path');

const app = express();
app.use(cors({
  origin: "*" // Allow all origins for local network access
}));
app.use(express.json());

// Connect to MongoDB
// Connect to MongoDB
connectMongoDB().then(async () => {
  // CLEANUP ON STARTUP
  try {
    console.log("🧹 Running startup cleanup...");

    // 1. Reset all participants in all rooms (since server restarted)
    await Room.updateMany({}, { $set: { participants: [], "participantes": [] } });
    console.log("✅ Reset all participants to empty.");

    // 2. Delete rooms that don't have a PDF and are empty? 
    // Or just delete ALL empty rooms?
    // User wants empty rooms to be gone.

    // Find rooms with no PDF and DELETE them?
    // Or finds rooms with PDF but nobody in them?
    const emptyRooms = await Room.find({ $or: [{ participantes: { $size: 0 } }, { participantes: { $exists: false } }] });


    for (const room of emptyRooms) {
      // Delete PDF file if exists
      if (room.pdfActual && room.pdfActual.path) {
        const fs = require('fs');
        const path = require('path');
        try {
          const filePath = path.resolve(room.pdfActual.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted orphan file: ${filePath}`);
          }
        } catch (e) { console.error("Error deleting file:", e); }
      }

      // Delete from MongoDB
      await Room.deleteOne({ _id: room._id });

      console.log(`Deleted stale room: ${room.roomId}`);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  // ... existing connection logic ...

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

      // 1. Try to update existing participant's socketId
      // We need to know if we replaced an OLD socketId to clean it up
      const existingRoom = await Room.findOne({ roomId, "participantes.userId": userObjectId });
      let oldSocketId = null;

      if (existingRoom) {
        const p = existingRoom.participantes.find(p => p.userId.toString() === userObjectId.toString());
        if (p && p.socketId !== socket.id) {
          oldSocketId = p.socketId;
          // Force cleanup for the old socket immediately
          console.log(`Replaceing old socket ${oldSocketId} for user ${userName}`);
          // Notify others that the OLD socket left (so they remove the peer/video)
          socket.to(roomId).emit("user-left", {
            socketId: oldSocketId,
            participants: existingRoom.participantes.filter(p => p.socketId !== oldSocketId)
            // Note: participants list above is "before" update, technically we should send updated list
            // But user-left mainly needs the socketId to destroy the peer.
          });
        }
      }

      room = await Room.findOneAndUpdate(
        { roomId, "participantes.userId": userObjectId },
        {
          $set: { "participantes.$.socketId": socket.id, "participantes.$.nombre": userName }
        },
        { new: true }
      );

      // 2. If user wasn't in list, push new participant
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
        // Ensure pdfData has presenters array initialized
        const newPdfData = {
          ...pdfData,
          presenters: [pdfData.uploadedBy] // Uploader is first presenter
        };
        room.pdfActual = newPdfData;
        await room.save();

        // Notify all users in room
        io.to(roomId).emit("pdf-state", newPdfData);
      }
    } catch (error) {
      console.error("Error updating PDF:", error);
    }
  });

  // Explicit Presentation Toggle
  socket.on("pdf-remove", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        // Delete file
        if (room.pdfActual.path) {
          const filePath = path.resolve(room.pdfActual.path);
          const fs = require('fs');
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
              if (err) console.error("Error deleting PDF:", err);
            });
          }
        }
        // Clear DB
        room.pdfActual = null;
        // Clear whiteboard? Yes, user said "Eliminar PDF for new one"
        // Maybe keep whiteboard if they reupload same? No, simpler to clear.
        room.whiteboard = [];
        await room.save();

        io.to(roomId).emit("pdf-removed");
      }
    } catch (e) {
      console.error("Error removing PDF:", e);
    }
  });

  socket.on("pdf-toggle-presentation", async ({ roomId, isPresenting }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        room.pdfActual.isPresenting = isPresenting;
        await room.save();
        // Broadcast update
        io.to(roomId).emit("pdf-state", room.pdfActual);
      }
    } catch (e) { console.error("Error toggling presentation", e); }
  });

  socket.on("pdf-update-metadata", async ({ roomId, totalPages }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        room.pdfActual.totalPages = totalPages;
        await room.save();
        // Broadcast update so everyone reflects correct total pages
        io.to(roomId).emit("pdf-state", room.pdfActual);
      }
    } catch (e) { console.error("Error updating PDF metadata:", e); }
  });

  socket.on("pdf-page-changed", async ({ roomId, currentPage, userId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {

        // PERMISSION CHECK: If linkedGroupId is set
        if (room.pdfActual.linkedGroupId) {
          const group = room.groups.find(g => g._id.toString() === room.pdfActual.linkedGroupId);
          if (group) {
            // Check if user is member
            const isMember = group.members.includes(userId);
            // Check permission (assuming canNavigate implies presenter role here, or add specific check)
            if (!isMember || !group.permissions.canNavigate) {
              console.warn(`User ${userId} denied navigation in room ${roomId}`);
              socket.emit("error-permission", { message: "You don't have permission to navigate." });
              return;
            }
          }
        }

        room.pdfActual.currentPage = currentPage;
        await room.save();

        // Broadcast to all users in room
        io.to(roomId).emit("pdf-page-update", { currentPage });
      }
    } catch (error) {
      console.error("Error updating PDF page:", error);
    }
  });

  socket.on("pdf-grant-presenter", async ({ roomId, targetUserId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        if (!room.pdfActual.presenters.includes(targetUserId)) {
          room.pdfActual.presenters.push(targetUserId);
          await room.save();
          io.to(roomId).emit("pdf-presenters-update", { presenters: room.pdfActual.presenters });
        }
      }
    } catch (error) {
      console.error("Error granting presenter:", error);
    }
  });

  socket.on("pdf-revoke-presenter", async ({ roomId, targetUserId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        room.pdfActual.presenters = room.pdfActual.presenters.filter(id => id !== targetUserId);
        await room.save();
        io.to(roomId).emit("pdf-presenters-update", { presenters: room.pdfActual.presenters });
      }
    } catch (error) {
      console.error("Error revoking presenter:", error);
    }
  });

  // Whiteboard events
  // Group Management Events
  socket.on("create-group", async ({ roomId, groupName, permissions, userId }) => { // Expect userId
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.groups.push({
          name: groupName,
          creatorId: userId,
          members: [userId], // Creator is first member
          requests: [],
          permissions
        });
        await room.save();
        io.to(roomId).emit("groups-update", room.groups);
      }
    } catch (e) { console.error("Error creating group:", e); }
  });

  socket.on("request-join-group", async ({ roomId, groupId, userId, userName }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const group = room.groups.id(groupId);
        if (group && !group.members.includes(userId)) {
          // Check if already requested
          const reqExists = group.requests.find(r => r.userId === userId);
          if (!reqExists) {
            group.requests.push({ userId, userName });
            await room.save();
            io.to(roomId).emit("groups-update", room.groups);
          }
        }
      }
    } catch (e) { console.error("Error requesting join:", e); }
  });

  socket.on("approve-join-request", async ({ roomId, groupId, targetUserId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const group = room.groups.id(groupId);
        if (group) {
          // Remove request
          group.requests = group.requests.filter(r => r.userId !== targetUserId);
          // Add member if not exists
          if (!group.members.includes(targetUserId)) {
            group.members.push(targetUserId);
          }
          await room.save();
          io.to(roomId).emit("groups-update", room.groups);
        }
      }
    } catch (e) { console.error("Error approving join:", e); }
  });

  socket.on("reject-join-request", async ({ roomId, groupId, targetUserId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const group = room.groups.id(groupId);
        if (group) {
          // Remove request
          group.requests = group.requests.filter(r => r.userId !== targetUserId);
          await room.save();
          io.to(roomId).emit("groups-update", room.groups);
        }
      }
    } catch (e) { console.error("Error rejecting join:", e); }
  });

  socket.on("delete-group", async ({ roomId, groupId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.groups = room.groups.filter(g => g._id.toString() !== groupId);
        // Also unlink PDF if linked
        if (room.pdfActual && room.pdfActual.linkedGroupId === groupId) {
          room.pdfActual.linkedGroupId = null;
          io.to(roomId).emit("pdf-state", room.pdfActual);
        }
        await room.save();
        io.to(roomId).emit("groups-update", room.groups);
      }
    } catch (e) { console.error("Error deleting group:", e); }
  });

  socket.on("add-group-member", async ({ roomId, groupId, userId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const group = room.groups.id(groupId);
        if (group && !group.members.includes(userId)) {
          group.members.push(userId);
          await room.save();
          io.to(roomId).emit("groups-update", room.groups);
        }
      }
    } catch (e) { console.error("Error adding group member:", e); }
  });

  socket.on("remove-group-member", async ({ roomId, groupId, userId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const group = room.groups.id(groupId);
        if (group) {
          group.members = group.members.filter(m => m !== userId);
          await room.save();
          io.to(roomId).emit("groups-update", room.groups);
        }
      }
    } catch (e) { console.error("Error removing group member:", e); }
  });

  socket.on("link-pdf-group", async ({ roomId, groupId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual) {
        room.pdfActual.linkedGroupId = groupId;
        await room.save();
        io.to(roomId).emit("pdf-state", room.pdfActual);
      }
    } catch (e) { console.error("Error linking PDF group:", e); }
  });


  // Whiteboard events
  socket.on("whiteboard-draw", async ({ roomId, line, userId, page }) => {
    // Check permissions if PDF is linked to a group
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.pdfActual && room.pdfActual.linkedGroupId) {
        const group = room.groups.find(g => g._id.toString() === room.pdfActual.linkedGroupId);
        if (group) {
          if (!group.members.includes(userId) || !group.permissions.canDraw) {
            // Deny
            socket.emit("error-permission", { message: "You don't have permission to draw." });
            return;
          }
        }
      }
    } catch (e) { console.error("Permission check error", e); }

    // Broadcast immediately (optimistic update)
    socket.to(roomId).emit("whiteboard-draw", { line, page });

    // Persist async per page
    try {
      // Use MongoDB update to push to specific page bucket
      // If page bucket doesn't exist, this is tricky with atomic operators.
      // We might need to findOne, modify, save.
      const room = await Room.findOne({ roomId });
      if (room) {
        let pageData = room.whiteboard.find(wb => wb.page === page);
        if (!pageData) {
          // Initialize page
          room.whiteboard.push({ page, lines: [line] });
        } else {
          pageData.lines.push(line);
        }
        await room.save();
      }
    } catch (err) { console.error("Error saving whiteboard line:", err); }
  });

  socket.on("whiteboard-clear", async ({ roomId, page }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        const pageData = room.whiteboard.find(wb => wb.page === page);
        if (pageData) {
          pageData.lines = [];
          await room.save();
        }
        io.to(roomId).emit("whiteboard-clear", { page });
      }
    } catch (error) {
      console.error("Error clearing whiteboard:", error);
    }
  });

  socket.on("remove-pdf", async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        room.pdfActual = undefined;
        room.whiteboard = { lines: [] }; // Reset whiteboard too
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

          // CLEANUP: If room is empty, delete it and associated PDF
          if (updatedRoom.participantes.length === 0) {
            console.log(`Room ${room.roomId} is empty. Cleaning up...`);

            // Delete PDF file if exists
            if (updatedRoom.pdfActual && updatedRoom.pdfActual.path) {
              const fs = require('fs');
              const path = require('path');
              const filePath = path.resolve(updatedRoom.pdfActual.path);

              fs.unlink(filePath, (err) => {
                if (err) console.error(`Error deleting file ${filePath}:`, err);
                else console.log(`Deleted file ${filePath}`);
              });
            }

            // Delete Room
            await Room.deleteOne({ _id: room._id });
            console.log(`Room ${room.roomId} deleted.`);
          } else {
            // Room not empty, but check if user was a GROUP CREATOR
            // Find the user ID from the original room state
            const leavingParticipant = room.participantes.find(p => p.socketId === socket.id);
            const userObjectId = leavingParticipant ? leavingParticipant.userId : null;

            if (userObjectId) {
              const userGroups = updatedRoom.groups.filter(g => g.creatorId === userObjectId.toString());
              if (userGroups.length > 0) {
                // Delete these groups
                updatedRoom.groups = updatedRoom.groups.filter(g => g.creatorId !== userObjectId.toString());
                // Unlink PDF if needed
                if (updatedRoom.pdfActual && userGroups.some(g => g._id.toString() === updatedRoom.pdfActual.linkedGroupId)) {
                  updatedRoom.pdfActual.linkedGroupId = null;
                }
                await updatedRoom.save();
                io.to(room.roomId).emit("groups-update", updatedRoom.groups);
                io.to(room.roomId).emit("pdf-state", updatedRoom.pdfActual);
              }
            }
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

