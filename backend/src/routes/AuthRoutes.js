const express = require('express');
const { register, login, forgotPassword, resetPassword, getMe, updateMe, changePassword, acceptCurrentTerms, exportMyData, deleteMe } = require('../controllers/AuthController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);
router.post('/me/accept-terms', verifyToken, acceptCurrentTerms);
router.post('/change-password', verifyToken, changePassword);
router.get('/me/export', verifyToken, exportMyData);
router.delete('/me', verifyToken, deleteMe);

module.exports = router;
