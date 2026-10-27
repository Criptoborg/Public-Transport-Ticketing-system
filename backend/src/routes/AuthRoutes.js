const express = require('express');
const { register, login, forgotPassword, resetPassword, getMe, updateMe, changePassword } = require('../controllers/AuthController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;
