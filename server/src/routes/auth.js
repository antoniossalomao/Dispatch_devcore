// Rotas de entrada, saída, conferência da sessão e cadastro por convite (com senha ou com Google).
const express = require('express');
const ControladorAutenticacao = require('../controllers/ControladorAutenticacao');
const ControladorLoginGoogle = require('../controllers/ControladorLoginGoogle');

const controlador = new ControladorAutenticacao();
const controladorGoogle = new ControladorLoginGoogle();
const router = express.Router();

router.post('/login', controlador.entrar.bind(controlador));
router.get('/cadastro-status', controlador.cadastroStatus.bind(controlador));
router.post('/cadastro', controlador.cadastrar.bind(controlador));
router.get('/eu', controlador.consultarSessao.bind(controlador));
router.post('/sair', controlador.sair.bind(controlador));
// Login com Google: status (mostra ou esconde o botão), ida ao Google e volta com o código.
router.get('/google/status', controladorGoogle.googleStatus.bind(controladorGoogle));
router.get('/google', controladorGoogle.googleIniciar.bind(controladorGoogle));
router.get('/google/retorno', controladorGoogle.googleRetorno.bind(controladorGoogle));
router.post('/google/cadastro', controladorGoogle.googleCadastro.bind(controladorGoogle));

module.exports = router;
