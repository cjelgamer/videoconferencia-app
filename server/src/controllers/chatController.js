const Message = require('../models/Message');

// Get chat messages for a room
exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const limit = parseInt(req.query.limit) || 100;

        const messages = await Message.find({ roomId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        // Reverse to show oldest first
        messages.reverse();

        res.json({ messages });
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
};

// Save a message (also sent via socket)
exports.saveMessage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId, userName, texto } = req.body;

        if (!texto || !texto.trim()) {
            return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
        }

        const message = new Message({
            roomId,
            userId,
            userName,
            texto: texto.trim()
        });

        await message.save();

        res.status(201).json({ message });
    } catch (error) {
        console.error('Error al guardar mensaje:', error);
        res.status(500).json({ error: 'Error al guardar mensaje' });
    }
};
