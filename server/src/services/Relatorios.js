const db = require('../db/conexao');
const datas = require('../regras/datas');
const validador = require('../regras/validacao');
const configuracao = require('./Configuracao');

// Calcula os números de ocupação, uso da frota, movimentações e gargalos dentro de um período escolhido.
class Relatorios {
  constructor() {
    this.msDia = 86400000;
  }

  // Converte "AAAA-MM-DD HH:MM:SS" para timestamp em milissegundos usando o fuso local.
  paraMs(texto) {
    return new Date(texto.replace(' ', 'T')).getTime();
  }

  doisDigitos(numero) {
    return numero < 10 ? '0' + numero : String(numero);
  }

  formatar(ms) {
    const data = new Date(ms);
    return (
      data.getFullYear() +
      '-' +
      this.doisDigitos(data.getMonth() + 1) +
      '-' +
      this.doisDigitos(data.getDate()) +
      ' ' +
      this.doisDigitos(data.getHours()) +
      ':' +
      this.doisDigitos(data.getMinutes()) +
      ':' +
      this.doisDigitos(data.getSeconds())
    );
  }

  // Quando o usuário não informa datas, considera os últimos 30 dias até agora.
  lerPeriodo(query) {
    const agora = Date.now();
    const ate = query.ate ? datas.normalizarData(query.ate) : null;
    const de = query.de ? datas.normalizarData(query.de) : null;
    // Se veio só a data final (AAAA-MM-DD), estende até o final daquele dia (23:59:59).
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

  // Calcula quanto tempo (em ms) uma estadia ou viagem ficou dentro do intervalo pedido no filtro.
  sobreposicao(inicio, fim, periodo) {
    const inicioRecortado = Math.max(this.paraMs(inicio), periodo.deMs);
    const fimRecortado = Math.min(fim ? this.paraMs(fim) : Date.now(), periodo.ateMs);
    return fimRecortado > inicioRecortado ? fimRecortado - inicioRecortado : 0;
  }

  arredondar(valor, casas) {
    const fator = Math.pow(10, casas);
    return Math.round(valor * fator) / fator;
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

    const linhas = alojamentos.map((alojamento) => {
      const leitos = db
        .prepare(
          'SELECT COUNT(*) AS n FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = ?'
        )
        .get(alojamento.id).n;
      let msOcupado = 0;
      let entradas = 0;

      estadias.forEach((estadia) => {
        if (estadia.alojamento_id !== alojamento.id) return;
        const ms = this.sobreposicao(estadia.inicio, estadia.fim, periodo);
        if (ms > 0) msOcupado += ms;
        if (
          this.paraMs(estadia.inicio) >= periodo.deMs &&
          this.paraMs(estadia.inicio) <= periodo.ateMs
        ) {
          entradas++;
        }
      });

      const diasLeitoOcupados = msOcupado / this.msDia;
      const capacidade = leitos * periodo.dias;
      const ocupadosAgora = db
        .prepare(
          'SELECT COUNT(*) AS n FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
            'WHERE q.alojamento_id = ? AND e.fim IS NULL'
        )
        .get(alojamento.id).n;

      return {
        alojamento_id: alojamento.id,
        nome: alojamento.nome,
        cidade: alojamento.cidade,
        leitos: leitos,
        ocupados_agora: ocupadosAgora,
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

    const linhas = veiculos.map((veiculo) => {
      let msUso = 0;
      let km = 0;
      let viagens = 0;
      let ultimaSaida = null;

      usos.forEach((uso) => {
        if (uso.veiculo_id !== veiculo.id) return;
        const ms = this.sobreposicao(uso.saida, uso.retorno, periodo);
        if (ms > 0) {
          msUso += ms;
          viagens++;
          if (uso.km_retorno !== null) km += uso.km_retorno - uso.km_saida;
        }
        if (!ultimaSaida || uso.saida > ultimaSaida) ultimaSaida = uso.saida;
      });

      const horasUso = msUso / 3600000;
      const utilizacao = (msUso / (periodo.ateMs - periodo.deMs)) * 100;
      return {
        veiculo_id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
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
    const filtro = filtros || {};
    const eventos = [];

    db.prepare(
      'SELECT e.inicio, e.fim, p.nome, a.nome AS alojamento, q.nome AS quarto, l.codigo FROM estadia e ' +
        'JOIN pessoa p ON p.id = e.pessoa_id JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
        'JOIN alojamento a ON a.id = q.alojamento_id'
    )
      .all()
      .forEach((estadia) => {
        const recurso = estadia.alojamento + ' · ' + estadia.quarto + ' (' + estadia.codigo + ')';
        if (
          this.paraMs(estadia.inicio) >= periodo.deMs &&
          this.paraMs(estadia.inicio) <= periodo.ateMs
        ) {
          eventos.push({
            quando: estadia.inicio,
            categoria: 'alojamento',
            tipo: 'Entrada',
            colaborador: estadia.nome,
            recurso: recurso
          });
        }
        if (
          estadia.fim &&
          this.paraMs(estadia.fim) >= periodo.deMs &&
          this.paraMs(estadia.fim) <= periodo.ateMs
        ) {
          eventos.push({
            quando: estadia.fim,
            categoria: 'alojamento',
            tipo: 'Saída',
            colaborador: estadia.nome,
            recurso: recurso
          });
        }
      });

    db.prepare(
      'SELECT u.saida, u.retorno, u.destino, u.km_saida, u.km_retorno, p.nome, v.modelo, v.placa FROM uso_veiculo u ' +
        'JOIN pessoa p ON p.id = u.motorista_id JOIN veiculo v ON v.id = u.veiculo_id'
    )
      .all()
      .forEach((uso) => {
        const recurso = uso.modelo + ' · ' + uso.placa;
        if (this.paraMs(uso.saida) >= periodo.deMs && this.paraMs(uso.saida) <= periodo.ateMs) {
          eventos.push({
            quando: uso.saida,
            categoria: 'frota',
            tipo: 'Retirada',
            colaborador: uso.nome,
            recurso: recurso + ' → ' + uso.destino
          });
        }
        if (
          uso.retorno &&
          this.paraMs(uso.retorno) >= periodo.deMs &&
          this.paraMs(uso.retorno) <= periodo.ateMs
        ) {
          eventos.push({
            quando: uso.retorno,
            categoria: 'frota',
            tipo: 'Devolução',
            colaborador: uso.nome,
            recurso: recurso + ' (' + (uso.km_retorno - uso.km_saida) + ' km)'
          });
        }
      });

    eventos.sort((a, b) => (a.quando < b.quando ? 1 : -1));

    const busca = validador.paraBusca(filtro.busca);
    const filtrados = eventos.filter((evento) => {
      if (filtro.categoria && evento.categoria !== filtro.categoria) return false;
      if (filtro.tipo && evento.tipo !== filtro.tipo) return false;
      if (
        busca !== '' &&
        !validador.paraBusca(evento.colaborador + ' ' + evento.recurso).includes(busca)
      ) {
        return false;
      }
      return true;
    });

    const porTipo = {
      Entrada: 0,
      Saída: 0,
      Retirada: 0,
      Devolução: 0
    };
    filtrados.forEach((evento) => {
      porTipo[evento.tipo]++;
    });

    const brutoLimite = Number(filtro.limite);
    const limite =
      Number.isFinite(brutoLimite) && brutoLimite > 0
        ? Math.min(Math.trunc(brutoLimite), 1000)
        : 300;

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

  // Junta numa lista os principais gargalos operacionais (lotação, atrasos e carros parados/sobrecarregados).
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
      .forEach((alojamento) => {
        if (alojamento.leitos > 0) {
          const pct = Math.round((alojamento.ocupados / alojamento.leitos) * 100);
          if (pct >= cfg.lotacaoAlertaPct) {
            itens.push({
              tipo: 'lotacao',
              severidade: pct === 100 ? 'critico' : 'atencao',
              mensagem:
                alojamento.nome +
                ' está com ' +
                pct +
                '% de ocupação (' +
                alojamento.ocupados +
                '/' +
                alojamento.leitos +
                ' leitos).'
            });
          }
        }
      });

    db.prepare(
      'SELECT o.id, o.aberta_em, o.descricao, a.nome FROM ocorrencia o JOIN alojamento a ON a.id = o.alojamento_id WHERE o.resolvida_em IS NULL'
    )
      .all()
      .forEach((ocorrencia) => {
        const dias = Math.floor((agora - this.paraMs(ocorrencia.aberta_em)) / this.msDia);
        if (dias >= cfg.diasAlertaPendencia) {
          itens.push({
            tipo: 'ocorrencia_antiga',
            severidade: 'atencao',
            mensagem:
              'Ocorrência aberta há ' +
              dias +
              ' dias em ' +
              ocorrencia.nome +
              ': ' +
              ocorrencia.descricao
          });
        }
      });

    db.prepare(
      'SELECT u.saida, u.destino, v.modelo, v.placa, p.nome FROM uso_veiculo u JOIN veiculo v ON v.id = u.veiculo_id JOIN pessoa p ON p.id = u.motorista_id WHERE u.retorno IS NULL'
    )
      .all()
      .forEach((uso) => {
        const horas = Math.floor((agora - this.paraMs(uso.saida)) / 3600000);
        if (horas >= cfg.horasAlertaRetorno) {
          itens.push({
            tipo: 'nao_voltou',
            severidade: 'critico',
            mensagem:
              uso.modelo +
              ' ' +
              uso.placa +
              ' saiu há ' +
              horas +
              'h com ' +
              uso.nome +
              ' (' +
              uso.destino +
              ') e não voltou.'
          });
        }
      });

    db.prepare(
      'SELECT m.inicio, m.descricao, v.modelo, v.placa FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id WHERE m.fim IS NULL'
    )
      .all()
      .forEach((manutencao) => {
        const dias = Math.floor((agora - this.paraMs(manutencao.inicio)) / this.msDia);
        if (dias >= cfg.diasAlertaPendencia) {
          itens.push({
            tipo: 'oficina_longa',
            severidade: 'atencao',
            mensagem:
              manutencao.modelo +
              ' ' +
              manutencao.placa +
              ' está na oficina há ' +
              dias +
              ' dias (' +
              manutencao.descricao +
              ').'
          });
        }
      });

    const usos = db.prepare('SELECT veiculo_id, saida, retorno FROM uso_veiculo').all();
    db.prepare('SELECT id, placa, modelo FROM veiculo WHERE ativo = 1')
      .all()
      .forEach((veiculo) => {
        let ms = 0;
        usos.forEach((uso) => {
          if (uso.veiculo_id === veiculo.id) ms += this.sobreposicao(uso.saida, uso.retorno, periodo);
        });
        const pct = (ms / (periodo.ateMs - periodo.deMs)) * 100;
        if (pct >= 70) {
          itens.push({
            tipo: 'frota_sobrecarregada',
            severidade: 'atencao',
            mensagem:
              veiculo.modelo +
              ' ' +
              veiculo.placa +
              ' ficou ' +
              this.arredondar(pct, 0) +
              '% do período em uso: pode faltar carro.'
          });
        } else if (pct < 5 && periodo.dias >= 7) {
          itens.push({
            tipo: 'frota_ociosa',
            severidade: 'atencao',
            mensagem:
              veiculo.modelo +
              ' ' +
              veiculo.placa +
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
