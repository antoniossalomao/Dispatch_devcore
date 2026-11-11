// Controla a tela de configuracoes.
class TelaConfiguracoes {
  constructor() {
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.avisoTela = document.getElementById('aviso-tela');
    this.seloAlterado = document.getElementById('selo-alterado');
    this.toast = document.getElementById('toast-retorno');
    this.botoesNav = document.querySelectorAll('.config-nav-item');
    this.paineis = {
      regras: document.getElementById('painel-regras'),
      alertas: document.getElementById('painel-alertas'),
      usuarios: document.getElementById('painel-usuarios'),
      banco: document.getElementById('painel-banco'),
      auditoria: document.getElementById('painel-auditoria'),
      conta: document.getElementById('painel-conta')
    };
    this.formRegras = document.getElementById('painel-regras');
    this.formAlertas = document.getElementById('form-alertas');
    this.botaoRestaurar = document.getElementById('botao-restaurar');
    this.cfgEmpresa = document.getElementById('cfg-empresa');
    this.cfgCidade = document.getElementById('cfg-cidade');
    this.cfgDocumento = document.getElementById('cfg-documento');
    this.cfgKmConfirmacao = document.getElementById('cfg-km-confirmacao');
    this.cfgHorasRetorno = document.getElementById('cfg-horas-retorno');
    this.cfgBloquearDoc = document.getElementById('cfg-bloquear-doc');
    this.cfgAvisarSeguro = document.getElementById('cfg-avisar-seguro');
    this.cfgMaxLeitos = document.getElementById('cfg-max-leitos');
    this.cfgAreaCama = document.getElementById('cfg-area-cama');
    this.cfgAreaBeliche = document.getElementById('cfg-area-beliche');
    this.cfgValidarNr24 = document.getElementById('cfg-validar-nr24');
    this.cfgDiasVencimento = document.getElementById('cfg-dias-vencimento');
    this.cfgDiasPendencia = document.getElementById('cfg-dias-pendencia');
    this.cfgLotacaoPct = document.getElementById('cfg-lotacao-pct');
    this.cfgTelegram = document.getElementById('cfg-telegram');
    this.badgeIa = document.getElementById('badge-ia');
    this.descIa = document.getElementById('desc-ia');
    this.badgeTelegram = document.getElementById('badge-telegram');
    this.descTelegram = document.getElementById('desc-telegram');
    this.botaoTestarAlerta = document.getElementById('botao-testar-alerta');
    this.caixaPreviaAlerta = document.getElementById('caixa-previa-alerta');
    this.textoPreviaAlerta = document.getElementById('texto-previa-alerta');
    this.contAtivos = document.getElementById('cont-ativos');
    this.contAdmins = document.getElementById('cont-admins');
    this.contOperadores = document.getElementById('cont-operadores');
    this.contInativos = document.getElementById('cont-inativos');
    this.abrirNovoUsuario = document.getElementById('abrir-novo-usuario');
    this.fecharNovoUsuario = document.getElementById('fechar-novo-usuario');
    this.formNovoUsuario = document.getElementById('form-novo-usuario');
    this.buscaUsuario = document.getElementById('busca-usuario');
    this.tabelaUsuarios = document.getElementById('tabela-usuarios');
    this.novoNome = document.getElementById('novo-nome');
    this.novoLogin = document.getElementById('novo-login');
    this.novoTelefone = document.getElementById('novo-telefone');
    this.novoPerfil = document.getElementById('novo-perfil');
    this.novoSenha = document.getElementById('novo-senha');
    this.caixaRedefinir = document.getElementById('caixa-redefinir');
    this.redefinirRotulo = document.getElementById('redefinir-rotulo');
    this.redefinirInput = document.getElementById('redefinir-input');
    this.redefinirSalvar = document.getElementById('redefinir-salvar');
    this.redefinirCancelar = document.getElementById('redefinir-cancelar');
    this.linkBackup = document.getElementById('link-backup');
    this.dbTamanho = document.getElementById('db-tamanho');
    this.dbTabelas = document.getElementById('db-tabelas');
    this.dbPessoas = document.getElementById('db-pessoas');
    this.dbLogs = document.getElementById('db-logs');
    this.botaoVerificarLog = document.getElementById('botao-verificar-log');
    this.caixaIntegridade = document.getElementById('caixa-integridade');
    this.integridadeTitulo = document.getElementById('integridade-titulo');
    this.integridadeMotivo = document.getElementById('integridade-motivo');
    this.tabelaLogsRecentes = document.getElementById('tabela-logs-recentes');
    this.formMinhaConta = document.getElementById('form-minha-conta');
    this.contaAvatarPrevia = document.getElementById('conta-avatar-previa');
    this.contaTituloPrevia = document.getElementById('conta-titulo-previa');
    this.contaLoginPrevia = document.getElementById('conta-login-previa');
    this.contaNome = document.getElementById('conta-nome');
    this.contaTelefone = document.getElementById('conta-telefone');
    this.formMinhaSenha = document.getElementById('form-minha-senha');
    this.senhaAtual = document.getElementById('senha-atual');
    this.senhaNova = document.getElementById('senha-nova');
    this.senhaConfirmar = document.getElementById('senha-confirmar');
    this.mostrarSenhasConta = document.getElementById('mostrar-senhas-conta');
    this.meuId = null;
    this.meuLogin = '';
    this.todosUsuarios = [];
    this.usuarioRedefinindoId = null;
    this.timerToast = null;
    this.linkBackup.href = baseApi + '/api/configuracoes/backup';
    this.camposMonitorados = [
      this.cfgEmpresa,
      this.cfgCidade,
      this.cfgDocumento,
      this.cfgKmConfirmacao,
      this.cfgHorasRetorno,
      this.cfgBloquearDoc,
      this.cfgAvisarSeguro,
      this.cfgMaxLeitos,
      this.cfgAreaCama,
      this.cfgAreaBeliche,
      this.cfgValidarNr24,
      this.cfgDiasVencimento,
      this.cfgDiasPendencia,
      this.cfgLotacaoPct,
      this.cfgTelegram
    ];
    this.parametrosSalvos = null;
    this.linksEmBreve = document.querySelectorAll('.menu-em-breve');
    this.configurarEventos();
    this.carregarDados();
  }

