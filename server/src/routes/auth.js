// Endereços da API de autenticacao.
const express = require('express');
const ControladorAutenticacao = require('../controllers/ControladorAutenticacao');

const controlador = new ControladorAutenticacao();
const router = express.Router();

router.post('/login', controlador.entrar.bind(controlador));
router.post('/cadastro', controlador.cadastrar.bind(controlador));
router.get('/eu', controlador.consultarSessao.bind(controlador));
router.post('/sair', controlador.sair.bind(controlador));

module.exports = router;
