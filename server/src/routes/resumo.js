// Endereços da API de resumo.
const express = require('express');
const ControladorResumo = require('../controllers/ControladorResumo');

const controlador = new ControladorResumo();
const router = express.Router();

router.get('/', controlador.consultar.bind(controlador));

module.exports = router;
