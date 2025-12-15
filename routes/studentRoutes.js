const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authorizeStudent, authorizeInstructor } = require('../middleware/auth');

router.post('/register', studentController.register);
router.post('/login', studentController.login);
router.get('/', authenticate, authorizeInstructor, studentController.getAll);
router.get('/progress/:studentId', authenticate, authorizeStudent, require('../controllers/progressController').getStudentProgress);

module.exports = router;