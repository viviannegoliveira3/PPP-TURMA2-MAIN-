const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const { authenticate, authorizeInstructor } = require('../middleware/auth');

router.post('/register', instructorController.register);
router.post('/login', instructorController.login);
router.get('/', authenticate, authorizeInstructor, instructorController.getAll);

module.exports = router;