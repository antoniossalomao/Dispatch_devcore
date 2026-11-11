const db = require('../db/conexao');
const { normalizarData } = require('../regras/datas');
const configuracao = require('./Configuracao');
// Calcula os relatórios a partir dos períodos e dos registros do banco.
class Relatorios {
  constructor() {
    this.msDia = 86400000;
  }

  paraMs(texto) {
    return new Date(texto.replace(' ', 'T')).getTime();
  }

  doisDigitos(n) {
    return n < 10 ? '0' + n : String(n);
  }

  formatar(ms) {
    const d = new Date(ms);
    return (
      d.getFullYear() +
      '-' +
      this.doisDigitos(d.getMonth() + 1) +
      '-' +
      this.doisDigitos(d.getDate()) +
      ' ' +
      this.doisDigitos(d.getHours()) +
      ':' +
      this.doisDigitos(d.getMinutes()) +
      ':' +
      this.doisDigitos(d.getSeconds())
    );
  }

  lerPeriodo(query) {
    const agora = Date.now();
    let ate = query.ate ? normalizarData(query.ate) : null;
    let de = query.de ? normalizarData(query.de) : null;
    const ateMs = ate ? this.paraMs(ate) + (query.ate.length <= 10 ? this.msDia - 1000 : 0) : agora;
    const deMs = de ? this.paraMs(de) : ateMs - 30 * this.msDia;
    if (isNaN(deMs) || isNaN(ateMs) || deMs >= ateMs) return null;
    return {
      deMs: deMs,
      ateMs: ateMs,
      de: this.formatar(deMs),
      ate: this.formatar(ateMs),
      dias: (ateMs - deMs) / this.msDia
    };
  }

  sobreposicao(ini, fim, periodo) {
    const a = Math.max(this.paraMs(ini), periodo.deMs);
    const b = Math.min(fim ? this.paraMs(fim) : Date.now(), periodo.ateMs);
    return b > a ? b - a : 0;
  }

  arredondar(n, casas) {
    const f = Math.pow(10, casas);
    return Math.round(n * f) / f;
  }

  calcularOcupacao(periodo) {
    const alojamentos = db
      .prepare('SELECT id, nome, cidade FROM alojamento WHERE ativo = 1 ORDER BY nome')
      .all();
    const estadias = db
      .prepare(
        'SELECT e.inicio, e.fim, q.alojamento_id FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id'
      )
      .all();
    const linhas = alojamentos.map((a) => {
      const leitos = db
        .prepare(
          'SELECT COUNT(*) AS n FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = ?'
        )
        .get(a.id).n;
      let msOcupado = 0;
      let entradas = 0;
      estadias.forEach((e) => {
        if (e.alojamento_id !== a.id) return;
        const ms = this.sobreposicao(e.inicio, e.fim, periodo);
        if (ms > 0) msOcupado += ms;
        if (this.paraMs(e.inicio) >= periodo.deMs && this.paraMs(e.inicio) <= periodo.ateMs)
          entradas++;
      });
      const diasLeitoOcupados = msOcupado / this.msDia;
      const capacidade = leitos * periodo.dias;
      const agora = db
        .prepare(
          'SELECT COUNT(*) AS n FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
            'WHERE q.alojamento_id = ? AND e.fim IS NULL'
        )
        .get(a.id).n;
      return {
        alojamento_id: a.id,
        nome: a.nome,
        cidade: a.cidade,
        leitos: leitos,
        ocupados_agora: agora,
        dias_leito_ocupados: this.arredondar(diasLeitoOcupados, 1),
        ocupacao_media_pct:
          capacidade > 0 ? this.arredondar((diasLeitoOcupados / capacidade) * 100, 1) : 0,
        entradas_no_periodo: entradas
      };
    });
    return {
      periodo: {
        de: periodo.de,
        ate: periodo.ate
      },
      alojamentos: linhas
    };
  }

