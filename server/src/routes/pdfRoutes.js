const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const authController = require('../controllers/authController');

router.post('/upload/:roomId', authController.verifyToken, pdfController.upload.single('pdf'), pdfController.uploadPdf);
router.get('/:roomId', pdfController.getPdf);
router.put('/:roomId/page', pdfController.updatePage);
router.get('/file/:filename', pdfController.servePdf);

module.exports = router;
