const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getReservasPorFecha,
  crearReservaSala,
} = require('../controllers/reservaSalaController');

const router = express.Router();

// Todos los endpoints requieren sesión activa
router.use(verifyToken);

router.get('/', getReservasPorFecha);
router.post('/', crearReservaSala);

module.exports = router;