  calcularFrota(periodo) {
    const veiculos = db
      .prepare('SELECT id, placa, modelo FROM veiculo WHERE ativo = 1 ORDER BY modelo, placa')
      .all();
    const usos = db
      .prepare('SELECT veiculo_id, saida, retorno, km_saida, km_retorno FROM uso_veiculo')
      .all();
    const linhas = veiculos.map((v) => {
      let msUso = 0;
      let km = 0;
      let viagens = 0;
      let ultimaSaida = null;
      usos.forEach((u) => {
        if (u.veiculo_id !== v.id) return;
        const ms = this.sobreposicao(u.saida, u.retorno, periodo);
        if (ms > 0) {
          msUso += ms;
          viagens++;
          if (u.km_retorno !== null) km += u.km_retorno - u.km_saida;
        }
        if (!ultimaSaida || u.saida > ultimaSaida) ultimaSaida = u.saida;
      });
      const horasUso = msUso / 3600000;
      const utilizacao = (msUso / (periodo.ateMs - periodo.deMs)) * 100;
      return {
        veiculo_id: v.id,
        placa: v.placa,
        modelo: v.modelo,
        viagens: viagens,
        km_rodados: km,
        horas_em_uso: this.arredondar(horasUso, 1),
        utilizacao_pct: this.arredondar(utilizacao, 1),
        ociosidade_pct: this.arredondar(100 - utilizacao, 1),
        dias_sem_uso: ultimaSaida
          ? Math.max(0, Math.floor((Date.now() - this.paraMs(ultimaSaida)) / this.msDia))
          : null
      };
    });
    return {
      periodo: {
        de: periodo.de,
        ate: periodo.ate
      },
      veiculos: linhas
    };
  }

  calcularMovimentacoes(periodo, filtros) {
    const f = filtros || {};
    const eventos = [];
    db.prepare(
      'SELECT e.inicio, e.fim, p.nome, a.nome AS alojamento, q.nome AS quarto, l.codigo FROM estadia e ' +
        'JOIN pessoa p ON p.id = e.pessoa_id JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
        'JOIN alojamento a ON a.id = q.alojamento_id'
    )
      .all()
      .forEach((e) => {
        const recurso = e.alojamento + ' · ' + e.quarto + ' (' + e.codigo + ')';
        if (this.paraMs(e.inicio) >= periodo.deMs && this.paraMs(e.inicio) <= periodo.ateMs) {
          eventos.push({
            quando: e.inicio,
            categoria: 'alojamento',
            tipo: 'Entrada',
            colaborador: e.nome,
            recurso: recurso
          });
        }
        if (e.fim && this.paraMs(e.fim) >= periodo.deMs && this.paraMs(e.fim) <= periodo.ateMs) {
          eventos.push({
            quando: e.fim,
            categoria: 'alojamento',
            tipo: 'Saída',
            colaborador: e.nome,
            recurso: recurso
          });
        }
      });
    db.prepare(
      'SELECT u.saida, u.retorno, u.destino, u.km_saida, u.km_retorno, p.nome, v.modelo, v.placa FROM uso_veiculo u ' +
        'JOIN pessoa p ON p.id = u.motorista_id JOIN veiculo v ON v.id = u.veiculo_id'
    )
      .all()
      .forEach((u) => {
        const recurso = u.modelo + ' · ' + u.placa;
        if (this.paraMs(u.saida) >= periodo.deMs && this.paraMs(u.saida) <= periodo.ateMs) {
          eventos.push({
            quando: u.saida,
            categoria: 'frota',
            tipo: 'Retirada',
            colaborador: u.nome,
            recurso: recurso + ' → ' + u.destino
          });
        }
        if (
          u.retorno &&
          this.paraMs(u.retorno) >= periodo.deMs &&
          this.paraMs(u.retorno) <= periodo.ateMs
        ) {
          eventos.push({
            quando: u.retorno,
            categoria: 'frota',
            tipo: 'Devolução',
            colaborador: u.nome,
            recurso: recurso + ' (' + (u.km_retorno - u.km_saida) + ' km)'
          });
        }
      });
    eventos.sort((a, b) => {
      return a.quando < b.quando ? 1 : -1;
    });
    const busca = String(f.busca || '')
      .trim()
      .toLowerCase();
    const filtrados = eventos.filter((e) => {
      if (f.categoria && e.categoria !== f.categoria) return false;
      if (f.tipo && e.tipo !== f.tipo) return false;
      if (busca !== '' && (e.colaborador + ' ' + e.recurso).toLowerCase().indexOf(busca) === -1)
        return false;
      return true;
    });
    const porTipo = {
      Entrada: 0,
      Saída: 0,
      Retirada: 0,
      Devolução: 0
    };
    filtrados.forEach((e) => {
      porTipo[e.tipo]++;
    });
    const limite = Math.min(Math.max(Number(f.limite) || 300, 1), 1000);
    return {
      periodo: {
        de: periodo.de,
        ate: periodo.ate
      },
      total: filtrados.length,
      por_tipo: porTipo,
      eventos: filtrados.slice(0, limite)
    };
  }

