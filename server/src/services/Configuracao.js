const fs = require('fs');
const path = require('path');
// Lê os parâmetros salvos e usa os padrões para os campos ausentes.
class Configuracao {
  constructor() {
    this.caminhoConfig = path.join(__dirname, '..', '..', 'data', 'config.json');
    this.configPadrao = {
      nomeEmpresa: 'Construtora Aguapeí',
      cidadeBase: 'Marília/SP',
      documentoEmpresa: '45.123.890/0001-12',
      diasAvisoVencimento: 30,
      horasAlertaRetorno: 12,
      kmConfirmacaoViagem: 2000,
      diasAlertaPendencia: 7,
      maxLeitosQuarto: 8,
      areaMinimaCama: 3,
      areaMinimaBeliche: 4.5,
      lotacaoAlertaPct: 90,
      bloquearDocVencido: true,
      avisarSeguroVencido: true,
      validarNr24: true,
      telegramCriticos: false
    };
  }

  lerConfig() {
    if (!fs.existsSync(this.caminhoConfig)) {
      return Object.assign({}, this.configPadrao);
    }
    try {
      const texto = fs.readFileSync(this.caminhoConfig, 'utf-8');
      const salvo = JSON.parse(texto);
      return Object.assign({}, this.configPadrao, salvo);
    } catch (erro) {
      return Object.assign({}, this.configPadrao);
    }
  }

  salvarConfig(dados) {
    fs.mkdirSync(path.dirname(this.caminhoConfig), {
      recursive: true
    });
    fs.writeFileSync(this.caminhoConfig, JSON.stringify(dados, null, 2), 'utf-8');
  }
}
module.exports = new Configuracao();
