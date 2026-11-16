// Carrega os dados de demonstração da Construtora Aguapeí (Marília/SP), usados na apresentação.
// Tudo aqui é fictício: empresa, pessoas, documentos, placas e telefones.
//
// Cenário: a construtora tem 4 obras na região e um alojamento perto de cada uma.
//   - Residencial Vale do Aguapeí (Marília)      → República Centro (Marília)
//   - Duplicação SP-294, lote 2 (Pompéia)          → Alojamento Pompéia
//   - Centro de Distribuição Assis (Assis)        → Alojamento Assis
//   - UBS Jardim Europa (Ourinhos)                 → Alojamento Ourinhos
// Gera 6 meses de histórico (estadias, viagens, manutenções e ocorrências) terminando hoje,
// então os números do painel sempre parecem "do dia".
//
// Uso pelo terminal: npm run seed (depois do npm run criar-banco, com o banco ainda vazio).
// Também é usado pelo botão "Carregar exemplos" da tela Colaboradores (só admin, banco vazio).
const db = require('./colunasUsuario');
const bcrypt = require('bcryptjs');
const auditoria = require('../services/Auditoria');

class CargaExemplos {
  constructor() {
    // Semente fixa: todo mundo do grupo gera exatamente os mesmos dados.
    this.semente = 20260501;
    this.msHora = 3600000;
    this.msDia = 24 * this.msHora;
    this.agora = Date.now();
    this.inicio = this.agora - 180 * this.msDia;
    this.futuro = this.agora + 3650 * this.msDia;
    this.ocupacao = {};

    this.obras = {
      vale: 'Residencial Vale do Aguapeí · Marília',
      rodovia: 'Duplicação SP-294 · Pompéia',
      assis: 'Centro de Distribuição · Assis',
      ourinhos: 'UBS Jardim Europa · Ourinhos',
      sede: 'Sede · Marília'
    };

    // [nome, matrícula, cargo, obra, CNH, dias até a CNH vencer (negativo = vencida)]
    this.equipe = [
      ['Ricardo Nogueira', 'AG-101', 'Engenheiro Civil Residente', 'vale', 'B', 820],
      ['Juliana Prado', 'AG-102', 'Técnica em Segurança do Trabalho', 'sede', 'B', 540],
      ['Sérgio Antunes', 'AG-103', 'Mestre de Obras', 'vale', 'B', 410],
      ['Paulo Henrique Lima', 'AG-104', 'Encarregado de Obra', 'rodovia', 'B,C', 380],
      ['Edson Carvalho', 'AG-105', 'Encarregado de Obra', 'assis', 'B', 15],
      ['Wellington Rocha', 'AG-106', 'Encarregado de Obra', 'ourinhos', 'B', 260],
      ['Adriano Batista', 'AG-107', 'Motorista de Van', 'rodovia', 'D', 22],
      ['Cláudio Mendes', 'AG-108', 'Motorista de Caminhão', 'rodovia', 'C,E', 700],
      ['Gilmar Teixeira', 'AG-109', 'Operador de Retroescavadeira', 'rodovia', 'B,C', 610],
      ['Renato Siqueira', 'AG-110', 'Topógrafo', 'rodovia', 'A,B', 900],
      ['Diego Fontana', 'AG-111', 'Eletricista Predial', 'vale', 'B', 470],
      ['Marcelo Araújo', 'AG-112', 'Encanador', 'vale', null, null],
      ['José Aparecido Silva', 'AG-113', 'Pedreiro', 'vale', null, null],
      ['Luiz Fernando Costa', 'AG-114', 'Pedreiro', 'assis', 'B', -40],
      ['Anderson Moraes', 'AG-115', 'Armador', 'assis', null, null],
      ['Rogério Barros', 'AG-116', 'Carpinteiro de Formas', 'assis', 'B', 330],
      ['Fábio Lourenço', 'AG-117', 'Soldador', 'assis', 'B', 200],
      ['Thiago Ribeiro', 'AG-118', 'Pintor', 'ourinhos', null, null],
      ['Everton Dias', 'AG-119', 'Azulejista', 'ourinhos', null, null],
      ['Rafael Gomes', 'AG-120', 'Servente', 'ourinhos', null, null],
      ['Leonardo Pires', 'AG-121', 'Servente', 'rodovia', null, null],
      ['Márcio Vieira', 'AG-122', 'Operador de Rolo Compactador', 'rodovia', 'C', 150],
      ['Daniel Ferraz', 'AG-123', 'Apontador de Obra', 'rodovia', 'B', 640],
      ['Samuel Correia', 'AG-124', 'Almoxarife', 'sede', 'B', 75],
      ['Vanessa Ramos', 'AG-125', 'Auxiliar Administrativa', 'sede', 'B', 1100],
      ['Gustavo Henrique Melo', 'AG-126', 'Estagiário de Engenharia', 'vale', 'B', 1300],
      ['Alexandre Tavares', 'AG-127', 'Pedreiro', 'rodovia', null, null],
      ['Cristiano Leite', 'AG-128', 'Eletricista de Força', 'assis', 'B', 480]
    ];

    // Alojamentos: [nome, cidade, bairro, rua, índice do responsável na equipe, quartos]
    // Quartos: [nome, área em m², camas] — "C" = cama, "B" = beliche (2 leitos).
    // As áreas respeitam a NR-24: 3 m² por cama e 4,5 m² por beliche.
    this.alojamentos = [
      ['República Centro', 'Marília', 'Centro', 'Rua São Luiz, 412', 2, [['Q1', 14, 'CCCC'], ['Q2', 12, 'BB']]],
      ['Alojamento Pompéia', 'Pompéia', 'Vila Nova', 'Rua Nove de Julho, 88', 3, [['Q1', 18, 'BBB'], ['Q2', 18, 'BBB'], ['Q3', 9, 'CCC']]],
      ['Alojamento Assis', 'Assis', 'Vila Operária', 'Rua Floriano Peixoto, 1290', 4, [['Q1', 16, 'BBC'], ['Q2', 14, 'BB']]],
      ['Alojamento Ourinhos', 'Ourinhos', 'Jardim Europa', 'Rua Paris, 57', 5, [['Q1', 12, 'CCCC']]]
    ];

    // Frota: [placa, modelo, lugares, CNH exigida, km inicial, dias até licenciamento, dias até seguro]
    this.frota = [
      ['RTA-4B21', 'Toyota Hilux CD', 5, 'B', 58200, 210, 140],
      ['RTA-7C05', 'Toyota Hilux CD', 5, 'B', 72400, 95, 18],
      ['FSX-2E48', 'Fiat Strada Endurance', 2, 'B', 31800, 280, 260],
      ['GKD-6H13', 'Fiat Toro Freedom', 5, 'B', 44100, 160, 120],
      ['QPL-3J90', 'Volkswagen Saveiro', 2, 'B', 66900, 60, 9],
      ['BCN-8F72', 'Volkswagen Gol', 5, 'B', 81200, 240, 200],
      ['MHG-5K34', 'Mercedes-Benz Sprinter 416', 16, 'D', 104800, 110, 70],
      ['DRS-1L66', 'Renault Master Minibus', 15, 'D', 93500, 45, 35],
      ['HVR-9M08', 'Volkswagen Delivery 11.180', 3, 'C', 128300, 190, 150],
      ['JTK-2N57', 'Ford Cargo 2429 Basculante', 2, 'C', 156700, 130, 100]
    ];

    this.destinos = [
      this.obras.vale,
      this.obras.rodovia,
      this.obras.assis,
      this.obras.ourinhos,
      'Almoxarifado Central · Marília',
      'Fornecedor de aço · Bauru',
      'Concreteira · Garça',
      'Posto Rodovia SP-294',
      'Sede · Marília'
    ];

    // Usuários do sistema (além do admin criado pelo criar-banco). Senha de todos: Aguapei@2026.
    this.usuarios = [
      ['Patrícia Moreira', 'patricia.moreira@construtora-aguapei.com.br', '14998214433', 'operador'],
      ['Rodrigo Albuquerque', 'rodrigo.albuquerque@construtora-aguapei.com.br', '14997302815', 'operador'],
      ['Helena Castro', 'helena.castro@construtora-aguapei.com.br', '14996127790', 'admin']
    ];
  }

