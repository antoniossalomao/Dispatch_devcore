// Endereços da API de auditoria.
const express = require('express');
const ControladorAuditoria = require('../controllers/ControladorAuditoria');
const { exigirAdmin } = require('../middlewares/autenticacao');

const controlador = new ControladorAuditoria();
const router = express.Router();

router.use(exigirAdmin);
router.get('/', controlador.listar.bind(controlador));
router.get('/integridade', controlador.verificarIntegridade.bind(controlador));

module.exports = router;
