// Carrega dados de exemplo da Construtora Aguapeí (colaboradores, alojamentos, veículos e histórico).
// Uso: npm run seed (só roda depois de criar o banco e se ainda não tiver colaboradores).
const db = require('./conexao');
const auditoria = require('../services/Auditoria');

class CargaExemplos {
  constructor() {
    // Semente fixa para todo mundo do grupo gerar exatamente os mesmos dados de exemplo.
    this.semente = 20260501;
    this.msHora = 3600000;
    this.msDia = 24 * this.msHora;
    this.agora = Date.now();
    this.inicio = this.agora - 180 * this.msDia;
    this.futuro = this.agora + 3650 * this.msDia;
    this.ocupacao = {};
  }

  sortearNumero() {
    this.semente = (this.semente * 1664525 + 1013904223) % 4294967296;
    return this.semente / 4294967296;
  }

  entre(minimo, maximo) {
    return minimo + Math.floor(this.sortearNumero() * (maximo - minimo + 1));
  }

  escolherDaLista(lista) {
    return lista[Math.floor(this.sortearNumero() * lista.length)];
  }

  doisDigitos(n) {
    return n < 10 ? '0' + n : String(n);
  }

  formatarDataHora(ms) {
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
      ':00'
    );
  }

  dataEmDias(dias) {
    return this.formatarDataHora(this.agora + dias * this.msDia).slice(0, 10);
  }

  estaLivre(chave, ini, fim) {
    const lista = this.ocupacao[chave] || [];
    return lista.every((intervalo) => {
      return fim <= intervalo[0] || ini >= intervalo[1];
    });
  }

  marcarOcupado(chave, ini, fim) {
    if (!this.ocupacao[chave]) {
      this.ocupacao[chave] = [];
    }
    this.ocupacao[chave].push([ini, fim]);
  }

  cnhServePara(cnh, exigida) {
    const categorias = cnh.replace(/[^A-E]/g, '');
    if (exigida === 'B') return /[BCDE]/.test(categorias);
    if (exigida === 'D') return /[DE]/.test(categorias);
    return categorias.indexOf(exigida) !== -1;
  }

  executar() {
    if (db.prepare('SELECT COUNT(*) AS n FROM pessoa').get().n > 0) {
      console.log(
        'O banco já tem colaboradores. Apague o arquivo do banco e rode "npm run criar-banco" antes do seed.'
      );
      process.exit(1);
    }

    const admin = db.prepare("SELECT id FROM usuario WHERE perfil = 'admin' ORDER BY id LIMIT 1").get();
    if (!admin) {
      console.log('Rode "npm run criar-banco" antes (precisa do usuário administrador).');
      process.exit(1);
    }

    // Usa transação (BEGIN / COMMIT) para não deixar o banco preenchido pela metade se algo falhar.
    db.exec('BEGIN');
    try {
      const equipe = [
        ['João Vitor Santos', 'AG-101', 'Técnico de Obras', 'Marília Norte', 'B', 600],
        ['Kelvin Gomes', 'AG-102', 'Engenheiro Residente', 'Sede / Rodovia SP-294', 'B,D', 900],
        ['Bruno Martins', 'AG-103', 'Mestre de Obras', 'Alojamento Centro', 'B', 500],
        ['Henrique Di Manno', 'AG-104', 'Topógrafo', 'Assis Sul', 'A,B', 20],
        ['Matheus Silva', 'AG-105', 'Eletricista Predial', 'Marília Norte', 'B', 700],
        ['Carlos Eduardo Ramos', 'AG-106', 'Motorista de Van', 'Transporte Intermunicipal', 'D', 12],
        ['Vinicius Almeida', 'AG-107', 'Operador de Máquinas', 'Rodovia SP-294', 'C,E', 800],
        ['Antônio Ferreira', 'AG-108', 'Encanador Industrial', 'Alojamento Sul', null, null],
        ['Lucas Oliveira', 'AG-109', 'Carpinteiro', 'Marília Norte', null, null],
        ['Rafael Costa', 'AG-110', 'Pedreiro de Acabamento', 'Assis Sul', null, null],
        ['Guilherme Souza', 'AG-111', 'Auxiliar de Almoxarifado', 'Sede', 'B', -60],
        ['Fernando Dias', 'AG-112', 'Soldador', 'Rodovia SP-294', 'B', 400],
        ['Rodrigo Pires', 'AG-113', 'Pintor Industrial', 'Alojamento Centro', null, null],
        ['Marcos Vinicius', 'AG-114', 'Apontador de Obra', 'Marília Norte', 'B', 650],
        ['Leandro Barbosa', 'AG-115', 'Encarregado Geral', 'Assis Sul', 'B,C', 450]
      ];

      const inserirPessoa = db.prepare(
        'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      );
      const pessoas = equipe.map((item, indice) => {
        const res = inserirPessoa.run(
          item[0],
          item[1],
          item[2],
          item[3],
          '149912300' + this.doisDigitos(indice + 1),
          item[4],
          item[5] === null ? null : this.dataEmDias(item[5])
        );
        return {
          id: Number(res.lastInsertRowid),
          nome: item[0],
          cnh: item[4],
          validade: item[5]
        };
      });

      const motoristas = pessoas.filter((p) => {
        return p.cnh;
      });

      // Alojamentos, quartos e leitos
      const inserirAloj = db.prepare(
        'INSERT INTO alojamento (nome, responsavel_id, cidade, bairro, ativo) VALUES (?, ?, ?, ?, 1)'
      );
      const inserirQuarto = db.prepare(
        'INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)'
      );
      const inserirLeito = db.prepare(
        'INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)'
      );

      const planoAlojamentos = [
        {
          nome: 'República Centro',
          cidade: 'Marília',
          bairro: 'Centro',
          resp: 2,
          quartos: [
            ['Q1', 14, 'BB C'],
            ['Q2', 14, 'CCCC']
          ]
        },
        {
          nome: 'Alojamento Obra Norte',
          cidade: 'Assis',
          bairro: 'Vila Operária',
          resp: 4,
          quartos: [
            ['Q1', 16, 'BBB'],
            ['Q2', 8, 'CC']
          ]
        },
        {
          nome: 'Alojamento Sul',
          cidade: 'Ourinhos',
          bairro: 'Jardim Europa',
          resp: 14,
          quartos: [['Q1', 16, 'BB CC']]
        }
      ];

      const leitos = [];
      const alojamentoIds = [];
      planoAlojamentos.forEach((aloj) => {
        const aid = Number(
          inserirAloj.run(aloj.nome, pessoas[aloj.resp].id, aloj.cidade, aloj.bairro)
            .lastInsertRowid
        );
        alojamentoIds.push(aid);

        aloj.quartos.forEach((quarto) => {
          const qid = Number(inserirQuarto.run(aid, quarto[0], quarto[1]).lastInsertRowid);
          let numero = 1;
          const criarLeito = (tipo) => {
            const codigo = quarto[0] + '-' + this.doisDigitos(numero++);
            const lid = Number(inserirLeito.run(qid, codigo, tipo).lastInsertRowid);
            leitos.push({ id: lid, aloj: aid });
          };

          quarto[2]
            .replace(/ /g, '')
            .split('')
            .forEach((letra) => {
              if (letra === 'C') {
                criarLeito('cama');
              } else {
                criarLeito('beliche_baixo');
                criarLeito('beliche_cima');
              }
            });
        });
      });

      // Mistura os leitos para espalhar a ocupação entre todos os alojamentos.
      const leitosEmbaralhados = leitos.slice().sort(() => {
        return this.sortearNumero() - 0.5;
      });
      const inserirEstadia = db.prepare(
        'INSERT INTO estadia (pessoa_id, leito_id, inicio, fim) VALUES (?, ?, ?, ?)'
      );
      const ultimoFimDoLeito = {};

      leitosEmbaralhados.forEach((leito) => {
        let tempo = this.inicio + this.entre(0, 20) * this.msDia;
        for (let tentativa = 0; tentativa < 6; tentativa++) {
          const duracao = this.entre(15, 60) * this.msDia;
          const fim = tempo + duracao;
          if (fim > this.agora - 5 * this.msDia) break;

          const candidatos = pessoas.filter((p) => {
            return this.estaLivre('e' + p.id, tempo, fim);
          });
          if (candidatos.length === 0) break;

          const escolhido = this.escolherDaLista(candidatos);
          this.marcarOcupado('e' + escolhido.id, tempo, fim);
          inserirEstadia.run(
            escolhido.id,
            leito.id,
            this.formatarDataHora(tempo),
            this.formatarDataHora(fim)
          );
          ultimoFimDoLeito[leito.id] = fim;
          tempo = fim + this.entre(0, 10) * this.msDia;
        }
      });

      let alojadosAgora = 0;
      leitosEmbaralhados.forEach((leito) => {
        if (this.sortearNumero() > 0.6) return;
        const ini = (ultimoFimDoLeito[leito.id] || this.inicio) + this.entre(1, 5) * this.msDia;
        if (ini > this.agora - this.msDia) return;

        const candidatos = pessoas.filter((p) => {
          return this.estaLivre('e' + p.id, ini, this.futuro);
        });
        if (candidatos.length === 0) return;

        const escolhido = this.escolherDaLista(candidatos);
        this.marcarOcupado('e' + escolhido.id, ini, this.futuro);
        inserirEstadia.run(escolhido.id, leito.id, this.formatarDataHora(ini), null);
        alojadosAgora++;
      });

      // Ocorrências de alojamento (algumas resolvidas e duas ainda em aberto)
      const inserirOcorrencia = db.prepare(
        'INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em, resolvida_em, solucao) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const ocorrencias = [
        [0, null, 'manutencao', 'Chuveiro do banheiro 1 sem aquecimento', -120, -118, 'Resistência trocada'],
        [1, 2, 'reclamacao', 'Barulho depois das 22h no Q2', -90, -88, 'Conversa com os envolvidos e aviso das regras da casa'],
        [2, null, 'manutencao', 'Vazamento na torneira da cozinha', -60, -59, 'Vedação trocada'],
        [0, 12, 'conflito', 'Discussão por causa de uso do fogão', -30, -29, 'Escala de uso da cozinha combinada'],
        [1, null, 'manutencao', 'Janela do Q1 não fecha', -12, null, null],
        [2, null, 'regra', 'Visitante dormiu sem aviso ao responsável', -1, null, null]
      ];
      ocorrencias.forEach((o) => {
        inserirOcorrencia.run(
          alojamentoIds[o[0]],
          o[1] === null ? null : pessoas[o[1]].id,
          o[2],
          o[3],
          this.formatarDataHora(this.agora + o[4] * this.msDia),
          o[5] === null ? null : this.formatarDataHora(this.agora + o[5] * this.msDia),
          o[6]
        );
      });

      // Frota
      const inserirVeic = db.prepare(
        'INSERT INTO veiculo (placa, modelo, lugares, categoria_cnh_exigida, km_inicial, licenciamento_validade, seguro_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      );
      const frota = [
        ['ABC-1D23', 'Toyota Corolla', 5, 'B', 41200, 200, 150],
        ['DEF-5678', 'Toyota Hilux', 5, 'B', 63800, 120, 25],
        ['GHI-9012', 'Fiat Strada', 3, 'B', 28900, 300, 280],
        ['JKL-3456', 'Mercedes Sprinter', 15, 'D', 97400, 90, 60],
        ['MNO-7890', 'VW Saveiro', 2, 'B', 55100, 60, 8],
        ['PQR-1A23', 'VW Gol', 5, 'B', 74300, 240, 210]
      ].map((v) => {
        const id = Number(
          inserirVeic.run(
            v[0],
            v[1],
            v[2],
            v[3],
            v[4],
            this.dataEmDias(v[5]),
            this.dataEmDias(v[6])
          ).lastInsertRowid
        );
        return { id: id, modelo: v[1], lugares: v[2], cat: v[3], km: v[4] };
      });

      const inserirUso = db.prepare(
        'INSERT INTO uso_veiculo (veiculo_id, motorista_id, destino, saida, retorno, km_saida, km_retorno) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const inserirPass = db.prepare(
        'INSERT INTO uso_passageiro (uso_veiculo_id, pessoa_id) VALUES (?, ?)'
      );
      const destinos = [
        'Obra Marília Norte',
        'Obra Assis Sul',
        'Obra Rodovia SP-294',
        'Fornecedor em Bauru',
        'Almoxarifado Central',
        'Posto de combustível',
        'Obra Ourinhos',
        'Escritório Marília'
      ];
      const inserirManut = db.prepare(
        'INSERT INTO manutencao (veiculo_id, tipo, descricao, inicio, fim, km) VALUES (?, ?, ?, ?, ?, ?)'
      );
      let totalUsos = 0;

      frota.forEach((veiculo, indice) => {
        let tempo = this.inicio + this.entre(0, 5) * this.msDia;
        let km = veiculo.km;
        let usosDoVeiculo = 0;

        while (tempo < this.agora - 2 * this.msDia) {
          const duracao = this.entre(2, 30) * this.msHora;
          const fim = tempo + duracao;
          if (fim > this.agora - this.msDia) break;

          const aptos = motoristas.filter((p) => {
            const validoNaData =
              p.validade === null ||
              this.formatarDataHora(fim).slice(0, 10) <= this.dataEmDias(p.validade) ||
              p.validade < 0;
            return (
              this.cnhServePara(p.cnh, veiculo.cat) &&
              validoNaData &&
              this.estaLivre('v' + p.id, tempo, fim)
            );
          });

          if (aptos.length === 0) {
            tempo = fim + this.msDia;
            continue;
          }

          const motorista = this.escolherDaLista(aptos);
          // Simula 38 km rodados sem anotação na Saveiro para o alerta de quilometragem aparecer nos testes.
          const kmSaida = km + (indice === 4 && usosDoVeiculo === 5 ? 38 : 0);
          const kmVolta = kmSaida + this.entre(20, 400);
          this.marcarOcupado('v' + motorista.id, tempo, fim);

          const usoId = Number(
            inserirUso.run(
              veiculo.id,
              motorista.id,
              this.escolherDaLista(destinos),
              this.formatarDataHora(tempo),
              this.formatarDataHora(fim),
              kmSaida,
              kmVolta
            ).lastInsertRowid
          );

          const qtdPassageiros = Math.min(veiculo.lugares - 1, this.entre(0, 3));
          const jaNoCarro = {};
          for (let i = 0; i < qtdPassageiros; i++) {
            const candidatos = pessoas.filter((p) => {
              return (
                p.id !== motorista.id &&
                !jaNoCarro[p.id] &&
                this.estaLivre('v' + p.id, tempo, fim)
              );
            });
            if (candidatos.length === 0) break;
            const passageiro = this.escolherDaLista(candidatos);
            jaNoCarro[passageiro.id] = true;
            this.marcarOcupado('v' + passageiro.id, tempo, fim);
            inserirPass.run(usoId, passageiro.id);
          }

          km = kmVolta;
          usosDoVeiculo++;
          totalUsos++;
          tempo = fim + this.entre(0, 4) * this.msDia + this.entre(1, 12) * this.msHora;
        }
        veiculo.km = km;
      });

      const manutencoesConcluidas = [
        [0, 'preventiva', 'Revisão dos 40 mil km', -100, -99],
        [1, 'corretiva', 'Troca de pastilhas de freio', -70, -68],
        [3, 'preventiva', 'Troca de óleo e filtros', -45, -44],
        [5, 'corretiva', 'Alternador', -20, -17]
      ];
      manutencoesConcluidas.forEach((m) => {
        inserirManut.run(
          frota[m[0]].id,
          m[1],
          m[2],
          this.formatarDataHora(this.agora + m[3] * this.msDia),
          this.formatarDataHora(this.agora + m[4] * this.msDia),
          frota[m[0]].km
        );
      });

      // Gol parado na oficina há 9 dias para aparecer nos gargalos.
      inserirManut.run(
        frota[5].id,
        'corretiva',
        'Troca do kit de embreagem',
        this.formatarDataHora(this.agora - 9 * this.msDia),
        null,
        frota[5].km
      );

      // Dois veículos na rua agora (um dentro do prazo e outro atrasado para testar os alertas).
      const registrarSaidaAgora = (veiculo, horas, motoristaIdx, destino, passageirosIdx) => {
        const tempo = this.agora - horas * this.msHora;
        const motorista = pessoas[motoristaIdx];
        const uid = Number(
          inserirUso.run(
            veiculo.id,
            motorista.id,
            destino,
            this.formatarDataHora(tempo),
            null,
            veiculo.km,
            null
          ).lastInsertRowid
        );
        this.marcarOcupado('v' + motorista.id, tempo, this.futuro);
        passageirosIdx.forEach((idx) => {
          inserirPass.run(uid, pessoas[idx].id);
          this.marcarOcupado('v' + pessoas[idx].id, tempo, this.futuro);
        });
      };

      const livreAgora = (idx) => {
        return this.estaLivre('v' + pessoas[idx].id, this.agora - 24 * this.msHora, this.futuro);
      };
      if (livreAgora(1)) {
        registrarSaidaAgora(frota[1], 3, 1, 'Obra Rodovia SP-294', []);
      }
      if (livreAgora(5)) {
        registrarSaidaAgora(frota[3], 20, 5, 'Obra Assis Sul', livreAgora(3) ? [3] : []);
      }

      // Grava um resumo dessa carga inicial no log de auditoria.
      auditoria.registrarLog({
        usuarioId: admin.id,
        acao: 'criou',
        tabela: 'pessoa',
        registroId: 1,
        resumo: 'Carregou 15 colaboradores de demonstração (Construtora Aguapeí)'
      });
      auditoria.registrarLog({
        usuarioId: admin.id,
        acao: 'criou',
        tabela: 'alojamento',
        registroId: 1,
        resumo: 'Carregou 3 alojamentos com ' + leitos.length + ' leitos e histórico de estadias'
      });
      auditoria.registrarLog({
        usuarioId: admin.id,
        acao: 'criou',
        tabela: 'veiculo',
        registroId: 1,
        resumo: 'Carregou 6 veículos com ' + totalUsos + ' usos e manutenções'
      });

      db.exec('COMMIT');
      console.log('Dados de exemplo carregados:');
      console.log(
        '- ' +
          pessoas.length +
          ' colaboradores, ' +
          alojamentoIds.length +
          ' alojamentos, ' +
          leitos.length +
          ' leitos (' +
          alojadosAgora +
          ' ocupados agora)'
      );
      console.log(
        '- ' +
          frota.length +
          ' veículos, ' +
          totalUsos +
          ' usos, ' +
          ocorrencias.length +
          ' ocorrências'
      );
    } catch (erro) {
      db.exec('ROLLBACK');
      console.log('Deu erro no seed: ' + erro.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  new CargaExemplos().executar();
}

module.exports = CargaExemplos;
