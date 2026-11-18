// Analisa o banco em busca de pendências (CNH, documentos de carro, viagens atrasadas, lotação etc.) e cria os alertas.
const db = require('../db/conexao');
const auditoria = require('./Auditoria');
const telegram = require('./Telegram');
const ia = require('./InteligenciaArtificial');
const Cnh = require('../models/Cnh');
const datas = require('../regras/datas');

class Notificacoes {
  constructor() {
    this.ultimaVerificacao = 0;
    this.aindaValendo = new Set();
  }

  // Só grava um alerta novo se ainda não existir outro igual sem leitura ou criado nas últimas 24h.
  criar(lista, tipo, severidade, mensagem, tabela, registroId) {
    // anota que esse problema ainda existe nessa varredura (usado no limparResolvidas)
    this.aindaValendo.add(this.chave(tipo, tabela, registroId));

    const existe = db
      .prepare(
        "SELECT id FROM notificacao WHERE tipo = ? AND IFNULL(tabela, '') = ? AND IFNULL(registro_id, 0) = ? " +
          "AND (lida = 0 OR criada_em >= datetime('now', 'localtime', '-1 day')) LIMIT 1"
      )
      .get(tipo, tabela || '', registroId || 0);
    if (existe) return;

    const resultado = db
      .prepare(
        'INSERT INTO notificacao (tipo, severidade, mensagem, tabela, registro_id) VALUES (?, ?, ?, ?, ?)'
      )
      .run(tipo, severidade, mensagem, tabela || null, registroId || null);

    lista.push({
      id: Number(resultado.lastInsertRowid),
      severidade: severidade,
      mensagem: mensagem
    });
  }

  chave(tipo, tabela, registroId) {
    return tipo + '|' + (tabela || '') + '|' + (registroId || 0);
  }

  // Quando o problema some (o carro voltou, a manutenção acabou, a CNH foi renovada...),
  // o alerta antigo não faz mais sentido. Marca como lido pra ele sair do sino sozinho.
  limparResolvidas() {
    const abertas = db
      .prepare('SELECT id, tipo, tabela, registro_id FROM notificacao WHERE lida = 0')
      .all();
    const marcarLida = db.prepare('UPDATE notificacao SET lida = 1 WHERE id = ?');
    abertas.forEach((aviso) => {
      if (!this.aindaValendo.has(this.chave(aviso.tipo, aviso.tabela, aviso.registro_id))) {
        marcarLida.run(aviso.id);
      }
    });
  }

