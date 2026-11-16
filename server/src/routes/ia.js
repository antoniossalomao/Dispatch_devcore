// Endereços da API de ia.
const express = require('express');
const ControladorIA = require('../controllers/ControladorIA');
const { exigirLogin } = require('../middlewares/autenticacao');

const controlador = new ControladorIA();
const router = express.Router();

router.use(exigirLogin);
router.post('/perguntar', controlador.perguntar.bind(controlador));
router.post('/resumo', controlador.resumir.bind(controlador));
router.post('/suporte', controlador.responderSuporte.bind(controlador));

module.exports = router;
