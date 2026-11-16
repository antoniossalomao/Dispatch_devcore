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
    this.ajudaCadastro = document.getElementById('ajuda-cadastro');
    this.configurarEventos();
    this.verificarCadastro();
  }

  // O link para criar conta só aparece quando o servidor está com código de convite configurado.
  async verificarCadastro() {
    if (!this.ajudaCadastro) return;
    try {
      const resposta = await chamarApi('/api/auth/cadastro-status');
      if (resposta.ok && resposta.dados && resposta.dados.ativo) {
        this.ajudaCadastro.hidden = false;
      }
    } catch (erro) {
      // Se o servidor estiver desligado, deixa o link escondido mesmo.
    }
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
        'Preencha o usuário e a senha.',
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