  gerarAvisos(cfg) {
    const novos = [];
    this.aindaValendo = new Set();
    const diasAlerta = cfg.diasAvisoVencimento;
    const agora = Date.now();
    const horaEmMs = 3600000;

    // 1. CNH vencendo ou vencida (se o motorista estiver na rua com a CNH vencida, vira alerta crítico)
    db.prepare(
      'SELECT id, nome, cnh_categorias, cnh_validade FROM pessoa WHERE ativo = 1 AND cnh_categorias IS NOT NULL'
    )
      .all()
      .forEach((pessoa) => {
        const situacao = new Cnh(pessoa.cnh_categorias, pessoa.cnh_validade).situacao(diasAlerta);
        if (situacao.status === 'vencendo') {
          this.criar(
            novos,
            'cnh_vencendo',
            'atencao',
            'A CNH de ' + pessoa.nome + ' vence em ' + situacao.diasRestantes + ' dias.',
            'pessoa',
            pessoa.id
          );
        } else if (situacao.status === 'vencida') {
          const naRua = db
            .prepare('SELECT id FROM uso_veiculo WHERE motorista_id = ? AND retorno IS NULL')
            .get(pessoa.id);
          this.criar(
            novos,
            naRua ? 'cnh_vencida_na_rua' : 'cnh_vencida',
            naRua ? 'critico' : 'atencao',
            'A CNH de ' +
              pessoa.nome +
              ' está vencida' +
              (naRua ? ' e a pessoa está com um veículo na rua.' : '.'),
            'pessoa',
            pessoa.id
          );
        }
      });

    // 2. Licenciamento e seguro dos veículos
    db.prepare(
      'SELECT id, placa, modelo, licenciamento_validade, seguro_validade FROM veiculo WHERE ativo = 1'
    )
      .all()
      .forEach((veiculo) => {
        const documentos = [
          ['licenciamento', 'Licenciamento', veiculo.licenciamento_validade],
          ['seguro', 'Seguro', veiculo.seguro_validade]
        ];
        documentos.forEach((doc) => {
          const diasFaltando = datas.diasAte(doc[2]);
          if (diasFaltando === null) return;
          if (diasFaltando < 0) {
            this.criar(
              novos,
              doc[0] + '_vencido',
              'atencao',
              doc[1] +
                ' do ' +
                veiculo.modelo +
                ' ' +
                veiculo.placa +
                ' venceu há ' +
                Math.abs(diasFaltando) +
                ' dias.',
              'veiculo',
              veiculo.id
            );
          } else if (diasFaltando <= diasAlerta) {
            this.criar(
              novos,
              doc[0] + '_vencendo',
              'atencao',
              doc[1] +
                ' do ' +
                veiculo.modelo +
                ' ' +
                veiculo.placa +
                ' vence em ' +
                diasFaltando +
                ' dias.',
              'veiculo',
              veiculo.id
            );
          }
        });
      });

    // 3. Diferença de quilometragem sem registro (quando o carro sai com km maior do que voltou da última viagem)
    const veiculos = db.prepare('SELECT id, placa, modelo, km_inicial FROM veiculo').all();
    const limite30Dias = new Date(agora - 30 * 24 * horaEmMs);
    veiculos.forEach((veiculo) => {
      const usos = db
        .prepare(
          'SELECT id, saida, km_saida, km_retorno FROM uso_veiculo WHERE veiculo_id = ? ORDER BY saida, id'
        )
        .all(veiculo.id);
      let kmEsperado = veiculo.km_inicial;
      usos.forEach((uso) => {
        if (uso.km_saida > kmEsperado && new Date(uso.saida.replace(' ', 'T')) >= limite30Dias) {
          this.criar(
            novos,
            'km_sem_registro',
            'critico',
            'O ' +
              veiculo.modelo +
              ' ' +
              veiculo.placa +
              ' rodou ' +
              (uso.km_saida - kmEsperado) +
              ' km sem registro antes da saída de ' +
              uso.saida.slice(0, 16) +
              '.',
            'uso_veiculo',
            uso.id
          );
        }
        if (uso.km_retorno !== null) kmEsperado = uso.km_retorno;
      });
    });

    // 4. Veículos que passaram do horário previsto sem registrar devolução
    db.prepare(
      'SELECT u.id, u.saida, v.modelo, v.placa FROM uso_veiculo u JOIN veiculo v ON v.id = u.veiculo_id WHERE u.retorno IS NULL'
    )
      .all()
      .forEach((uso) => {
        const horasFora = Math.floor((agora - new Date(uso.saida.replace(' ', 'T')).getTime()) / horaEmMs);
        if (horasFora >= cfg.horasAlertaRetorno) {
          this.criar(
            novos,
            'nao_voltou',
            'critico',
            'O ' + uso.modelo + ' ' + uso.placa + ' saiu há ' + horasFora + 'h e ainda não voltou.',
            'uso_veiculo',
            uso.id
          );
        }
      });

    // 5. Alojamentos com ocupação igual ou acima da porcentagem de alerta
    db.prepare(
      'SELECT a.id, a.nome, (SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS leitos, ' +
        '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS ocupados ' +
        'FROM alojamento a WHERE a.ativo = 1'
    )
      .all()
      .forEach((alojamento) => {
        if (
          alojamento.leitos > 0 &&
          Math.round((alojamento.ocupados / alojamento.leitos) * 100) >= cfg.lotacaoAlertaPct
        ) {
          this.criar(
            novos,
            'alojamento_lotado',
            'atencao',
            alojamento.nome +
              ' está com ' +
              alojamento.ocupados +
              ' de ' +
              alojamento.leitos +
              ' leitos ocupados.',
            'alojamento',
            alojamento.id
          );
        }
      });

    // 6. Ocorrências em alojamentos abertas há muitos dias
    db.prepare(
      'SELECT o.id, o.aberta_em, o.descricao, a.nome FROM ocorrencia o JOIN alojamento a ON a.id = o.alojamento_id WHERE o.resolvida_em IS NULL'
    )
      .all()
      .forEach((ocorrencia) => {
        const diasAbertos = Math.floor(
          (agora - new Date(ocorrencia.aberta_em.replace(' ', 'T')).getTime()) / (24 * horaEmMs)
        );
        if (diasAbertos >= cfg.diasAlertaPendencia) {
          this.criar(
            novos,
            'ocorrencia_antiga',
            'atencao',
            'Ocorrência aberta há ' +
              diasAbertos +
              ' dias em ' +
              ocorrencia.nome +
              ': ' +
              ocorrencia.descricao,
            'ocorrencia',
            ocorrencia.id
          );
        }
      });

    // 7. Veículos parados na oficina há muitos dias
    db.prepare(
      'SELECT m.id, m.inicio, v.modelo, v.placa FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id WHERE m.fim IS NULL'
    )
      .all()
      .forEach((manutencao) => {
        const diasOficina = Math.floor(
          (agora - new Date(manutencao.inicio.replace(' ', 'T')).getTime()) / (24 * horaEmMs)
        );
        if (diasOficina >= cfg.diasAlertaPendencia) {
          this.criar(
            novos,
            'oficina_longa',
            'atencao',
            'O ' +
              manutencao.modelo +
              ' ' +
              manutencao.placa +
              ' está na oficina há ' +
              diasOficina +
              ' dias.',
            'manutencao',
            manutencao.id
          );
        }
      });

    // 8. Integridade do histórico de auditoria
    const integridade = auditoria.verificarIntegridadeLog();
    if (!integridade.integro) {
      this.criar(
        novos,
        'log_adulterado',
        'critico',
        'Log de auditoria adulterado: ' + integridade.motivo,
        'log_auditoria',
        integridade.linhaComProblema
      );
    }

    this.limparResolvidas();
    return novos;
  }

