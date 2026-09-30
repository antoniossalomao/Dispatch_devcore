-- tabelas do banco do Dispatch (SQLite)
-- quem cria o banco é o criar-banco.js, que lê esse arquivo e roda tudo
--
-- umas regras que a gente combinou:
-- - datas ficam em texto no formato 'AAAA-MM-DD HH:MM' (ex: '2026-10-05 07:30')
-- - fim/retorno vazio (NULL) = ainda está acontecendo (a pessoa ainda ta no leito, o carro ainda não voltou)
-- - nada é apagado de verdade, só marca ativo = 0
-- - no sqlite não existe true/false, então usa 1 e 0


-- quem usa o sistema (faz login)
CREATE TABLE IF NOT EXISTS usuario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    login       TEXT NOT NULL UNIQUE,
    senha_hash  TEXT NOT NULL, -- a senha nunca é salva pura, só o hash (bcrypt)
    perfil      TEXT NOT NULL CHECK (perfil IN ('admin', 'operador')), -- admin ve tudo, operador não ve auditoria nem configurações
    telefone    TEXT, -- pro whatsapp
    ativo       INTEGER NOT NULL DEFAULT 1
);

-- os colaboradores da empresa
CREATE TABLE IF NOT EXISTS pessoa (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    matricula       TEXT NOT NULL UNIQUE,
    cargo           TEXT NOT NULL,
    obra            TEXT,
    telefone        TEXT,
    cnh_categorias  TEXT, -- ex: 'B' ou 'B,D'. vazio = não tem cnh
    cnh_validade    TEXT, -- data que a cnh vence
    ativo           INTEGER NOT NULL DEFAULT 1
);


-- ===== alojamento =====

