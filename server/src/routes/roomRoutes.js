const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

router.post('/', roomController.createRoom);
router.get('/:roomId', roomController.getRoom);
router.post('/join/:roomId', roomController.joinRoom);
router.post('/leave/:roomId', roomController.leaveRoom);
router.get('/:roomId/participants', roomController.getParticipants);

module.exports = router;
