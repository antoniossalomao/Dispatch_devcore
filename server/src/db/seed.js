// carrega dados de exemplo da Construtora Aguapei: 15 colaboradores, 3 alojamentos, 6 veiculos e 6 meses de historico
// uso: npm run seed (depois do criar-banco). so roda se o banco ainda nao tem colaboradores
const db = require('./conexao')
const auditoria = require('../regras/auditoria')

if (db.prepare('SELECT COUNT(*) AS n FROM pessoa').get().n > 0) {
  console.log('O banco já tem colaboradores. Apague o arquivo do banco e rode "npm run criar-banco" antes do seed.')
  process.exit(1)
}

const admin = db.prepare("SELECT id FROM usuario WHERE perfil = 'admin' ORDER BY id LIMIT 1").get()
if (!admin) {
  console.log('Rode "npm run criar-banco" antes (precisa do usuário administrador).')
  process.exit(1)
}

// gerador pseudo-aleatorio com semente fixa: todo mundo do grupo fica com os mesmos dados
let semente = 20260501
function rand() {
  semente = (semente * 1664525 + 1013904223) % 4294967296
  return semente / 4294967296
}
function entre(a, b) { return a + Math.floor(rand() * (b - a + 1)) }
function sorteia(lista) { return lista[Math.floor(rand() * lista.length)] }

const MS_H = 3600000
const MS_D = 24 * MS_H
const AGORA = Date.now()
const INICIO = AGORA - 180 * MS_D

function dois(n) { return n < 10 ? '0' + n : String(n) }
function fmt(ms) {
  const d = new Date(ms)
  return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()) + ' ' + dois(d.getHours()) + ':' + dois(d.getMinutes()) + ':00'
}
function dataEm(dias) { return fmt(AGORA + dias * MS_D).slice(0, 10) }

// controla os intervalos ocupados de cada pessoa (nao pode estar em dois lugares ao mesmo tempo)
const ocupacao = {}
function livre(chave, ini, fim) {
  const lista = ocupacao[chave] || []
  return lista.every(function (i) { return fim <= i[0] || ini >= i[1] })
}
function ocupa(chave, ini, fim) {
  if (!ocupacao[chave]) ocupacao[chave] = []
  ocupacao[chave].push([ini, fim])
}
const FUTURO = AGORA + 3650 * MS_D

