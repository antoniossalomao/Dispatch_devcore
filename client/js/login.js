// Tela de entrada no sistema: valida os campos, envia usuário e senha e mostra o atalho de cadastro se habilitado.
class TelaLogin {
  constructor() {
    this.form = document.getElementById('form-login');
    this.inputUsuario = document.getElementById('usuario');
    this.inputSenha = document.getElementById('senha');
    this.checkMostrar = document.getElementById('mostrar-senha');
    this.msgErro = document.getElementById('mensagem-erro');
    this.msgSucesso = document.getElementById('mensagem-sucesso');
    this.botaoEntrar = document.getElementById('botao-entrar');
    this.blocoGoogle = document.getElementById('bloco-google');
    this.configurarEventos();
    this.verificarGoogle();
    this.mostrarRetornoGoogle();
  }

  // O botão do Google só aparece quando o servidor tem GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
  async verificarGoogle() {
    if (!this.blocoGoogle) return;
    try {
      const resposta = await chamarApi('/api/auth/google/status');
      if (resposta.ok && resposta.dados && resposta.dados.ativo) {
        this.blocoGoogle.hidden = false;
      }
    } catch (erro) {
      // Sem servidor, fica só o login por senha.
    }
  }

  // Quando o Google devolve a pessoa sem conseguir entrar, o servidor manda o motivo em ?google=.
  mostrarRetornoGoogle() {
    const motivo = new URLSearchParams(window.location.search).get('google');
    const mensagens = {
      'sem-acesso':
        'Essa conta Google não está liberada no Dispatch. Peça a um administrador para ligar o seu e-mail ao seu usuário.',
      cancelado: 'O login com Google foi cancelado.',
      expirado: 'O login com Google demorou demais ou veio de outra aba. Tente de novo.',
      indisponivel: 'O login com Google não está configurado neste servidor.',
      falhou: 'Não foi possível confirmar sua conta Google. Tente de novo ou entre com usuário e senha.'
    };
    if (motivo && mensagens[motivo]) this.mostrarErro(mensagens[motivo]);
  }

  configurarEventos() {
    if (window.location.search.indexOf('cadastro=ok') !== -1) {
      this.msgSucesso.textContent = 'Conta criada com sucesso! Agora é só entrar.';
      this.msgSucesso.hidden = false;
    }

    this.checkMostrar.addEventListener('change', () => {
      this.inputSenha.type = this.checkMostrar.checked ? 'text' : 'password';
    });

    this.form.addEventListener('submit', this.entrar.bind(this));
  }

  async entrar(evento) {
    evento.preventDefault();
    this.esconderErro();

    const usuario = this.inputUsuario.value.trim();
    const senha = this.inputSenha.value;
    if (usuario === '' || senha === '') {
      this.mostrarErro(
        'Preencha o e-mail e a senha.',
        usuario === '' ? this.inputUsuario : this.inputSenha
      );
      return;
    }

    this.msgSucesso.hidden = true;
    this.botaoEntrar.disabled = true;
    this.botaoEntrar.textContent = 'Entrando...';

    try {
      const resposta = await chamarApi('/api/auth/login', {
        metodo: 'POST',
        corpo: { usuario: usuario, senha: senha }
      });

      if (!resposta.ok) {
        this.mostrarErro(resposta.dados.erro || 'Não foi possível entrar.');
        this.botaoEntrar.disabled = false;
        this.botaoEntrar.textContent = 'Entrar';
        return;
      }

      window.location.href = 'resumo';
    } catch (erro) {
      this.mostrarErro('Não consegui falar com o servidor. Confira se ele está ligado.');
      this.botaoEntrar.disabled = false;
      this.botaoEntrar.textContent = 'Entrar';
    }
  }

  mostrarErro(texto, campo) {
    this.msgErro.textContent = texto;
    this.msgErro.hidden = false;
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    } else {
      this.msgErro.focus();
    }
  }

  esconderErro() {
    this.msgErro.textContent = '';
    this.msgErro.hidden = true;
    [this.inputUsuario, this.inputSenha].forEach((campo) => {
      campo.removeAttribute('aria-invalid');
    });
  }
}

new TelaLogin();
