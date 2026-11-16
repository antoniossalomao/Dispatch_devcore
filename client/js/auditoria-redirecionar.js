// Redireciona o endereço antigo da Auditoria para a nova aba dentro de Configurações.
// Fica neste arquivo separado porque a proteção CSP bloqueia <script> escrito direto no HTML.
class RedirecionadorAuditoria {
  constructor() {
    this.destino = 'configuracoes.html#auditoria';
  }

  iniciar() {
    window.location.replace(this.destino);
  }
}

new RedirecionadorAuditoria().iniciar();
