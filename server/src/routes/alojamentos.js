// Endereços da API de alojamentos.
const express = require('express');
const ControladorAlojamentos = require('../controllers/ControladorAlojamentos');

const controlador = new ControladorAlojamentos();
const router = express.Router();

router.use(controlador.exigirLogin.bind(controlador));
router.post('/estadias', controlador.alojar.bind(controlador));
router.put('/estadias/:id/saida', controlador.registrarSaida.bind(controlador));
router.put('/ocorrencias/:id/resolver', controlador.resolverOcorrencia.bind(controlador));
router.get('/', controlador.listar.bind(controlador));
router.get('/:id', controlador.buscarPorId.bind(controlador));
router.post('/', controlador.cadastrar.bind(controlador));
router.put('/:id', controlador.atualizar.bind(controlador));
router.put('/:id/status', controlador.alterarStatus.bind(controlador));
router.post('/:id/quartos', controlador.cadastrarQuarto.bind(controlador));
router.post('/:id/ocorrencias', controlador.registrarOcorrencia.bind(controlador));

module.exports = router;
