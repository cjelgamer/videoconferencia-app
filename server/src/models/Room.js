const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    creador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    participantes: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        nombre: String,
        socketId: String,
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    pdfActual: {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Explicit ID
        filename: String,
        path: String,
        totalPages: Number,
        currentPage: { type: Number, default: 1 },
        uploadedBy: String,
        ownerId: String,
        uploadedAt: Date,
        presenters: [String],
        linkedGroupId: String, // Group ID allowed to control
        orientation: { type: Number, default: 0 },
        isPresenting: { type: Boolean, default: false }
    },
    groups: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        name: String,
        members: [String], // Store User IDs (strings)
        permissions: {
            canDraw: { type: Boolean, default: false },
            canNavigate: { type: Boolean, default: false }
        },
        createdAt: { type: Date, default: Date.now }
    }],
    whiteboard: {
        lines: [
            {
                points: [Number],
                color: String,
                width: Number,
                tool: String
            }
        ]
    },
    screenSharing: {
        active: {
            type: Boolean,
            default: false
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        socketId: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Room', roomSchema);
