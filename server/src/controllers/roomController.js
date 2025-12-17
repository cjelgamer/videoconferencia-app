const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');

// Create a new room
// Create a new room
exports.createRoom = async (req, res) => {
    try {
        const creatorId = req.user?.userId || req.body.creatorId || null;
        const roomId = uuidv4().substring(0, 8).toUpperCase(); // Short ID

        // Create in MongoDB
        try {
            const mongoRoom = new Room({
                roomId,
                creador: creatorId || undefined, // Use undefined instead of null for optional fields
                participantes: []
            });
            await mongoRoom.save();

            res.json({
                roomId,
                message: 'Sala creada exitosamente'
            });
        } catch (mongoErr) {
            console.error('MongoDB error:', mongoErr);
            res.status(500).json({ error: 'Database error' });
        }
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Error al crear sala' });
    }
};

// Get room info
exports.getRoom = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Get from MongoDB for full info
        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        res.json({ room });
    } catch (error) {
        console.error('Error getting room:', error);
        res.status(500).json({ error: 'Error al obtener sala' });
    }
};

// Join room
exports.joinRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId, nombre } = req.body;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        // Check if user already in room
        const existingParticipant = room.participantes.find(
            p => p.userId?.toString() === userId
        );

        if (!existingParticipant) {
            room.participantes.push({
                userId,
                nombre,
                joinedAt: new Date()
            });
            await room.save();
        }

        res.json({
            message: 'Unido a la sala exitosamente',
            room
        });
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ error: 'Error al unirse a la sala' });
    }
};

// Leave room
exports.leaveRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        room.participantes = room.participantes.filter(
            p => p.userId?.toString() !== userId
        );
        await room.save();

        res.json({ message: 'Saliste de la sala' });
    } catch (error) {
        console.error('Error leaving room:', error);
        res.status(500).json({ error: 'Error al salir de la sala' });
    }
};

// Get participants
exports.getParticipants = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        res.json({ participantes: room.participantes });
    } catch (error) {
        console.error('Error getting participants:', error);
        res.status(500).json({ error: 'Error al obtener participantes' });
    }
};
