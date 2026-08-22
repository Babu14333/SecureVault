const express = require('express');
const multer = require('multer');
const filesController = require('./controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Accept all user uploads up to 100MB
    cb(null, true);
  },
});

router.post('/upload', authenticate, upload.single('file'), filesController.upload);
router.get('/', authenticate, filesController.getFiles);
router.get('/stats', authenticate, filesController.getStats);
router.get('/download-temp/:token', filesController.downloadTemp);
router.post('/:id/download-token', authenticate, filesController.generateDownloadToken);
router.get('/:id', authenticate, filesController.getFile);
router.get('/:id/download', authenticate, filesController.download);
router.delete('/:id', authenticate, filesController.deleteFile);

module.exports = router;
