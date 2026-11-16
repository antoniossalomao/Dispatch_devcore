// Rotas do histórico de auditoria e conferência dos hashes salvos no banco.
const express = require('express');
const ControladorAuditoria = require('../controllers/ControladorAuditoria');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorAuditoria();
const router = express.Router();

// Apenas administradores podem consultar os registros de auditoria.
router.use(controleAcesso.exigirAdmin);
router.get('/', controlador.listar.bind(controlador));
router.get('/integridade', controlador.verificarIntegridade.bind(controlador));

module.exports = router;
