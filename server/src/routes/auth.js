// Rotas de entrada, saída, conferência da sessão e cadastro por convite.
const express = require('express');
const ControladorAutenticacao = require('../controllers/ControladorAutenticacao');

const controlador = new ControladorAutenticacao();
const router = express.Router();

router.post('/login', controlador.entrar.bind(controlador));
router.get('/cadastro-status', controlador.cadastroStatus.bind(controlador));
router.post('/cadastro', controlador.cadastrar.bind(controlador));
router.get('/eu', controlador.consultarSessao.bind(controlador));
router.post('/sair', controlador.sair.bind(controlador));
// Login com Google: status (mostra ou esconde o botão), ida ao Google e volta com o código.
router.get('/google/status', controlador.googleStatus.bind(controlador));
router.get('/google', controlador.googleIniciar.bind(controlador));
router.get('/google/retorno', controlador.googleRetorno.bind(controlador));
router.post('/google/cadastro', controlador.googleCadastro.bind(controlador));

module.exports = router;