  /* ===== sorteio com semente fixa (sempre os mesmos dados) ===== */

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

  /* ===== datas ===== */

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

  diasAtras(dias) {
    return this.formatarDataHora(this.agora - dias * this.msDia);
  }

  /* ===== agenda: ninguém fica em dois leitos ou dois carros ao mesmo tempo ===== */

  estaLivre(chave, ini, fim) {
    const lista = this.ocupacao[chave] || [];
    return lista.every((intervalo) => fim <= intervalo[0] || ini >= intervalo[1]);
  }

  marcarOcupado(chave, ini, fim) {
    if (!this.ocupacao[chave]) this.ocupacao[chave] = [];
    this.ocupacao[chave].push([ini, fim]);
  }

  cnhServePara(cnh, exigida) {
    const categorias = cnh.replace(/[^A-E]/g, '');
    if (exigida === 'B') return /[BCDE]/.test(categorias);
    if (exigida === 'C') return /[CDE]/.test(categorias);
    if (exigida === 'D') return /[DE]/.test(categorias);
    return categorias.indexOf(exigida) !== -1;
  }

  // CPF fictício, mas com os dígitos verificadores certos (passa na validação do cadastro).
  gerarCpf(base) {
    const numeros = String(base).padStart(9, '0').split('').map(Number);
    let soma = numeros.reduce((total, n, i) => total + n * (10 - i), 0);
    let resto = soma % 11;
    numeros.push(resto < 2 ? 0 : 11 - resto);
    soma = numeros.reduce((total, n, i) => total + n * (11 - i), 0);
    resto = soma % 11;
    numeros.push(resto < 2 ? 0 : 11 - resto);
    return numeros.join('');
  }

