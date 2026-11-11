// Endereços da API de pessoas.
const express = require('express');
const ControladorPessoas = require('../controllers/ControladorPessoas');

const controlador = new ControladorPessoas();
const router = express.Router();

router.use(controlador.exigirLogin.bind(controlador));
router.get('/', controlador.listar.bind(controlador));
router.get('/:id', controlador.buscarPorId.bind(controlador));
router.post('/', controlador.cadastrar.bind(controlador));
router.put('/:id', controlador.atualizar.bind(controlador));
router.put('/:id/status', controlador.alterarStatus.bind(controlador));
router.post('/seed-exemplos', controlador.carregarExemplos.bind(controlador));

module.exports = router;
