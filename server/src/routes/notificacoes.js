// Rotas dos alertas e notificações do sistema.
const express = require('express');
const ControladorNotificacoes = require('../controllers/ControladorNotificacoes');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorNotificacoes();
const router = express.Router();

// Usuário precisa estar logado para ver e dar baixa nos avisos.
router.use(controleAcesso.exigirLogin);
router.get('/', controlador.listar.bind(controlador));
router.put('/lidas', controlador.marcarTodasComoLidas.bind(controlador));
router.put('/:id/lida', controlador.marcarComoLida.bind(controlador));

module.exports = router;
