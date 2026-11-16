// Endereços da API de relatorios.
const express = require('express');
const ControladorRelatorios = require('../controllers/ControladorRelatorios');
const { exigirLogin } = require('../middlewares/autenticacao');

const controlador = new ControladorRelatorios();
const router = express.Router();

router.use(exigirLogin);
router.get('/ocupacao', controlador.consultarOcupacao.bind(controlador));
router.get('/frota', controlador.consultarFrota.bind(controlador));
router.get('/movimentacoes', controlador.consultarMovimentacoes.bind(controlador));
router.get('/gargalos', controlador.consultarGargalos.bind(controlador));
router.get('/quem-dirigia', controlador.consultarCondutor.bind(controlador));

module.exports = router;
