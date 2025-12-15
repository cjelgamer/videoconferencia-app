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
        filename: String,
        path: String,
        totalPages: Number,
        currentPage: {
            type: Number,
            default: 1
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: Date
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