  calcularGargalos(periodo) {
    const cfg = configuracao.lerConfig();
    const agora = Date.now();
    const itens = [];
    db.prepare(
      'SELECT a.id, a.nome, ' +
        '(SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS leitos, ' +
        '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS ocupados ' +
        'FROM alojamento a WHERE a.ativo = 1'
    )
      .all()
      .forEach((a) => {
        if (a.leitos > 0) {
          const pct = Math.round((a.ocupados / a.leitos) * 100);
          if (pct >= cfg.lotacaoAlertaPct) {
            itens.push({
              tipo: 'lotacao',
              severidade: pct === 100 ? 'critico' : 'atencao',
              mensagem:
                a.nome +
                ' está com ' +
                pct +
                '% de ocupação (' +
                a.ocupados +
                '/' +
                a.leitos +
                ' leitos).'
            });
          }
        }
      });
    db.prepare(
      'SELECT o.id, o.aberta_em, o.descricao, a.nome FROM ocorrencia o JOIN alojamento a ON a.id = o.alojamento_id WHERE o.resolvida_em IS NULL'
    )
      .all()
      .forEach((o) => {
        const dias = Math.floor((agora - this.paraMs(o.aberta_em)) / this.msDia);
        if (dias >= cfg.diasAlertaPendencia) {
          itens.push({
            tipo: 'ocorrencia_antiga',
            severidade: 'atencao',
            mensagem: 'Ocorrência aberta há ' + dias + ' dias em ' + o.nome + ': ' + o.descricao
          });
        }
      });
    db.prepare(
      'SELECT u.saida, u.destino, v.modelo, v.placa, p.nome FROM uso_veiculo u JOIN veiculo v ON v.id = u.veiculo_id JOIN pessoa p ON p.id = u.motorista_id WHERE u.retorno IS NULL'
    )
      .all()
      .forEach((u) => {
        const horas = Math.floor((agora - this.paraMs(u.saida)) / 3600000);
        if (horas >= cfg.horasAlertaRetorno) {
          itens.push({
            tipo: 'nao_voltou',
            severidade: 'critico',
            mensagem:
              u.modelo +
              ' ' +
              u.placa +
              ' saiu há ' +
              horas +
              'h com ' +
              u.nome +
              ' (' +
              u.destino +
              ') e não voltou.'
          });
        }
      });
    db.prepare(
      'SELECT m.inicio, m.descricao, v.modelo, v.placa FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id WHERE m.fim IS NULL'
    )
      .all()
      .forEach((m) => {
        const dias = Math.floor((agora - this.paraMs(m.inicio)) / this.msDia);
        if (dias >= cfg.diasAlertaPendencia) {
          itens.push({
            tipo: 'oficina_longa',
            severidade: 'atencao',
            mensagem:
              m.modelo +
              ' ' +
              m.placa +
              ' está na oficina há ' +
              dias +
              ' dias (' +
              m.descricao +
              ').'
          });
        }
      });
    const usos = db.prepare('SELECT veiculo_id, saida, retorno FROM uso_veiculo').all();
    db.prepare('SELECT id, placa, modelo FROM veiculo WHERE ativo = 1')
      .all()
      .forEach((v) => {
        let ms = 0;
        usos.forEach((u) => {
          if (u.veiculo_id === v.id) ms += this.sobreposicao(u.saida, u.retorno, periodo);
        });
        const pct = (ms / (periodo.ateMs - periodo.deMs)) * 100;
        if (pct >= 70) {
          itens.push({
            tipo: 'frota_sobrecarregada',
            severidade: 'atencao',
            mensagem:
              v.modelo +
              ' ' +
              v.placa +
              ' ficou ' +
              this.arredondar(pct, 0) +
              '% do período em uso: pode faltar carro.'
          });
        } else if (pct < 5 && periodo.dias >= 7) {
          itens.push({
            tipo: 'frota_ociosa',
            severidade: 'atencao',
            mensagem:
              v.modelo +
              ' ' +
              v.placa +
              ' ficou parado (' +
              this.arredondar(pct, 0) +
              '% de uso no período).'
          });
        }
      });
    return {
      periodo: {
        de: periodo.de,
        ate: periodo.ate
      },
      total: itens.length,
      gargalos: itens
    };
  }
}
module.exports = new Relatorios();
