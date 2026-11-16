// Endereços da API de pessoas.
const express = require('express');
const ControladorPessoas = require('../controllers/ControladorPessoas');
const { exigirLogin, exigirAdmin } = require('../middlewares/autenticacao');

const controlador = new ControladorPessoas();
const router = express.Router();

router.use(exigirLogin);
router.get('/', controlador.listar.bind(controlador));
router.get('/:id', controlador.buscarPorId.bind(controlador));
router.post('/', controlador.cadastrar.bind(controlador));
router.put('/:id', controlador.atualizar.bind(controlador));
router.put('/:id/status', controlador.alterarStatus.bind(controlador));
router.post('/seed-exemplos', exigirAdmin, controlador.carregarExemplos.bind(controlador));

module.exports = router;
