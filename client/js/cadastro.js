// Tela de criação de conta por convite: verifica se o servidor liberou cadastros e valida os campos antes de enviar.
class TelaCadastro {
  constructor() {
    this.form = document.getElementById('form-cadastro');
    this.avisoDesativado = document.getElementById('cadastro-desativado');
    this.inputCodigo = document.getElementById('codigo');
    this.inputNome = document.getElementById('nome');
    this.inputUsuario = document.getElementById('usuario');
    this.inputSenha = document.getElementById('senha');
    this.inputConfirmar = document.getElementById('confirmar-senha');
    this.checkMostrar = document.getElementById('mostrar-senha');
    this.msgErro = document.getElementById('mensagem-erro');
    this.botaoCadastrar = document.getElementById('botao-cadastrar');
    this.configurarEventos();
    this.verificarDisponibilidade();
  }

  // Sem código de convite configurado no servidor, o cadastro público fica fechado.
  async verificarDisponibilidade() {
    try {
      const resposta = await chamarApi('/api/auth/cadastro-status');
      if (resposta.ok && resposta.dados && resposta.dados.ativo) {
        this.form.hidden = false;
        if (this.avisoDesativado) this.avisoDesativado.hidden = true;
      } else {
        this.form.hidden = true;
        if (this.avisoDesativado) this.avisoDesativado.hidden = false;
      }
    } catch (erro) {
      this.form.hidden = true;
      if (this.avisoDesativado) {
        this.avisoDesativado.textContent =
          'Não foi possível verificar a disponibilidade do cadastro no servidor.';
        this.avisoDesativado.hidden = false;
      }
    }
  }

  configurarEventos() {
    this.checkMostrar.addEventListener('change', () => {
      const tipo = this.checkMostrar.checked ? 'text' : 'password';
      this.inputSenha.type = tipo;
      this.inputConfirmar.type = tipo;
    });
    this.form.addEventListener('submit', this.cadastrar.bind(this));
  }

  async cadastrar(evento) {
    evento.preventDefault();
    this.esconderErro();

    const codigo = this.inputCodigo ? this.inputCodigo.value.trim() : '';
    const nome = this.inputNome.value.trim();
    const usuario = this.inputUsuario.value.trim();
    const senha = this.inputSenha.value;
    const confirmar = this.inputConfirmar.value;

    if (codigo === '' || nome === '' || usuario === '' || senha === '' || confirmar === '') {
      const primeiroVazio = [
        this.inputCodigo,
        this.inputNome,
        this.inputUsuario,
        this.inputSenha,
        this.inputConfirmar
      ].find((campo) => {
        return campo && campo.value.trim() === '';
      });
      this.mostrarErro('Preencha todos os campos.', primeiroVazio);
      return;
    }

    if (usuario.indexOf(' ') !== -1) {
      this.mostrarErro('O nome de usuário não pode ter espaços.', this.inputUsuario);
      return;
    }
    if (senha.length < 8) {
      this.mostrarErro('A senha precisa ter pelo menos 8 caracteres.', this.inputSenha);
      return;
    }
    if (senha !== confirmar) {
      this.mostrarErro('As senhas digitadas não conferem.', this.inputConfirmar);
      return;
    }

    this.botaoCadastrar.disabled = true;
    this.botaoCadastrar.textContent = 'Cadastrando...';

    try {
      const resposta = await chamarApi('/api/auth/cadastro', {
        metodo: 'POST',
        corpo: {
          codigo: codigo,
          nome: nome,
          usuario: usuario,
          senha: senha
        }
      });

      if (!resposta.ok) {
        this.mostrarErro(resposta.dados.erro || 'Erro ao criar a conta.');
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
    } else {
      this.msgErro.focus();
    }
  }

  esconderErro() {
    this.msgErro.textContent = '';
    this.msgErro.hidden = true;
    [
      this.inputCodigo,
      this.inputNome,
      this.inputUsuario,
      this.inputSenha,
      this.inputConfirmar
    ].forEach((campo) => {
      if (campo) campo.removeAttribute('aria-invalid');
    });
  }
}

new TelaCadastro();
