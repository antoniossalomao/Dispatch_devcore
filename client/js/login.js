// Controla a entrada no sistema.
class TelaLogin {
  constructor() {
    this.form = document.getElementById('form-login');
    this.inputUsuario = document.getElementById('usuario');
    this.inputSenha = document.getElementById('senha');
    this.checkMostrar = document.getElementById('mostrar-senha');
    this.msgErro = document.getElementById('mensagem-erro');
    this.msgSucesso = document.getElementById('mensagem-sucesso');
    this.botaoEntrar = document.getElementById('botao-entrar');
    this.configurarEventos();
  }

  configurarEventos() {
    if (window.location.search.indexOf('cadastro=ok') !== -1) {
      this.msgSucesso.textContent = 'Conta criada com sucesso! Agora é só entrar.';
      this.msgSucesso.hidden = false;
    }
    this.checkMostrar.addEventListener('change', () => {
      if (this.checkMostrar.checked) {
        this.inputSenha.type = 'text';
      } else {
        this.inputSenha.type = 'password';
      }
    });
    this.form.addEventListener('submit', this.entrar.bind(this));
  }

  async entrar(e) {
    e.preventDefault();
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
    this.esconderErro();
    this.msgSucesso.hidden = true;
    this.botaoEntrar.disabled = true;
    this.botaoEntrar.textContent = 'Entrando...';
    try {
      const res = await chamarApi('/api/auth/login', {
        metodo: 'POST',
        corpo: {
          usuario: usuario,
          senha: senha
        }
      });
      if (!res.ok) {
        this.mostrarErro(res.dados.erro || 'Não foi possível entrar.');
        this.botaoEntrar.disabled = false;
        this.botaoEntrar.textContent = 'Entrar';
        return;
      }
      window.location.href = 'resumo.html';
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
    } else this.msgErro.focus();
  }

  esconderErro() {
    this.msgErro.textContent = '';
    this.msgErro.hidden = true;
    const campos = [this.inputUsuario, this.inputSenha];
    campos.forEach((campo) => {
      campo.removeAttribute('aria-invalid');
    });
  }
}
new TelaLogin();
