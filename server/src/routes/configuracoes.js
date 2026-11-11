// Endereços da API de configuracoes.
const express = require('express');
const ControladorConfiguracoes = require('../controllers/ControladorConfiguracoes');

const controlador = new ControladorConfiguracoes();
const router = express.Router();

router.use(controlador.exigirAdmin.bind(controlador));
router.get('/', controlador.consultar.bind(controlador));
router.put('/parametros', controlador.salvarParametros.bind(controlador));
router.post('/restaurar-padrao', controlador.restaurarPadrao.bind(controlador));
router.post('/testar-alerta', controlador.testarAlerta.bind(controlador));
router.get('/verificar-log', controlador.verificarLog.bind(controlador));
router.get('/backup', controlador.baixarBackup.bind(controlador));
router.put('/minha-conta', controlador.atualizarConta.bind(controlador));
router.put('/minha-senha', controlador.atualizarSenha.bind(controlador));
router.post('/usuarios', controlador.cadastrarUsuario.bind(controlador));
router.put('/usuarios/:id/perfil', controlador.alterarPerfil.bind(controlador));
router.put('/usuarios/:id/ativo', controlador.alterarStatus.bind(controlador));
router.put('/usuarios/:id/senha', controlador.redefinirSenha.bind(controlador));

module.exports = router;