  /* ===== cada parte do cenário ===== */

  criarEquipe() {
    const inserir = db.prepare(
      'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    );
    return this.equipe.map((item, indice) => {
      // celulares do DDD 14 com números variados
      const telefone = '1499' + String(1000000 + ((indice * 7919 + 3251) % 9000000)).slice(0, 7);
      const resultado = inserir.run(
        item[0],
        item[1],
        item[2],
        this.obras[item[3]],
        telefone,
        item[4],
        item[5] === null ? null : this.dataEmDias(item[5])
      );
      return {
        id: Number(resultado.lastInsertRowid),
        nome: item[0],
        obra: item[3],
        cnh: item[4],
        validade: item[5]
      };
    });
  }

  criarAlojamentos(pessoas) {
    const inserirAloj = db.prepare(
      'INSERT INTO alojamento (nome, responsavel_id, cidade, rua, bairro, ativo) VALUES (?, ?, ?, ?, ?, 1)'
    );
    const inserirQuarto = db.prepare('INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)');
    const inserirLeito = db.prepare('INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)');

    const ids = [];
    const leitos = [];
    this.alojamentos.forEach((aloj) => {
      const alojId = Number(
        inserirAloj.run(aloj[0], pessoas[aloj[4]].id, aloj[1], aloj[3], aloj[2]).lastInsertRowid
      );
      ids.push(alojId);

      aloj[5].forEach((quarto) => {
        const quartoId = Number(inserirQuarto.run(alojId, quarto[0], quarto[1]).lastInsertRowid);
        let numero = 1;
        const criarLeito = (tipo) => {
          const codigo = quarto[0] + '-' + this.doisDigitos(numero++);
          const leitoId = Number(inserirLeito.run(quartoId, codigo, tipo).lastInsertRowid);
          leitos.push({ id: leitoId, aloj: alojId });
        };
        quarto[2].split('').forEach((letra) => {
          if (letra === 'C') {
            criarLeito('cama');
          } else {
            criarLeito('beliche_baixo');
            criarLeito('beliche_cima');
          }
        });
      });
    });
    return { ids: ids, leitos: leitos };
  }

  // Cada alojamento recebe primeiro quem trabalha na obra da mesma cidade.
  criarEstadias(pessoas, alojIds, leitos) {
    const obraDoAlojamento = {};
    ['vale', 'rodovia', 'assis', 'ourinhos'].forEach((obra, i) => {
      obraDoAlojamento[alojIds[i]] = obra;
    });
    const inserir = db.prepare('INSERT INTO estadia (pessoa_id, leito_id, inicio, fim) VALUES (?, ?, ?, ?)');
    const ultimoFim = {};
    const ultimaSaidaDaPessoa = {};

    const candidatosPara = (leito, ini, fim) => {
      const daObra = pessoas.filter(
        (p) => p.obra === obraDoAlojamento[leito.aloj] && this.estaLivre('e' + p.id, ini, fim)
      );
      if (daObra.length > 0) return daObra;
      return pessoas.filter((p) => p.obra !== 'sede' && this.estaLivre('e' + p.id, ini, fim));
    };

    // estadias que já terminaram
    leitos.forEach((leito) => {
      let tempo = this.inicio + this.entre(0, 20) * this.msDia;
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        const fim = tempo + this.entre(15, 60) * this.msDia;
        if (fim > this.agora - 5 * this.msDia) break;
        const candidatos = candidatosPara(leito, tempo, fim);
        if (candidatos.length === 0) break;
        const escolhido = this.escolherDaLista(candidatos);
        this.marcarOcupado('e' + escolhido.id, tempo, fim);
        inserir.run(escolhido.id, leito.id, this.formatarDataHora(tempo), this.formatarDataHora(fim));
        ultimoFim[leito.id] = fim;
        ultimaSaidaDaPessoa[escolhido.id] = Math.max(ultimaSaidaDaPessoa[escolhido.id] || 0, fim);
        tempo = fim + this.entre(0, 10) * this.msDia;
      }
    });

    // quem está alojado hoje: só gente da obra daquele alojamento (senão o maior "puxa" todo mundo).
    // A pessoa só entra depois de sair do último leito e do último dono do leito.
    let ocupadosAgora = 0;
    leitos.forEach((leito) => {
      if (this.sortearNumero() > 0.85) return;
      const daObra = pessoas.filter(
        (p) => p.obra === obraDoAlojamento[leito.aloj] && this.estaLivre('e' + p.id, this.agora - this.msDia, this.futuro)
      );
      if (daObra.length === 0) return;
      const escolhido = this.escolherDaLista(daObra);
      const podeEntrar = Math.max(ultimoFim[leito.id] || this.inicio, ultimaSaidaDaPessoa[escolhido.id] || this.inicio);
      const ini = Math.min(podeEntrar + this.entre(1, 5) * this.msDia, this.agora - 2 * this.msDia);
      if (ini <= podeEntrar || !this.estaLivre('e' + escolhido.id, ini, this.futuro)) return;
      this.marcarOcupado('e' + escolhido.id, ini, this.futuro);
      inserir.run(escolhido.id, leito.id, this.formatarDataHora(ini), null);
      ocupadosAgora++;
    });
    return ocupadosAgora;
  }

