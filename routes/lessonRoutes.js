const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const { authenticate, authorizeInstructor } = require('../middleware/auth');

router.post('/', authenticate, authorizeInstructor, lessonController.create);
router.get('/', authenticate, lessonController.getAll);

module.exports = router;