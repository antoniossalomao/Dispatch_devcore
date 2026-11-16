// Rotas da frota: cadastro de veículos, retiradas, retornos e manutenções.
const express = require('express');
const ControladorFrota = require('../controllers/ControladorFrota');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorFrota();
const router = express.Router();

// Exige usuário logado para todas as rotas de veículos abaixo.
router.use(controleAcesso.exigirLogin);
router.post('/usos', controlador.registrarSaida.bind(controlador));
router.put('/usos/:id/retorno', controlador.registrarRetorno.bind(controlador));
router.put('/manutencoes/:id/concluir', controlador.concluirManutencao.bind(controlador));
router.get('/', controlador.listar.bind(controlador));
router.get('/:id', controlador.buscarPorId.bind(controlador));
router.post('/', controlador.cadastrar.bind(controlador));
router.put('/:id', controlador.atualizar.bind(controlador));
router.put('/:id/status', controlador.alterarStatus.bind(controlador));
router.post('/:id/manutencoes', controlador.registrarManutencao.bind(controlador));

module.exports = router;
