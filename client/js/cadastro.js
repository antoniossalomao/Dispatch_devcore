// Controla o cadastro de acesso.
class TelaCadastro {
  constructor() {
    this.form = document.getElementById('form-cadastro');
    this.inputNome = document.getElementById('nome');
    this.inputUsuario = document.getElementById('usuario');
    this.inputSenha = document.getElementById('senha');
    this.inputConfirmar = document.getElementById('confirmar-senha');
    this.checkMostrar = document.getElementById('mostrar-senha');
    this.msgErro = document.getElementById('mensagem-erro');
    this.botaoCadastrar = document.getElementById('botao-cadastrar');
    this.configurarEventos();
  }

  configurarEventos() {
    this.checkMostrar.addEventListener('change', () => {
      const tipo = this.checkMostrar.checked ? 'text' : 'password';
      this.inputSenha.type = tipo;
      this.inputConfirmar.type = tipo;
    });
    this.form.addEventListener('submit', this.cadastrar.bind(this));
  }

  async cadastrar(e) {
    e.preventDefault();
    this.esconderErro();
    const nome = this.inputNome.value.trim();
    const usuario = this.inputUsuario.value.trim();
    const senha = this.inputSenha.value;
    const confirmar = this.inputConfirmar.value;
    if (nome === '' || usuario === '' || senha === '' || confirmar === '') {
      this.mostrarErro(
        'Preencha todos os campos.',
        [this.inputNome, this.inputUsuario, this.inputSenha, this.inputConfirmar].find((campo) => {
          return campo.value.trim() === '';
        })
      );
      return;
    }
    if (usuario.indexOf(' ') !== -1) {
      this.mostrarErro('O nome de usuário não pode ter espaços.', this.inputUsuario);
      return;
    }
    if (senha.length < 4) {
      this.mostrarErro('A senha precisa ter pelo menos 4 caracteres.', this.inputSenha);
      return;
    }
    if (senha !== confirmar) {
      this.mostrarErro('As senhas digitadas não conferem.', this.inputConfirmar);
      return;
    }
    this.esconderErro();
    this.botaoCadastrar.disabled = true;
    this.botaoCadastrar.textContent = 'Cadastrando...';
    try {
      const res = await chamarApi('/api/auth/cadastro', {
        metodo: 'POST',
        corpo: {
          nome: nome,
          usuario: usuario,
          senha: senha
        }
      });
      if (!res.ok) {
        this.mostrarErro(res.dados.erro || 'Erro ao criar a conta.');
        this.botaoCadastrar.disabled = false;
        this.botaoCadastrar.textContent = 'Criar conta';
        return;
      }
      window.location.href = 'index.html?cadastro=ok';
    } catch (erro) {
      this.mostrarErro('Não consegui falar com o servidor. Confira se ele está ligado.');
      this.botaoCadastrar.disabled = false;
      this.botaoCadastrar.textContent = 'Criar conta';
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
    const campos = [this.inputNome, this.inputUsuario, this.inputSenha, this.inputConfirmar];
    campos.forEach((campo) => {
      campo.removeAttribute('aria-invalid');
    });
  }
}
new TelaCadastro();
