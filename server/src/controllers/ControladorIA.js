// Ações de ia.
const db = require('../db/conexao');
const ia = require('../services/InteligenciaArtificial');
const relatorios = require('../services/Relatorios');
const configuracao = require('../services/Configuracao');
class ControladorIA {
  constructor() {
    this.regrasSistema =
      'Você é o assistente do Dispatch, sistema de gestão de pessoas, alojamentos e frota de uma construtora. ' +
      'Responda em português do Brasil, de forma curta e objetiva, usando SOMENTE os dados fornecidos. ' +
      'Se a resposta não estiver nos dados, diga que não tem essa informação.';
  }

  montarContexto(periodo) {
    const ocupacao = relatorios.calcularOcupacao(periodo);
    const frota = relatorios.calcularFrota(periodo);
    const gargalos = relatorios.calcularGargalos(periodo);
    const porTipo = {};
    gargalos.gargalos.forEach((g) => {
      porTipo[g.tipo] = (porTipo[g.tipo] || 0) + 1;
    });
    return {
      empresa: configuracao.lerConfig().nomeEmpresa,
      periodo: {
        de: periodo.de.slice(0, 10),
        ate: periodo.ate.slice(0, 10)
      },
      colaboradores_ativos: db.prepare('SELECT COUNT(*) AS n FROM pessoa WHERE ativo = 1').get().n,
      alojamentos: ocupacao.alojamentos.map((a) => {
        return {
          nome: a.nome,
          cidade: a.cidade,
          leitos: a.leitos,
          ocupados_agora: a.ocupados_agora,
          ocupacao_media_pct: a.ocupacao_media_pct,
          entradas_no_periodo: a.entradas_no_periodo
        };
      }),
      frota: frota.veiculos.map((v) => {
        return {
          veiculo: v.modelo + ' ' + v.placa,
          viagens: v.viagens,
          km_rodados: v.km_rodados,
          utilizacao_pct: v.utilizacao_pct,
          dias_sem_uso: v.dias_sem_uso
        };
      }),
      gargalos_por_tipo: porTipo,
      ocorrencias_abertas: db
        .prepare('SELECT COUNT(*) AS n FROM ocorrencia WHERE resolvida_em IS NULL')
        .get().n,
      veiculos_em_manutencao: db
        .prepare('SELECT COUNT(*) AS n FROM manutencao WHERE fim IS NULL')
        .get().n
    };
  }

  periodoOuPadrao(query) {
    return relatorios.lerPeriodo(query || {});
  }

  exigirLogin(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    next();
  }

  async perguntar(req, res) {
    const pergunta = (req.body.pergunta || '').trim();
    if (pergunta === '')
      return res.status(400).json({
        erro: 'Escreva a pergunta.'
      });
    if (pergunta.length > 500)
      return res.status(400).json({
        erro: 'Pergunta muito longa (máx. 500 caracteres).'
      });
    if (!ia.configurada())
      return res.status(503).json({
        erro: 'IA desligada: defina GROQ_API_KEY no server/.env.'
      });
    const periodo = this.periodoOuPadrao(req.body);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    try {
      const resposta = await ia.perguntar([
        {
          role: 'system',
          content:
            this.regrasSistema +
            ' Dados atuais (JSON): ' +
            JSON.stringify(this.montarContexto(periodo))
        },
        {
          role: 'user',
          content: pergunta
        }
      ]);
      res.json({
        resposta: resposta
      });
    } catch (erro) {
      res.status(502).json({
        erro: erro.message
      });
    }
  }

  async resumir(req, res) {
    if (!ia.configurada())
      return res.status(503).json({
        erro: 'IA desligada: defina GROQ_API_KEY no server/.env.'
      });
    const periodo = this.periodoOuPadrao(req.body);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    try {
      const resposta = await ia.perguntar(
        [
          {
            role: 'system',
            content:
              this.regrasSistema + ' Dados (JSON): ' + JSON.stringify(this.montarContexto(periodo))
          },
          {
            role: 'user',
            content:
              'Faça um resumo executivo do período em até 5 tópicos curtos: ocupação dos alojamentos, uso da frota, pontos de atenção e uma recomendação.'
          }
        ],
        {
          maxTokens: 600
        }
      );
      res.json({
        resposta: resposta
      });
    } catch (erro) {
      res.status(502).json({
        erro: erro.message
      });
    }
  }

  async responderSuporte(req, res) {
    const mensagem = (req.body.mensagem || '').trim();
    if (mensagem === '')
      return res.status(400).json({
        erro: 'Escreva a mensagem.'
      });
    if (mensagem.length > 500)
      return res.status(400).json({
        erro: 'Mensagem muito longa (máx. 500 caracteres).'
      });
    if (!ia.configurada())
      return res.status(503).json({
        erro: 'IA desligada: defina GROQ_API_KEY no server/.env.'
      });
    const ajuda =
      'Telas: Visão Geral (indicadores e alertas), Colaboradores (cadastro, CNH e histórico), Alojamentos (mapa de leitos, entrada/saída, ocorrências), ' +
      'Frota (saída, volta, manutenção, documentos), Relatórios (ocupação, uso da frota, movimentações, gargalos, quem estava dirigindo) e Auditoria (log de alterações, só admin). ' +
      'Regras: o motorista precisa de CNH válida e da categoria certa; licenciamento vencido e manutenção em aberto bloqueiam a saída do veículo; ' +
      'seguro vencido e km diferente da última volta só geram aviso; viagem acima de 2.000 km pede confirmação; ' +
      'um quarto tem no máximo 8 leitos e precisa de 3 m² por cama e 4,5 m² por beliche; nada é apagado, só desativado.';
    try {
      const resposta = await ia.perguntar(
        [
          {
            role: 'system',
            content:
              'Você é o suporte do Dispatch. Explique como usar o sistema em português do Brasil, em poucos passos. ' +
              ajuda
          },
          {
            role: 'user',
            content: mensagem
          }
        ],
        {
          maxTokens: 400
        }
      );
      res.json({
        resposta: resposta
      });
    } catch (erro) {
      res.status(502).json({
        erro: erro.message
      });
    }
  }
}
module.exports = ControladorIA;
