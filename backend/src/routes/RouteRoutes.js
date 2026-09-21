const express = require('express');
const controller = require('../controllers/RouteController');
const verifyToken = require('../middleware/verifyToken');
const authorizeRole = require('../middleware/authorizeRole');

const router = express.Router();
router.get('/', verifyToken, controller.getRoutes);
router.get('/:id', verifyToken, controller.getRoute);
router.post('/', verifyToken, authorizeRole('admin'), controller.createRoute);
router.put('/:id', verifyToken, authorizeRole('admin'), controller.updateRoute);
router.delete('/:id', verifyToken, authorizeRole('admin'), controller.deleteRoute);

module.exports = router;
