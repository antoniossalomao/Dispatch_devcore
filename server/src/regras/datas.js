// Classe auxiliar para conferir e formatar datas no horário local (padrão do banco: AAAA-MM-DD HH:MM:SS).
class Datas {
  constructor() {
    this.agoraLocal = this.agoraLocal.bind(this);
    this.normalizarData = this.normalizarData.bind(this);
    this.diasAte = this.diasAte.bind(this);
    this.dataIsoValida = this.dataIsoValida.bind(this);
  }

  doisDigitos(numero) {
    return numero < 10 ? '0' + numero : String(numero);
  }

  agoraLocal() {
    const agora = new Date();
    return (
      agora.getFullYear() +
      '-' +
      this.doisDigitos(agora.getMonth() + 1) +
      '-' +
      this.doisDigitos(agora.getDate()) +
      ' ' +
      this.doisDigitos(agora.getHours()) +
      ':' +
      this.doisDigitos(agora.getMinutes()) +
      ':' +
      this.doisDigitos(agora.getSeconds())
    );
  }

  // O Date do JavaScript ajusta sozinho dias impossíveis (ex: 30 de fevereiro vira março).
  // Conferindo ano, mês e dia depois de criar a data, a gente barra datas falsas.
  dataCalendarioValida(ano, mes, dia) {
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  }

  dataIsoValida(texto) {
    const partes = String(texto || '')
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!partes) return false;
    return this.dataCalendarioValida(Number(partes[1]), Number(partes[2]), Number(partes[3]));
  }

  // Aceita "2026-11-05", "2026-11-05T10:30" ou "2026-11-05 10:30" e devolve "AAAA-MM-DD HH:MM:SS".
  normalizarData(texto) {
    const limpo = String(texto || '')
      .trim()
      .replace('T', ' ');
    const partes = limpo.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!partes) return null;

    const ano = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);
    if (!this.dataCalendarioValida(ano, mes, dia)) return null;

    const hora = partes[4] === undefined ? 0 : Number(partes[4]);
    const min = partes[5] === undefined ? 0 : Number(partes[5]);
    const seg = partes[6] === undefined ? 0 : Number(partes[6]);
    if (hora > 23 || min > 59 || seg > 59) return null;

    return (
      partes[1] +
      '-' +
      partes[2] +
      '-' +
      partes[3] +
      ' ' +
      this.doisDigitos(hora) +
      ':' +
      this.doisDigitos(min) +
      ':' +
      this.doisDigitos(seg)
    );
  }

  // Calcula quantos dias faltam de hoje até uma data AAAA-MM-DD (se der negativo, já venceu).
  diasAte(dataIso) {
    if (!dataIso) return null;
    const trecho = String(dataIso).trim().slice(0, 10);
    if (!this.dataIsoValida(trecho)) return null;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(trecho + 'T00:00:00');
    return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
  }
}

module.exports = new Datas();