  async verificar(cfg) {
    this.ultimaVerificacao = Date.now();
    const novos = this.gerarAvisos(cfg);
    if (cfg.telegramCriticos) {
      const criticos = novos.filter((aviso) => aviso.severidade === 'critico');
      for (let i = 0; i < criticos.length; i++) {
        const texto = await ia.redigirAlerta(
          '[DISPATCH · ' + cfg.nomeEmpresa + '] ' + criticos[i].mensagem
        );
        const admins = db
          .prepare(
            "SELECT telegram_chat_id FROM usuario WHERE perfil = 'admin' AND ativo = 1 AND telegram_chat_id IS NOT NULL"
          )
          .all();

        let enviado = false;
        if (admins.length === 0) {
          enviado = (await telegram.enviar(texto)).enviado;
        }
        for (let j = 0; j < admins.length; j++) {
          if ((await telegram.enviar(texto, admins[j].telegram_chat_id)).enviado) {
            enviado = true;
          }
        }
        if (enviado) {
          db.prepare('UPDATE notificacao SET enviada_telegram = 1 WHERE id = ?').run(criticos[i].id);
        }
      }
    }
    return novos;
  }

  // Evita rodar toda a varredura de avisos a cada clique: limita a uma vez por minuto.
  precisaVerificar() {
    return Date.now() - this.ultimaVerificacao > 60000;
  }
}

module.exports = new Notificacoes();