db.exec('BEGIN')
try {
  // ---- colaboradores ----
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
  ]
  const inserirPessoa = db.prepare(
    'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  )
  const pessoas = equipe.map(function (e, i) {
    const r = inserirPessoa.run(e[0], e[1], e[2], e[3], '149912300' + dois(i + 1), e[4], e[5] === null ? null : dataEm(e[5]))
    return { id: Number(r.lastInsertRowid), nome: e[0], cnh: e[4], validade: e[5] }
  })
  // pra historia ser coerente, so dirige quem tinha CNH valida (Guilherme tem CNH vencida hoje, mas dirigia ha meses)
  const motoristas = pessoas.filter(function (p) { return p.cnh })

  // ---- alojamentos, quartos e leitos ----
  const inserirAloj = db.prepare('INSERT INTO alojamento (nome, responsavel_id, cidade, bairro, ativo) VALUES (?, ?, ?, ?, 1)')
  const inserirQuarto = db.prepare('INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)')
  const inserirLeito = db.prepare('INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)')
  const plano = [
    { nome: 'República Centro', cidade: 'Marília', bairro: 'Centro', resp: 2, quartos: [['Q1', 14, 'BB C'], ['Q2', 14, 'CCCC']] },
    { nome: 'Alojamento Obra Norte', cidade: 'Assis', bairro: 'Vila Operária', resp: 4, quartos: [['Q1', 16, 'BBB'], ['Q2', 8, 'CC']] },
    { nome: 'Alojamento Sul', cidade: 'Ourinhos', bairro: 'Jardim Europa', resp: 14, quartos: [['Q1', 16, 'BB CC']] }
  ]
  const leitos = []
  const alojamentoIds = []
  plano.forEach(function (a) {
    const aid = Number(inserirAloj.run(a.nome, pessoas[a.resp].id, a.cidade, a.bairro).lastInsertRowid)
    alojamentoIds.push(aid)
    a.quartos.forEach(function (q) {
      const qid = Number(inserirQuarto.run(aid, q[0], q[1]).lastInsertRowid)
      let n = 1
      q[2].replace(/ /g, '').split('').forEach(function (t) {
        function novo(tipo) {
          const codigo = q[0] + '-' + dois(n++)
          const lid = Number(inserirLeito.run(qid, codigo, tipo).lastInsertRowid)
          leitos.push({ id: lid, aloj: aid })
        }
        if (t === 'C') novo('cama')
        else { novo('beliche_baixo'); novo('beliche_cima') }
      })
    })
  })

  // ---- estadias: 6 meses de historico + quem esta alojado agora ----
  // ordem aleatoria dos leitos pra ocupacao nao ficar concentrada no primeiro alojamento
  const leitosEmbaralhados = leitos.slice().sort(function () { return rand() - 0.5 })
  const inserirEstadia = db.prepare('INSERT INTO estadia (pessoa_id, leito_id, inicio, fim) VALUES (?, ?, ?, ?)')
  const ultimoFimDoLeito = {}
  leitosEmbaralhados.forEach(function (l) {
    let t = INICIO + entre(0, 20) * MS_D
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const dur = entre(15, 60) * MS_D
      const fim = t + dur
      if (fim > AGORA - 5 * MS_D) break
      const candidatos = pessoas.filter(function (p) { return livre('e' + p.id, t, fim) })
      if (candidatos.length === 0) break
      const p = sorteia(candidatos)
      ocupa('e' + p.id, t, fim)
      inserirEstadia.run(p.id, l.id, fmt(t), fmt(fim))
      ultimoFimDoLeito[l.id] = fim
      t = fim + entre(0, 10) * MS_D
    }
  })
  let alojadosAgora = 0
  leitosEmbaralhados.forEach(function (l) {
    if (rand() > 0.6) return
    const ini = (ultimoFimDoLeito[l.id] || INICIO) + entre(1, 5) * MS_D
    if (ini > AGORA - MS_D) return
    const candidatos = pessoas.filter(function (p) { return livre('e' + p.id, ini, FUTURO) })
    if (candidatos.length === 0) return
    const p = sorteia(candidatos)
    ocupa('e' + p.id, ini, FUTURO)
    inserirEstadia.run(p.id, l.id, fmt(ini), null)
    alojadosAgora++
  })

  // ---- ocorrencias ----
  const inserirOcor = db.prepare('INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em, resolvida_em, solucao) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const ocorrencias = [
    [0, null, 'manutencao', 'Chuveiro do banheiro 1 sem aquecimento', -120, -118, 'Resistência trocada'],
    [1, 2, 'reclamacao', 'Barulho depois das 22h no Q2', -90, -88, 'Conversa com os envolvidos e aviso das regras da casa'],
    [2, null, 'manutencao', 'Vazamento na torneira da cozinha', -60, -59, 'Vedação trocada'],
    [0, 12, 'conflito', 'Discussão por causa de uso do fogão', -30, -29, 'Escala de uso da cozinha combinada'],
    [1, null, 'manutencao', 'Janela do Q1 não fecha', -12, null, null],
    [2, null, 'regra', 'Visitante dormiu sem aviso ao responsável', -1, null, null]
  ]
  ocorrencias.forEach(function (o) {
    inserirOcor.run(alojamentoIds[o[0]], o[1] === null ? null : pessoas[o[1]].id, o[2], o[3],
      fmt(AGORA + o[4] * MS_D), o[5] === null ? null : fmt(AGORA + o[5] * MS_D), o[6])
  })

  // ---- frota ----
  const inserirVeic = db.prepare(
    'INSERT INTO veiculo (placa, modelo, lugares, categoria_cnh_exigida, km_inicial, licenciamento_validade, seguro_validade, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  )
  const frota = [
    ['ABC-1D23', 'Toyota Corolla', 5, 'B', 41200, 200, 150],
    ['DEF-5678', 'Toyota Hilux', 5, 'B', 63800, 120, 25],
    ['GHI-9012', 'Fiat Strada', 3, 'B', 28900, 300, 280],
    ['JKL-3456', 'Mercedes Sprinter', 15, 'D', 97400, 90, 60],
    ['MNO-7890', 'VW Saveiro', 2, 'B', 55100, 60, 8],
    ['PQR-1A23', 'VW Gol', 5, 'B', 74300, 240, 210]
  ].map(function (v) {
    const id = Number(inserirVeic.run(v[0], v[1], v[2], v[3], v[4], dataEm(v[5]), dataEm(v[6])).lastInsertRowid)
    return { id: id, modelo: v[1], lugares: v[2], cat: v[3], km: v[4] }
  })

  function categoriaOk(cnh, exigida) {
    const t = cnh.replace(/[^A-E]/g, '')
    if (exigida === 'B') return /[BCDE]/.test(t)
    if (exigida === 'D') return /[DE]/.test(t)
    return t.indexOf(exigida) !== -1
  }

  const inserirUso = db.prepare('INSERT INTO uso_veiculo (veiculo_id, motorista_id, destino, saida, retorno, km_saida, km_retorno) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const inserirPass = db.prepare('INSERT INTO uso_passageiro (uso_veiculo_id, pessoa_id) VALUES (?, ?)')
  const destinos = ['Obra Marília Norte', 'Obra Assis Sul', 'Obra Rodovia SP-294', 'Fornecedor em Bauru', 'Almoxarifado Central', 'Posto de combustível', 'Obra Ourinhos', 'Escritório Marília']
  const manutencoes = []
  const inserirManut = db.prepare('INSERT INTO manutencao (veiculo_id, tipo, descricao, inicio, fim, km) VALUES (?, ?, ?, ?, ?, ?)')
  let totalUsos = 0

  frota.forEach(function (v, idx) {
    let t = INICIO + entre(0, 5) * MS_D
    let km = v.km
    let usosDoVeiculo = 0
    while (t < AGORA - 2 * MS_D) {
      const dur = entre(2, 30) * MS_H
      const fim = t + dur
      if (fim > AGORA - MS_D) break
      const aptos = motoristas.filter(function (p) {
        const validoNaData = p.validade === null || fmt(fim).slice(0, 10) <= dataEm(p.validade) || p.validade < 0
        return categoriaOk(p.cnh, v.cat) && validoNaData && livre('v' + p.id, t, fim)
      })
      if (aptos.length === 0) { t = fim + MS_D; continue }
      const m = sorteia(aptos)
      const kmSaida = km + (idx === 4 && usosDoVeiculo === 5 ? 38 : 0) // Saveiro: 38 km rodados sem registro (aviso da regra F10)
      const kmVolta = kmSaida + entre(20, 400)
      ocupa('v' + m.id, t, fim)
      const uid = Number(inserirUso.run(v.id, m.id, sorteia(destinos), fmt(t), fmt(fim), kmSaida, kmVolta).lastInsertRowid)
      const quantos = Math.min(v.lugares - 1, entre(0, 3))
      const usados = {}
      for (let i = 0; i < quantos; i++) {
        const cand = pessoas.filter(function (p) { return p.id !== m.id && !usados[p.id] && livre('v' + p.id, t, fim) })
        if (cand.length === 0) break
        const p = sorteia(cand)
        usados[p.id] = true
        ocupa('v' + p.id, t, fim)
        inserirPass.run(uid, p.id)
      }
      km = kmVolta
      usosDoVeiculo++
      totalUsos++
      t = fim + entre(0, 4) * MS_D + entre(1, 12) * MS_H
    }
    v.km = km
  })

  // manutencoes antigas (concluidas)
  manutencoes.push([0, 'preventiva', 'Revisão dos 40 mil km', -100, -99], [1, 'corretiva', 'Troca de pastilhas de freio', -70, -68],
    [3, 'preventiva', 'Troca de óleo e filtros', -45, -44], [5, 'corretiva', 'Alternador', -20, -17])
  manutencoes.forEach(function (m) {
    inserirManut.run(frota[m[0]].id, m[1], m[2], fmt(AGORA + m[3] * MS_D), fmt(AGORA + m[4] * MS_D), frota[m[0]].km)
  })
  // Gol esta na oficina ha 9 dias (aparece em gargalos)
  inserirManut.run(frota[5].id, 'corretiva', 'Troca do kit de embreagem', fmt(AGORA - 9 * MS_D), null, frota[5].km)

  // dois carros na rua agora (Hilux ha 3h e Sprinter ha 20h, essa passou do prazo de devolucao)
  function saidaAgora(v, horas, motoristaIdx, destino, passageiros) {
    const t = AGORA - horas * MS_H
    const m = pessoas[motoristaIdx]
    const uid = Number(inserirUso.run(v.id, m.id, destino, fmt(t), null, v.km, null).lastInsertRowid)
    ocupa('v' + m.id, t, FUTURO)
    passageiros.forEach(function (i) { inserirPass.run(uid, pessoas[i].id); ocupa('v' + pessoas[i].id, t, FUTURO) })
  }
  const livresAgora = function (idx) { return livre('v' + pessoas[idx].id, AGORA - 24 * MS_H, FUTURO) }
  if (livresAgora(1)) saidaAgora(frota[1], 3, 1, 'Obra Rodovia SP-294', [])
  if (livresAgora(5)) saidaAgora(frota[3], 20, 5, 'Obra Assis Sul', livresAgora(3) ? [3] : [])

  // ---- auditoria: resumo do que foi carregado ----
  auditoria.registrarLog({ usuarioId: admin.id, acao: 'criou', tabela: 'pessoa', registroId: 1, resumo: 'Carregou 15 colaboradores de demonstração (Construtora Aguapeí)' })
  auditoria.registrarLog({ usuarioId: admin.id, acao: 'criou', tabela: 'alojamento', registroId: 1, resumo: 'Carregou 3 alojamentos com ' + leitos.length + ' leitos e histórico de estadias' })
  auditoria.registrarLog({ usuarioId: admin.id, acao: 'criou', tabela: 'veiculo', registroId: 1, resumo: 'Carregou 6 veículos com ' + totalUsos + ' usos e manutenções' })

  db.exec('COMMIT')
  console.log('Dados de exemplo carregados:')
  console.log('- ' + pessoas.length + ' colaboradores, ' + alojamentoIds.length + ' alojamentos, ' + leitos.length + ' leitos (' + alojadosAgora + ' ocupados agora)')
  console.log('- ' + frota.length + ' veículos, ' + totalUsos + ' usos, ' + ocorrencias.length + ' ocorrências')
} catch (erro) {
  db.exec('ROLLBACK')
  console.log('Deu erro no seed: ' + erro.message)
  process.exit(1)
}
