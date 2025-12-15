const Room = require('../models/Room');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'pdf-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PDF'), false);
    }
};

exports.upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Upload PDF to room
exports.uploadPdf = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { totalPages } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó archivo PDF' });
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        // Update room with PDF info
        room.pdfActual = {
            filename: req.file.filename,
            path: req.file.path,
            totalPages: parseInt(totalPages) || 1,
            currentPage: 1,
            uploadedBy: req.user?.userId,
            uploadedAt: new Date()
        };

        await room.save();

        res.json({
            message: 'PDF subido exitosamente',
            pdf: room.pdfActual
        });
    } catch (error) {
        console.error('Error al subir PDF:', error);
        res.status(500).json({ error: 'Error al subir PDF' });
    }
};

// Get current PDF for room
exports.getPdf = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        if (!room.pdfActual || !room.pdfActual.filename) {
            return res.status(404).json({ error: 'No hay PDF compartido en esta sala' });
        }

        res.json({ pdf: room.pdfActual });
    } catch (error) {
        console.error('Error al obtener PDF:', error);
        res.status(500).json({ error: 'Error al obtener PDF' });
    }
};

// Update current page
exports.updatePage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { currentPage } = req.body;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ error: 'Sala no encontrada' });
        }

        if (!room.pdfActual) {
            return res.status(404).json({ error: 'No hay PDF compartido' });
        }

        room.pdfActual.currentPage = currentPage;
        await room.save();

        res.json({ currentPage: room.pdfActual.currentPage });
    } catch (error) {
        console.error('Error al actualizar página:', error);
        res.status(500).json({ error: 'Error al actualizar página' });
    }
};

// Serve PDF file
exports.servePdf = async (req, res) => {
    try {
        const { filename } = req.params;
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const filePath = path.join(uploadDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        res.sendFile(path.resolve(filePath));
    } catch (error) {
        console.error('Error al servir PDF:', error);
        res.status(500).json({ error: 'Error al servir PDF' });
    }
};
