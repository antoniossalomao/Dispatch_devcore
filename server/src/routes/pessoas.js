// Rotas de cadastro e consulta dos colaboradores e motoristas.
const express = require('express');
const ControladorPessoas = require('../controllers/ControladorPessoas');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorPessoas();
const router = express.Router();

// Todas as rotas exigem login; gerar exemplos de teste exige também perfil admin.
router.use(controleAcesso.exigirLogin);
router.get('/', controlador.listar.bind(controlador));
router.get('/:id', controlador.buscarPorId.bind(controlador));
router.post('/', controlador.cadastrar.bind(controlador));
router.put('/:id', controlador.atualizar.bind(controlador));
router.put('/:id/status', controlador.alterarStatus.bind(controlador));
router.post('/seed-exemplos', controleAcesso.exigirAdmin, controlador.carregarExemplos.bind(controlador));

module.exports = router;
