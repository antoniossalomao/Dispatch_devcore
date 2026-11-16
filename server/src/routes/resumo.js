// Rota do painel inicial (resumo geral e últimos acontecimentos).
const express = require('express');
const ControladorResumo = require('../controllers/ControladorResumo');
const controleAcesso = require('../middlewares/autenticacao');

const controlador = new ControladorResumo();
const router = express.Router();

// Só mostra os números do painel para quem estiver logado.
router.use(controleAcesso.exigirLogin);
router.get('/', controlador.consultar.bind(controlador));

module.exports = router;
