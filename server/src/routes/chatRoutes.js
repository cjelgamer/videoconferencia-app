const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/:roomId', chatController.getMessages);
router.post('/:roomId', chatController.saveMessage);

module.exports = router;
