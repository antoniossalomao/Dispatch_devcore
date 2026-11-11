// Endereços da API de notificacoes.
const express = require('express');
const ControladorNotificacoes = require('../controllers/ControladorNotificacoes');

const controlador = new ControladorNotificacoes();
const router = express.Router();

router.use(controlador.exigirLogin.bind(controlador));
router.get('/', controlador.listar.bind(controlador));
router.put('/lidas', controlador.marcarTodasComoLidas.bind(controlador));
router.put('/:id/lida', controlador.marcarComoLida.bind(controlador));

module.exports = router;
