// Endereços da API de frota.
const express = require('express');
const ControladorFrota = require('../controllers/ControladorFrota');

const controlador = new ControladorFrota();
const router = express.Router();

router.use(controlador.exigirLogin.bind(controlador));
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
