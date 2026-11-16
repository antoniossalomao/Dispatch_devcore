// Rotas do assistente de IA (perguntas operacionais, resumos e suporte).
const express = require('express');
const ControladorIA = require('../controllers/ControladorIA');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorIA();
const router = express.Router();

// Só usuários autenticados podem enviar perguntas para a IA.
router.use(controleAcesso.exigirLogin);
router.post('/perguntar', controlador.perguntar.bind(controlador));
router.post('/resumo', controlador.resumir.bind(controlador));
router.post('/suporte', controlador.responderSuporte.bind(controlador));

module.exports = router;