  criarOcorrencias(pessoas, alojIds) {
    const inserir = db.prepare(
      'INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em, resolvida_em, solucao) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    // [alojamento, pessoa envolvida, tipo, descrição, aberta há (dias), resolvida há (dias), solução]
    const lista = [
      [0, null, 'manutencao', 'Chuveiro do banheiro social sem aquecimento', 150, 149, 'Resistência trocada'],
      [1, 20, 'reclamacao', 'Barulho depois das 22h no Q2', 120, 118, 'Conversa com os envolvidos e reforço das regras da casa'],
      [2, null, 'manutencao', 'Vazamento na torneira da cozinha', 95, 94, 'Vedação trocada'],
      [1, 8, 'conflito', 'Discussão por causa do uso da máquina de lavar', 70, 69, 'Escala de uso combinada com o encarregado'],
      [3, null, 'manutencao', 'Ventilador de teto do Q1 parou', 48, 46, 'Motor do ventilador substituído'],
      [2, 15, 'regra', 'Entrada de visitante após as 22h sem aviso', 33, 32, 'Advertência verbal e registro'],
      [0, null, 'outro', 'Pedido de mais um armário no Q2', 20, 12, 'Armário de aço instalado'],
      [1, null, 'manutencao', 'Janela do Q1 não fecha direito', 9, null, null],
      [2, null, 'manutencao', 'Fiação exposta perto do tanque', 2, null, null]
    ];
    lista.forEach((o) => {
      inserir.run(
        alojIds[o[0]],
        o[1] === null ? null : pessoas[o[1]].id,
        o[2],
        o[3],
        this.diasAtras(o[4]),
        o[5] === null ? null : this.diasAtras(o[5]),
        o[6]
      );
    });
    return lista.length;
  }

  criarFrota() {
    const inserir = db.prepare(
      'INSERT INTO veiculo (placa, modelo, lugares, categoria_cnh_exigida, km_inicial, licenciamento_validade, seguro_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    );
    return this.frota.map((v) => {
      const id = Number(
        inserir.run(v[0], v[1], v[2], v[3], v[4], this.dataEmDias(v[5]), this.dataEmDias(v[6])).lastInsertRowid
      );
      return { id: id, modelo: v[1], lugares: v[2], cat: v[3], km: v[4] };
    });
  }

  criarViagens(pessoas, veiculos) {
    const inserirUso = db.prepare(
      'INSERT INTO uso_veiculo (veiculo_id, motorista_id, destino, saida, retorno, km_saida, km_retorno) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const inserirPassageiro = db.prepare('INSERT INTO uso_passageiro (uso_veiculo_id, pessoa_id) VALUES (?, ?)');
    const motoristas = pessoas.filter((p) => p.cnh);
    let total = 0;

    veiculos.forEach((veiculo, indice) => {
      let tempo = this.inicio + this.entre(0, 5) * this.msDia;
      let km = veiculo.km;
      let viagensDoVeiculo = 0;

      while (tempo < this.agora - 2 * this.msDia) {
        const fim = tempo + this.entre(2, 30) * this.msHora;
        if (fim > this.agora - this.msDia) break;

        // só dirige quem tem a categoria certa e estava com a CNH válida na data
        const aptos = motoristas.filter((p) => {
          const cnhValidaNaData =
            p.validade === null || this.formatarDataHora(fim).slice(0, 10) <= this.dataEmDias(p.validade);
          return this.cnhServePara(p.cnh, veiculo.cat) && cnhValidaNaData && this.estaLivre('v' + p.id, tempo, fim);
        });
        if (aptos.length === 0) {
          tempo = fim + this.msDia;
          continue;
        }

        const motorista = this.escolherDaLista(aptos);
        // a Saveiro tem 38 km rodados sem anotação numa viagem, para o alerta de quilometragem aparecer
        const kmSaida = km + (indice === 4 && viagensDoVeiculo === 5 ? 38 : 0);
        const kmVolta = kmSaida + this.entre(20, 380);
        this.marcarOcupado('v' + motorista.id, tempo, fim);

        const usoId = Number(
          inserirUso.run(
            veiculo.id,
            motorista.id,
            this.escolherDaLista(this.destinos),
            this.formatarDataHora(tempo),
            this.formatarDataHora(fim),
            kmSaida,
            kmVolta
          ).lastInsertRowid
        );

        const quantosPassageiros = Math.min(veiculo.lugares - 1, this.entre(0, veiculo.lugares > 5 ? 8 : 3));
        const jaNoCarro = {};
        for (let i = 0; i < quantosPassageiros; i++) {
          const livres = pessoas.filter(
            (p) => p.id !== motorista.id && !jaNoCarro[p.id] && this.estaLivre('v' + p.id, tempo, fim)
          );
          if (livres.length === 0) break;
          const passageiro = this.escolherDaLista(livres);
          jaNoCarro[passageiro.id] = true;
          this.marcarOcupado('v' + passageiro.id, tempo, fim);
          inserirPassageiro.run(usoId, passageiro.id);
        }

        km = kmVolta;
        viagensDoVeiculo++;
        total++;
        tempo = fim + this.entre(0, 4) * this.msDia + this.entre(1, 12) * this.msHora;
      }
      veiculo.km = km;
    });

    // Três veículos na rua agora: dois dentro do prazo e a Sprinter atrasada (para o alerta aparecer).
    const saidaAgora = (veiculo, horas, motoristaIdx, destino, passageirosIdx) => {
      const tempo = this.agora - horas * this.msHora;
      const motorista = pessoas[motoristaIdx];
      if (!this.estaLivre('v' + motorista.id, tempo, this.futuro)) return;
      const usoId = Number(
        inserirUso.run(veiculo.id, motorista.id, destino, this.formatarDataHora(tempo), null, veiculo.km, null)
          .lastInsertRowid
      );
      this.marcarOcupado('v' + motorista.id, tempo, this.futuro);
      passageirosIdx.forEach((idx) => {
        if (!this.estaLivre('v' + pessoas[idx].id, tempo, this.futuro)) return;
        inserirPassageiro.run(usoId, pessoas[idx].id);
        this.marcarOcupado('v' + pessoas[idx].id, tempo, this.futuro);
      });
      total++;
    };
    saidaAgora(veiculos[0], 3, 0, this.obras.vale, [25]);
    saidaAgora(veiculos[3], 5, 3, this.obras.rodovia, [9, 22]);
    saidaAgora(veiculos[6], 20, 6, this.obras.rodovia, [20, 26]);
    return total;
  }

  criarManutencoes(veiculos) {
    const inserir = db.prepare(
      'INSERT INTO manutencao (veiculo_id, tipo, descricao, inicio, fim, km) VALUES (?, ?, ?, ?, ?, ?)'
    );
    // [veículo, tipo, descrição, começou há (dias), terminou há (dias ou null = ainda na oficina)]
    const lista = [
      [0, 'preventiva', 'Revisão dos 60 mil km', 140, 139],
      [1, 'corretiva', 'Troca de pastilhas e discos de freio', 100, 98],
      [6, 'preventiva', 'Troca de óleo, filtros e correia', 75, 74],
      [8, 'corretiva', 'Reparo no sistema de embreagem', 52, 47],
      [9, 'preventiva', 'Revisão do basculante e lubrificação', 30, 29],
      [5, 'corretiva', 'Alternador com defeito', 25, 22],
      [7, 'corretiva', 'Troca do kit de suspensão dianteira', 8, null]
    ];
    lista.forEach((m) => {
      inserir.run(
        veiculos[m[0]].id,
        m[1],
        m[2],
        this.diasAtras(m[3]),
        m[4] === null ? null : this.diasAtras(m[4]),
        veiculos[m[0]].km
      );
    });
    return lista.length;
  }

  criarUsuarios() {
    const senhaHash = bcrypt.hashSync('Aguapei@2026', 10);
    const inserir = db.prepare(
      'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo, email, documento, telefone) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
    );
    let criados = 0;
    this.usuarios.forEach((u, i) => {
      const login = u[1].split('@')[0];
      const jaExiste = db.prepare('SELECT 1 FROM usuario WHERE login = ? OR email = ?').get(login, u[1]);
      if (jaExiste) return;
      inserir.run(u[0], login, senhaHash, u[3], u[1], this.gerarCpf(318475620 + i * 1371), u[2]);
      criados++;
    });
    // O admin do criar-banco também ganha e-mail, para entrar pelo e-mail na apresentação.
    db.prepare(
      "UPDATE usuario SET email = 'administracao@construtora-aguapei.com.br' WHERE login = 'admin' AND email IS NULL"
    ).run();
    return criados;
  }

  /* ===== carga completa ===== */

  // Carrega tudo numa transação e devolve um resumo. Dá erro (sem gravar nada) se o banco já tiver colaboradores.
  carregar() {
    if (db.prepare('SELECT COUNT(*) AS n FROM pessoa').get().n > 0) {
      throw new Error('O banco já possui colaboradores cadastrados.');
    }
    const admin = db.prepare("SELECT id FROM usuario WHERE perfil = 'admin' ORDER BY id LIMIT 1").get();
    if (!admin) {
      throw new Error('Rode "npm run criar-banco" antes (precisa do usuário administrador).');
    }

    // Transação: se algo falhar no meio, nada fica gravado pela metade.
    db.exec('BEGIN');
    try {
      const pessoas = this.criarEquipe();
      const alojamentos = this.criarAlojamentos(pessoas);
      const alojadosAgora = this.criarEstadias(pessoas, alojamentos.ids, alojamentos.leitos);
      const ocorrencias = this.criarOcorrencias(pessoas, alojamentos.ids);
      const veiculos = this.criarFrota();
      const viagens = this.criarViagens(pessoas, veiculos);
      const manutencoes = this.criarManutencoes(veiculos);
      const usuarios = this.criarUsuarios();

      const resumo = {
        colaboradores: pessoas.length,
        alojamentos: alojamentos.ids.length,
        leitos: alojamentos.leitos.length,
        alojadosAgora: alojadosAgora,
        ocorrencias: ocorrencias,
        veiculos: veiculos.length,
        viagens: viagens,
        manutencoes: manutencoes,
        usuarios: usuarios
      };

      auditoria.registrarLog({
        usuarioId: admin.id,
        acao: 'criou',
        tabela: 'pessoa',
        registroId: pessoas[0].id,
        resumo:
          'Carregou os dados de demonstração da Construtora Aguapeí: ' +
          resumo.colaboradores +
          ' colaboradores, ' +
          resumo.alojamentos +
          ' alojamentos, ' +
          resumo.veiculos +
          ' veículos e 6 meses de histórico'
      });

      db.exec('COMMIT');
      return resumo;
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  }

  // Versão para o terminal (npm run seed): mostra o resumo ou o erro.
  executar() {
    try {
      const r = this.carregar();
      console.log('Dados da Construtora Aguapeí carregados:');
      console.log(
        '- ' + r.colaboradores + ' colaboradores, ' + r.alojamentos + ' alojamentos, ' + r.leitos +
          ' leitos (' + r.alojadosAgora + ' ocupados agora), ' + r.ocorrencias + ' ocorrências'
      );
      console.log('- ' + r.veiculos + ' veículos, ' + r.viagens + ' viagens, ' + r.manutencoes + ' manutenções');
      console.log('- ' + r.usuarios + ' usuários extras (senha Aguapei@2026)');
    } catch (erro) {
      console.log('Não foi possível carregar os dados: ' + erro.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  new CargaExemplos().executar();
}

module.exports = CargaExemplos;