CREATE TABLE IF NOT EXISTS alojamento (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    responsavel_id  INTEGER REFERENCES pessoa(id), -- colaborador responsável pelo alojamento
    cidade          TEXT NOT NULL,
    cep             TEXT,
    rua             TEXT,
    numero          TEXT,
    bairro          TEXT,
    observacoes     TEXT,
    ativo           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quarto (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    alojamento_id  INTEGER NOT NULL REFERENCES alojamento(id),
    nome           TEXT NOT NULL,
    area_m2        REAL NOT NULL CHECK (area_m2 > 0) -- precisa da área pra conferir a NR-24
);

-- cada cama é um leito. é por leito que dá pra saber a ocupação
CREATE TABLE IF NOT EXISTS leito (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    quarto_id  INTEGER NOT NULL REFERENCES quarto(id),
    codigo     TEXT NOT NULL, -- ex: 'Q1-01'
    tipo       TEXT NOT NULL CHECK (tipo IN ('cama', 'beliche_baixo', 'beliche_cima')),
    UNIQUE (quarto_id, codigo) -- não pode repetir o código no mesmo quarto
);

-- quem ficou em qual leito e de quando até quando
CREATE TABLE IF NOT EXISTS estadia (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id  INTEGER NOT NULL REFERENCES pessoa(id),
    leito_id   INTEGER NOT NULL REFERENCES leito(id),
    inicio     TEXT NOT NULL,
    fim        TEXT,
    CHECK (fim IS NULL OR fim > inicio) -- a saída tem que ser depois da entrada
);

-- problemas que acontecem no alojamento (chuveiro quebrado, briga, reclamação...)
CREATE TABLE IF NOT EXISTS ocorrencia (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    alojamento_id  INTEGER NOT NULL REFERENCES alojamento(id),
    pessoa_id      INTEGER REFERENCES pessoa(id), -- opcional, se tiver alguém envolvido
    tipo           TEXT NOT NULL CHECK (tipo IN ('manutencao', 'conflito', 'reclamacao', 'regra', 'outro')),
    descricao      TEXT NOT NULL,
    aberta_em      TEXT NOT NULL,
    resolvida_em   TEXT, -- vazio = ainda aberta
    solucao        TEXT,
    CHECK (resolvida_em IS NULL OR resolvida_em > aberta_em)
);


-- ===== frota =====

CREATE TABLE IF NOT EXISTS veiculo (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    placa                  TEXT NOT NULL UNIQUE,
    modelo                 TEXT NOT NULL,
    lugares                INTEGER NOT NULL CHECK (lugares > 0), -- contando o motorista
    categoria_cnh_exigida  TEXT NOT NULL CHECK (categoria_cnh_exigida IN ('A', 'B', 'C', 'D', 'E')),
    km_inicial             INTEGER NOT NULL DEFAULT 0, -- km que o carro tinha quando foi cadastrado
    licenciamento_validade TEXT,
    seguro_validade        TEXT,
    ativo                  INTEGER NOT NULL DEFAULT 1
);
-- obs: o status (disponível / em uso / manutenção) não fica salvo aqui,
-- ele é calculado olhando se tem uso ou manutenção em aberto

-- cada vez que alguém sai com um veículo
CREATE TABLE IF NOT EXISTS uso_veiculo (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo_id    INTEGER NOT NULL REFERENCES veiculo(id),
    motorista_id  INTEGER NOT NULL REFERENCES pessoa(id),
    destino       TEXT NOT NULL,
    saida         TEXT NOT NULL,
    retorno       TEXT, -- vazio = o carro ainda não voltou
    km_saida      INTEGER NOT NULL,
    km_retorno    INTEGER,
    CHECK (retorno IS NULL OR retorno > saida),
    CHECK (km_retorno IS NULL OR km_retorno >= km_saida) -- km não pode diminuir
);

-- quem foi de passageiro em cada uso
CREATE TABLE IF NOT EXISTS uso_passageiro (
    uso_veiculo_id  INTEGER NOT NULL REFERENCES uso_veiculo(id),
    pessoa_id       INTEGER NOT NULL REFERENCES pessoa(id),
    PRIMARY KEY (uso_veiculo_id, pessoa_id) -- a mesma pessoa não entra 2x no mesmo uso
);

CREATE TABLE IF NOT EXISTS manutencao (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo_id  INTEGER NOT NULL REFERENCES veiculo(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('preventiva', 'corretiva')),
    descricao   TEXT NOT NULL,
    inicio      TEXT NOT NULL,
    fim         TEXT, -- vazio = o carro ainda ta na oficina
    km          INTEGER,
    CHECK (fim IS NULL OR fim > inicio)
);


-- ===== auditoria e avisos =====

-- toda alteração no sistema vira uma linha aqui. essa tabela só recebe INSERT, nunca UPDATE ou DELETE
CREATE TABLE IF NOT EXISTS log_auditoria (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    quando         TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    usuario_id     INTEGER NOT NULL REFERENCES usuario(id), -- quem fez
    acao           TEXT NOT NULL CHECK (acao IN ('criou', 'alterou', 'arquivou')),
    tabela         TEXT NOT NULL, -- em qual tabela mexeu
    registro_id    INTEGER NOT NULL, -- qual linha
    resumo         TEXT NOT NULL, -- ex: 'Registrou saída do Gol ABC-1234'
    antes_json     TEXT, -- como estava antes (vazio quando é criação)
    depois_json    TEXT, -- como ficou depois
    hash_anterior  TEXT NOT NULL, -- hash da linha anterior do log
    hash           TEXT NOT NULL  -- se alguém mexer no banco por fora, o hash não bate mais
);

-- avisos que aparecem no sininho (e alguns vão pro whatsapp)
CREATE TABLE IF NOT EXISTS notificacao (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo              TEXT NOT NULL, -- ex: 'cnh_vencendo', 'km_sem_registro'
    severidade        TEXT NOT NULL CHECK (severidade IN ('atencao', 'critico')),
    mensagem          TEXT NOT NULL,
    tabela            TEXT, -- a que o aviso se refere (ex: 'veiculo')
    registro_id       INTEGER,
    criada_em         TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    lida              INTEGER NOT NULL DEFAULT 0,
    enviada_whatsapp  INTEGER NOT NULL DEFAULT 0
);


-- ===== índices =====
-- deixam as buscas mais rápidas. principalmente a de "esse leito/carro já ta ocupado nesse horário?"
CREATE INDEX IF NOT EXISTS idx_estadia_pessoa ON estadia (pessoa_id, inicio);
CREATE INDEX IF NOT EXISTS idx_estadia_leito ON estadia (leito_id, inicio);
CREATE INDEX IF NOT EXISTS idx_uso_veiculo ON uso_veiculo (veiculo_id, saida);
CREATE INDEX IF NOT EXISTS idx_uso_motorista ON uso_veiculo (motorista_id, saida);
CREATE INDEX IF NOT EXISTS idx_manutencao_veiculo ON manutencao (veiculo_id, inicio);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_alojamento ON ocorrencia (alojamento_id, aberta_em);
CREATE INDEX IF NOT EXISTS idx_log_quando ON log_auditoria (quando);
