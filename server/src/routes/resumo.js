// Endereços da API de resumo.
const express = require('express');
const ControladorResumo = require('../controllers/ControladorResumo');
const { exigirLogin } = require('../middlewares/autenticacao');

const controlador = new ControladorResumo();
const router = express.Router();

router.use(exigirLogin);
router.get('/', controlador.consultar.bind(controlador));

module.exports = router;