  configurarEventos() {
    this.botoesNav.forEach((botao) => {
      botao.addEventListener('click', () => {
        const alvo = botao.dataset.aba;
        if (window.location.hash !== '#' + alvo) history.pushState(null, '', '#' + alvo);
        this.abrirAbaConfig(alvo);
      });
    });
    window.addEventListener('hashchange', () => {
      this.abrirAbaConfig(window.location.hash.slice(1));
    });
    this.camposMonitorados.forEach((campo) => {
      campo.addEventListener('input', this.atualizarEstadoParametros.bind(this));
      campo.addEventListener('change', this.atualizarEstadoParametros.bind(this));
    });
    window.addEventListener('beforeunload', (evento) => {
      if (this.atualizarEstadoParametros()) {
        evento.preventDefault();
        evento.returnValue = '';
      }
    });
    this.atualizarEstadoParametros();
    this.formRegras.addEventListener('submit', this.salvarParametros.bind(this));
    this.formAlertas.addEventListener('submit', this.salvarParametros.bind(this));
    this.botaoRestaurar.addEventListener('click', this.restaurarParametros.bind(this));
    this.botaoTestarAlerta.addEventListener('click', this.testarAlerta.bind(this));
    this.abrirNovoUsuario.addEventListener('click', () => {
      this.formNovoUsuario.hidden = false;
      this.novoNome.focus();
    });
    this.fecharNovoUsuario.addEventListener('click', () => {
      this.formNovoUsuario.hidden = true;
    });
    this.buscaUsuario.addEventListener('input', () => {
      this.desenharUsuarios();
    });
    this.redefinirCancelar.addEventListener('click', () => {
      this.caixaRedefinir.hidden = true;
      this.usuarioRedefinindoId = null;
    });
    this.redefinirSalvar.addEventListener('click', this.salvarSenhaUsuario.bind(this));
    this.formNovoUsuario.addEventListener('submit', this.cadastrarUsuario.bind(this));
    this.botaoVerificarLog.addEventListener('click', this.verificarIntegridade.bind(this));
    this.contaNome.addEventListener('input', () => {
      const nome = this.contaNome.value.trim() || 'Administrador';
      this.contaTituloPrevia.textContent = nome;
      this.contaAvatarPrevia.textContent = this.pegarIniciais(nome);
    });
    this.mostrarSenhasConta.addEventListener('change', () => {
      const tipo = this.mostrarSenhasConta.checked ? 'text' : 'password';
      this.senhaAtual.type = tipo;
      this.senhaNova.type = tipo;
      this.senhaConfirmar.type = tipo;
    });
    this.formMinhaConta.addEventListener('submit', this.salvarMinhaConta.bind(this));
    this.formMinhaSenha.addEventListener('submit', this.salvarMinhaSenha.bind(this));
    this.linksEmBreve.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.mostrarAvisoTopo('Módulo "' + link.dataset.tela + '" em construção.');
      });
    });
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
  }

  async restaurarParametros() {
    if (
      !(await confirmar(
        'As regras atuais e as alterações não salvas serão substituídas pelos parâmetros padrão.',
        {
          titulo: 'Restaurar parâmetros padrão',
          confirmar: 'Restaurar padrões'
        }
      ))
    )
      return;
    const r = await chamarApi('/api/configuracoes/restaurar-padrao', {
      metodo: 'POST'
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Não foi possível restaurar.', 'erro');
      return;
    }
    this.preencherParametros(r.dados.parametros);
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  async testarAlerta() {
    const r = await chamarApi('/api/configuracoes/testar-alerta', {
      metodo: 'POST'
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao simular alerta.', 'erro');
      return;
    }
    this.textoPreviaAlerta.textContent = r.dados.previa;
    this.caixaPreviaAlerta.hidden = false;
    this.mostrarToast(r.dados.mensagem, 'ok');
  }

  async salvarSenhaUsuario() {
    if (!this.usuarioRedefinindoId) {
      return;
    }
    const r = await chamarApi(
      '/api/configuracoes/usuarios/' + this.usuarioRedefinindoId + '/senha',
      {
        metodo: 'PUT',
        corpo: {
          novaSenha: this.redefinirInput.value
        }
      }
    );
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao redefinir a senha.', 'erro');
      return;
    }
    this.caixaRedefinir.hidden = true;
    this.usuarioRedefinindoId = null;
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  async cadastrarUsuario(e) {
    e.preventDefault();
    const r = await chamarApi('/api/configuracoes/usuarios', {
      metodo: 'POST',
      corpo: {
        nome: this.novoNome.value,
        login: this.novoLogin.value,
        telegram_chat_id: this.novoTelefone.value,
        perfil: this.novoPerfil.value,
        senha: this.novoSenha.value
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao cadastrar usuário.', 'erro');
      return;
    }
    this.formNovoUsuario.reset();
    this.formNovoUsuario.hidden = true;
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  async verificarIntegridade() {
    const r = await chamarApi('/api/configuracoes/verificar-log');
    if (!r.ok) {
      this.mostrarToast('Não foi possível verificar o log.', 'erro');
      return;
    }
    this.desenharBanco(r.dados.banco);
    this.mostrarToast('Verificação de integridade concluída.', 'ok');
  }

  async salvarMinhaConta(e) {
    e.preventDefault();
    const r = await chamarApi('/api/configuracoes/minha-conta', {
      metodo: 'PUT',
      corpo: {
        nome: this.contaNome.value,
        telegram_chat_id: this.contaTelefone.value
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao atualizar dados.', 'erro');
      return;
    }
    const novoNome = r.dados.usuario.nome;
    this.perfilNome.textContent = novoNome;
    this.usuarioIniciais.textContent = this.pegarIniciais(novoNome);
    this.contaTituloPrevia.textContent = novoNome;
    this.contaAvatarPrevia.textContent = this.pegarIniciais(novoNome);
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  async salvarMinhaSenha(e) {
    e.preventDefault();
    if (this.senhaNova.value !== this.senhaConfirmar.value) {
      this.mostrarToast('A confirmação da nova senha não confere.', 'erro');
      return;
    }
    const r = await chamarApi('/api/configuracoes/minha-senha', {
      metodo: 'PUT',
      corpo: {
        senhaAtual: this.senhaAtual.value,
        novaSenha: this.senhaNova.value
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao alterar a senha.', 'erro');
      return;
    }
    this.formMinhaSenha.reset();
    this.senhaAtual.type = 'password';
    this.senhaNova.type = 'password';
    this.senhaConfirmar.type = 'password';
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  pegarIniciais(nome) {
    const texto = (nome || '').trim();
    if (texto === '') {
      return '--';
    }
    const partes = texto.split(' ');
    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  mostrarToast(texto, tipo) {
    this.toast.textContent = texto;
    this.toast.className = tipo === 'erro' ? 'toast toast-erro' : 'toast';
    this.toast.hidden = false;
    if (this.timerToast) {
      clearTimeout(this.timerToast);
    }
    this.timerToast = setTimeout(() => {
      this.toast.hidden = true;
    }, 3200);
  }

  mostrarAvisoTopo(texto) {
    this.avisoTela.textContent = texto;
    this.avisoTela.hidden = false;
    setTimeout(() => {
      this.avisoTela.hidden = true;
    }, 2600);
  }

  abrirAbaConfig(alvo) {
    if (!Object.prototype.hasOwnProperty.call(this.paineis, alvo)) alvo = 'regras';
    this.botoesNav.forEach((botao) => {
      const ativa = botao.dataset.aba === alvo;
      botao.classList.toggle('ativa', ativa);
      if (ativa) botao.setAttribute('aria-current', 'true');
      else botao.removeAttribute('aria-current');
    });
    Object.keys(this.paineis).forEach((chave) => {
      this.paineis[chave].hidden = chave !== alvo;
    });
    document.dispatchEvent(
      new CustomEvent('dispatch:config-aba', {
        detail: alvo
      })
    );
  }

  atualizarEstadoParametros() {
    const alterados =
      this.parametrosSalvos !== null &&
      this.parametrosSalvos !== JSON.stringify(this.lerFormularioParametros());
    this.seloAlterado.hidden = !alterados;
    const formularios = [this.formRegras, this.formAlertas];
    formularios.forEach((formulario) => {
      formulario.querySelector('button[type="submit"]').disabled =
        !alterados || formulario.getAttribute('aria-busy') === 'true';
    });
    return alterados;
  }

  lerFormularioParametros() {
    return {
      nomeEmpresa: this.cfgEmpresa.value,
      cidadeBase: this.cfgCidade.value,
      documentoEmpresa: this.cfgDocumento.value,
      diasAvisoVencimento: this.cfgDiasVencimento.value,
      horasAlertaRetorno: this.cfgHorasRetorno.value,
      kmConfirmacaoViagem: this.cfgKmConfirmacao.value,
      diasAlertaPendencia: this.cfgDiasPendencia.value,
      maxLeitosQuarto: this.cfgMaxLeitos.value,
      areaMinimaCama: this.cfgAreaCama.value,
      areaMinimaBeliche: this.cfgAreaBeliche.value,
      lotacaoAlertaPct: this.cfgLotacaoPct.value,
      bloquearDocVencido: this.cfgBloquearDoc.checked,
      avisarSeguroVencido: this.cfgAvisarSeguro.checked,
      validarNr24: this.cfgValidarNr24.checked,
      telegramCriticos: this.cfgTelegram.checked
    };
  }

  preencherParametros(p) {
    this.nomeEmpresaMenu.textContent = p.nomeEmpresa;
    this.cfgEmpresa.value = p.nomeEmpresa || '';
    this.cfgCidade.value = p.cidadeBase || '';
    this.cfgDocumento.value = p.documentoEmpresa || '';
    this.cfgDiasVencimento.value = p.diasAvisoVencimento;
    this.cfgHorasRetorno.value = p.horasAlertaRetorno;
    this.cfgKmConfirmacao.value = p.kmConfirmacaoViagem;
    this.cfgDiasPendencia.value = p.diasAlertaPendencia;
    this.cfgMaxLeitos.value = p.maxLeitosQuarto;
    this.cfgAreaCama.value = p.areaMinimaCama;
    this.cfgAreaBeliche.value = p.areaMinimaBeliche;
    this.cfgLotacaoPct.value = p.lotacaoAlertaPct;
    this.cfgBloquearDoc.checked = Boolean(p.bloquearDocVencido);
    this.cfgAvisarSeguro.checked = Boolean(p.avisarSeguroVencido);
    this.cfgValidarNr24.checked = Boolean(p.validarNr24);
    this.cfgTelegram.checked = Boolean(p.telegramCriticos);
    this.parametrosSalvos = JSON.stringify(this.lerFormularioParametros());
    this.atualizarEstadoParametros();
  }

  async salvarParametros(e) {
    e.preventDefault();
    const r = await chamarApi('/api/configuracoes/parametros', {
      metodo: 'PUT',
      corpo: this.lerFormularioParametros()
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao salvar configurações.', 'erro');
      return;
    }
    this.preencherParametros(r.dados.parametros);
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarDados();
  }

  atualizarResumoUsuarios(lista) {
    let ativos = 0;
    let admins = 0;
    let operadores = 0;
    let inativos = 0;
    lista.forEach((u) => {
      if (u.ativo === 1) {
        ativos++;
        if (u.perfil === 'admin') {
          admins++;
        } else {
          operadores++;
        }
      } else {
        inativos++;
      }
    });
    this.contAtivos.textContent = ativos;
    this.contAdmins.textContent = admins;
    this.contOperadores.textContent = operadores;
    this.contInativos.textContent = inativos;
  }

  desenharUsuarios() {
    this.tabelaUsuarios.innerHTML = '';
    const termo = this.buscaUsuario.value.trim().toLowerCase();
    const filtrados = this.todosUsuarios.filter((u) => {
      if (termo === '') {
        return true;
      }
      return (
        u.nome.toLowerCase().indexOf(termo) !== -1 || u.login.toLowerCase().indexOf(termo) !== -1
      );
    });
    if (filtrados.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'texto-vazio';
      td.textContent = 'Nenhum usuário encontrado.';
      tr.appendChild(td);
      this.tabelaUsuarios.appendChild(tr);
      return;
    }
    filtrados.forEach((u) => {
      const tr = document.createElement('tr');
      const ehEu = u.id === this.meuId;
      const tdPessoa = document.createElement('td');
      const sNome = document.createElement('span');
      sNome.className = 'pessoa-nome';
      sNome.textContent = u.nome + (ehEu ? ' (você)' : '');
      const sLogin = document.createElement('span');
      sLogin.className = 'pessoa-cargo';
      sLogin.textContent = '@' + u.login;
      tdPessoa.appendChild(sNome);
      tdPessoa.appendChild(sLogin);
      const tdTel = document.createElement('td');
      tdTel.textContent = u.telegram_chat_id || '—';
      const tdPerfil = document.createElement('td');
      const badge = document.createElement('span');
      badge.className =
        'perfil-badge ' + (u.perfil === 'admin' ? 'perfil-admin' : 'perfil-operador');
      badge.textContent = u.perfil === 'admin' ? 'Admin' : 'Operador';
      tdPerfil.appendChild(badge);
      const tdStatus = document.createElement('td');
      const tag = document.createElement('span');
      tag.className = u.ativo === 1 ? 'status-tag status-ativo' : 'status-tag status-concluido';
      const ponto = document.createElement('span');
      ponto.className = 'status-ponto';
      tag.appendChild(ponto);
      tag.appendChild(document.createTextNode(u.ativo === 1 ? 'Ativo' : 'Inativo'));
      tdStatus.appendChild(tag);
      const tdAcoes = document.createElement('td');
      const box = document.createElement('div');
      box.className = 'acoes-linha';
      const btnSenha = document.createElement('button');
      btnSenha.type = 'button';
      btnSenha.className = 'btn-secundario btn-pequeno';
      btnSenha.textContent = 'Nova senha';
      btnSenha.addEventListener('click', () => {
        this.usuarioRedefinindoId = u.id;
        this.redefinirRotulo.textContent = 'Nova senha para @' + u.login + ':';
        this.redefinirInput.value = '';
        this.caixaRedefinir.hidden = false;
        this.redefinirInput.focus();
      });
      box.appendChild(btnSenha);
      if (!ehEu) {
        const btnPerfil = document.createElement('button');
        btnPerfil.type = 'button';
        btnPerfil.className = 'btn-secundario btn-pequeno';
        const outroPerfil = u.perfil === 'admin' ? 'operador' : 'admin';
        btnPerfil.textContent = u.perfil === 'admin' ? 'Tornar operador' : 'Tornar admin';
        btnPerfil.addEventListener('click', async () => {
          const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/perfil', {
            metodo: 'PUT',
            corpo: {
              perfil: outroPerfil
            }
          });
          if (!r.ok) {
            this.mostrarToast(r.dados.erro || 'Erro ao alterar perfil.', 'erro');
            return;
          }
          this.mostrarToast(r.dados.mensagem, 'ok');
          this.carregarDados();
        });
        box.appendChild(btnPerfil);
        const btnAtivo = document.createElement('button');
        btnAtivo.type = 'button';
        btnAtivo.className = 'btn-secundario btn-pequeno';
        btnAtivo.textContent = u.ativo === 1 ? 'Desativar' : 'Reativar';
        btnAtivo.addEventListener('click', async () => {
          const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/ativo', {
            metodo: 'PUT',
            corpo: {
              ativo: u.ativo === 1 ? 0 : 1
            }
          });
          if (!r.ok) {
            this.mostrarToast(r.dados.erro || 'Erro ao alterar acesso.', 'erro');
            return;
          }
          this.mostrarToast(r.dados.mensagem, 'ok');
          this.carregarDados();
        });
        box.appendChild(btnAtivo);
      }
      tdAcoes.appendChild(box);
      tr.appendChild(tdPessoa);
      tr.appendChild(tdTel);
      tr.appendChild(tdPerfil);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAcoes);
      this.tabelaUsuarios.appendChild(tr);
    });
  }

  desenharBanco(b) {
    this.dbTamanho.textContent = b.tamanhoKb + ' KB';
    this.dbTabelas.textContent = b.totalTabelas;
    this.dbPessoas.textContent = b.contagens.colaboradores;
    this.dbLogs.textContent = b.contagens.logs;
    const intg = b.integridade;
    if (intg.integro) {
      this.caixaIntegridade.className = 'integridade-status integridade-ok';
      this.integridadeTitulo.textContent =
        'Cadeia íntegra (' + intg.totalLinhas + ' registros verificados)';
      this.integridadeMotivo.textContent = intg.motivo;
    } else {
      this.caixaIntegridade.className = 'integridade-status integridade-erro';
      this.integridadeTitulo.textContent =
        'Adulteração detectada na linha #' + intg.linhaComProblema;
      this.integridadeMotivo.textContent = intg.motivo;
    }
    this.tabelaLogsRecentes.innerHTML = '';
    const logs = b.ultimosLogs || [];
    if (logs.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.className = 'texto-vazio';
      td.textContent = 'Nenhuma alteração registrada ainda no log.';
      tr.appendChild(td);
      this.tabelaLogsRecentes.appendChild(tr);
      return;
    }
    logs.forEach((l) => {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td');
      tdId.className = 'celula-horario';
      tdId.textContent = '#' + l.id;
      const tdQuando = document.createElement('td');
      tdQuando.className = 'celula-horario';
      tdQuando.textContent = l.quando.slice(0, 16);
      const tdAutor = document.createElement('td');
      tdAutor.textContent = '@' + l.autor;
      const tdResumo = document.createElement('td');
      tdResumo.textContent = l.resumo;
      tr.appendChild(tdId);
      tr.appendChild(tdQuando);
      tr.appendChild(tdAutor);
      tr.appendChild(tdResumo);
      this.tabelaLogsRecentes.appendChild(tr);
    });
  }

  marcarSaude(id, nivel, texto) {
    const ponto = document.getElementById('saude-' + id + '-ponto');
    ponto.className = 'saude-ponto saude-' + nivel;
    document.getElementById('saude-' + id).textContent = texto;
  }

  desenharSaude(dados) {
    const b = dados.banco;
    if (b) {
      this.marcarSaude('banco', 'ok', b.tamanhoKb + ' KB · ' + b.totalTabelas + ' tabelas');
      const intg = b.integridade;
      if (intg.integro)
        this.marcarSaude('log', 'ok', 'Íntegro · ' + intg.totalLinhas + ' registros');
      else this.marcarSaude('log', 'erro', 'Adulteração na linha #' + intg.linhaComProblema);
    }
    const amb = dados.ambiente;
    this.marcarSaude(
      'ia',
      amb.iaConfigurada ? 'ok' : 'off',
      amb.iaConfigurada ? 'Conectada à Groq' : 'Desligada (sem GROQ_API_KEY)'
    );
    this.marcarSaude(
      'telegram',
      amb.telegramAtivo ? 'ok' : 'off',
      amb.telegramAtivo ? 'Bot conectado' : 'Modo terminal (sem token)'
    );
  }

  desenharAmbiente(amb) {
    if (amb.iaConfigurada) {
      this.badgeIa.className = 'status-tag status-ativo';
      this.badgeIa.innerHTML = '<span class="status-ponto"></span>Conectada';
      this.descIa.textContent =
        'Chave GROQ_API_KEY presente no servidor. Consultas e resumos prontos para uso.';
    } else {
      this.badgeIa.className = 'status-tag status-concluido';
      this.badgeIa.innerHTML = '<span class="status-ponto"></span>Desligada';
      this.descIa.textContent =
        'Defina GROQ_API_KEY no arquivo server/.env para ativar os recursos de IA.';
    }
    if (amb.telegramAtivo) {
      this.badgeTelegram.className = 'status-tag status-ativo';
      this.badgeTelegram.innerHTML = '<span class="status-ponto"></span>Bot ativo';
      this.descTelegram.textContent =
        'Bot do Telegram conectado: alertas críticos enviados de verdade.';
    } else {
      this.badgeTelegram.className = 'status-tag status-uso';
      this.badgeTelegram.innerHTML = '<span class="status-ponto"></span>Modo terminal';
      this.descTelegram.textContent =
        'Sem TELEGRAM_BOT_TOKEN no server/.env: os alertas aparecem formatados no terminal do servidor.';
    }
  }

  async carregarDados() {
    try {
      const sessao = await chamarApi('/api/auth/eu');
      if (!sessao.ok) {
        window.location.href = 'index.html';
        return;
      }
      const user = sessao.dados.usuario;
      if (user.perfil !== 'admin') {
        window.location.href = 'resumo.html';
        return;
      }
      this.meuId = user.id;
      this.meuLogin = user.login;
      this.perfilNome.textContent = user.nome;
      this.perfilTipo.textContent = user.perfil;
      this.usuarioIniciais.textContent = this.pegarIniciais(user.nome);
      const res = await chamarApi('/api/configuracoes');
      if (!res.ok) {
        this.mostrarToast(res.dados.erro || 'Erro ao carregar configurações.', 'erro');
        return;
      }
      this.preencherParametros(res.dados.parametros);
      this.desenharAmbiente(res.dados.ambiente);
      this.todosUsuarios = res.dados.usuarios || [];
      this.atualizarResumoUsuarios(this.todosUsuarios);
      this.desenharUsuarios();
      if (res.dados.banco) {
        this.desenharBanco(res.dados.banco);
      }
      this.desenharSaude(res.dados);
      const eu = res.dados.meuUsuario;
      this.contaNome.value = eu.nome;
      this.contaTelefone.value = eu.telegram_chat_id || '';
      this.contaTituloPrevia.textContent = eu.nome;
      this.contaLoginPrevia.textContent = '@' + eu.login + ' · Perfil administrador';
      this.contaAvatarPrevia.textContent = this.pegarIniciais(eu.nome);
      this.abrirAbaConfig(window.location.hash.slice(1));
    } catch (erro) {
      this.mostrarToast('Sem conexão com o servidor.', 'erro');
    }
  }
}
new TelaConfiguracoes();
