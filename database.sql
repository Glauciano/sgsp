-- =========================================================================
-- S.G.C-S.P - SISTEMA DE GESTÃO COLUMBÓFILA E CLASSIFICAÇÕES (SÃO PAULO)
-- BANCO DE DADOS COMPLETO (ESPELHO INTEGRAL DO SISTEMA GPC)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. HIERARQUIA FEDERATIVA E ZONAS DE VOO (DOUBLAGEM CRUZADA)
CREATE TABLE entidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL,
    nivel VARCHAR(20) CHECK (nivel IN ('FEDERACAO', 'ASSOCIACAO', 'ZONA', 'COLETIVIDADE')) NOT NULL,
    entidade_pai_id UUID REFERENCES entidades(id),
    diretor_prova VARCHAR(120),
    criado_em TIMESTAMP DEFAULT NOW()
);

-- 2. REGULAMENTOS DESPORTIVOS POR ENTIDADE E ÉPOCA
CREATE TABLE regulamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidade_id UUID REFERENCES entidades(id) NOT NULL,
    temporada INT NOT NULL,
    metodo_pontuacao VARCHAR(30) CHECK (metodo_pontuacao IN ('PERCENTAGEM', 'VELOCIDADE_1000', 'DECRESCENTE', 'COEFICIENTE_FCI')) DEFAULT 'PERCENTAGEM',
    percentual_corte DECIMAL(5, 2) DEFAULT 20.00,
    criterio_equipe VARCHAR(30) CHECK (criterio_equipe IN ('DESIGNADOS', 'MELHORES_AVES', 'REGULARIDADE_1_AVE')) DEFAULT 'DESIGNADOS',
    qtd_aves_pontuam INT DEFAULT 5,
    max_designados_permitidos INT DEFAULT 5,
    descartar_piores_provas INT DEFAULT 1,
    min_provas_pombo_as INT DEFAULT 3,
    UNIQUE(entidade_id, temporada)
);

-- 3. CONCORRENTES (SÓCIOS) + GPS POMBAL + CONSTATADOR
CREATE TABLE concorrentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coletividade_principal_id UUID REFERENCES entidades(id) NOT NULL,
    licenca_federativa VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cpf_documento VARCHAR(30),
    telefone VARCHAR(30),
    latitude DECIMAL(11, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    relogio_tipo VARCHAR(20) CHECK (relogio_tipo IN ('ELETRONICO', 'MECANICO')) DEFAULT 'ELETRONICO',
    relogio_marca VARCHAR(40),
    relogio_serie VARCHAR(50),
    situacao_financeira VARCHAR(20) CHECK (situacao_financeira IN ('REGULAR', 'BLOQUEADO')) DEFAULT 'REGULAR',
    ativo BOOLEAN DEFAULT TRUE
);

-- Vínculo de Doublagem do Concorrente
CREATE TABLE concorrente_doublagens (
    concorrente_id UUID REFERENCES concorrentes(id) ON DELETE CASCADE,
    entidade_id UUID REFERENCES entidades(id) ON DELETE CASCADE,
    tipo_participacao VARCHAR(20) CHECK (tipo_participacao IN ('EFETIVO', 'CONVIDADO')) DEFAULT 'EFETIVO',
    PRIMARY KEY (concorrente_id, entidade_id)
);

-- 4. PLANTEL & RECENSEAMENTO ANUAL DE ANILHAS
CREATE TABLE pombos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concorrente_id UUID REFERENCES concorrentes(id) NOT NULL,
    pais_anilha VARCHAR(10) DEFAULT 'BR',
    ano_anilha INT NOT NULL,
    numero_anilha VARCHAR(40) NOT NULL,
    anilha_completa VARCHAR(60) UNIQUE NOT NULL,
    chip_rfid_hex VARCHAR(50) UNIQUE,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    cor VARCHAR(40),
    is_estrangeiro BOOLEAN DEFAULT FALSE,
    homologado_federacao BOOLEAN DEFAULT TRUE,
    UNIQUE(pais_anilha, ano_anilha, numero_anilha)
);

CREATE TABLE recenseamento_anual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pombo_id UUID REFERENCES pombos(id) NOT NULL,
    temporada INT NOT NULL,
    pago_e_validado BOOLEAN DEFAULT TRUE,
    data_validacao TIMESTAMP DEFAULT NOW(),
    UNIQUE(pombo_id, temporada)
);

-- 5. PONTOS DE SOLTURA & MATRIZ PRÉ-CALCULADA DE DISTÂNCIAS (VINCENTY WGS84)
CREATE TABLE pontos_soltura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    estado_uf VARCHAR(10),
    latitude DECIMAL(11, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL
);

CREATE TABLE matriz_distancias (
    concorrente_id UUID REFERENCES concorrentes(id) ON DELETE CASCADE,
    ponto_soltura_id UUID REFERENCES pontos_soltura(id) ON DELETE CASCADE,
    distancia_vincenty_metros DECIMAL(12, 3) NOT NULL,
    calculado_em TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (concorrente_id, ponto_soltura_id)
);

-- 6. CONCURSOS / PROVAS DA ÉPOCA
CREATE TABLE concursos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) UNIQUE NOT NULL,
    temporada INT NOT NULL,
    entidade_organizadora_id UUID REFERENCES entidades(id) NOT NULL,
    ponto_soltura_id UUID REFERENCES pontos_soltura(id) NOT NULL,
    nome VARCHAR(150) NOT NULL,
    modalidade VARCHAR(25) CHECK (modalidade IN ('VELOCIDADE', 'MEIO_FUNDO', 'FUNDO', 'MARATONA', 'TREINO')) NOT NULL,
    data_hora_soltura TIMESTAMP NOT NULL,
    soltador_nome VARCHAR(120),
    vento_clima VARCHAR(120),
    usa_hora_morta BOOLEAN DEFAULT FALSE,
    hora_morta_inicio TIME DEFAULT '20:00:00',
    hora_morta_fim TIME DEFAULT '05:30:00',
    valor_inscricao_ave DECIMAL(10, 2) DEFAULT 0.00,
    valor_serie_a DECIMAL(10, 2) DEFAULT 0.00,
    valor_anel_ouro DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) CHECK (status IN ('ABERTO', 'TRANCADO', 'APURADO')) DEFAULT 'ABERTO'
);

-- 7. CONTROLE DE ACERTO, LACRE E MARCHA DE RELÓGIO POR CONCURSO
CREATE TABLE relogios_concurso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concurso_id UUID REFERENCES concursos(id) ON DELETE CASCADE,
    concorrente_id UUID REFERENCES concorrentes(id) ON DELETE CASCADE,
    numero_lacre VARCHAR(50),
    hora_acerto_gps TIMESTAMP NOT NULL,
    hora_relogio_acerto TIMESTAMP NOT NULL,
    hora_abertura_gps TIMESTAMP,
    hora_relogio_abertura TIMESTAMP,
    hash_arquivo_sha256 VARCHAR(255),
    UNIQUE(concurso_id, concorrente_id)
);

-- 8. ENCACHOTAMENTO & APOSTAS/SÉRIES PARALELAS
CREATE TABLE encachotamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concurso_id UUID REFERENCES concursos(id) ON DELETE CASCADE,
    pombo_id UUID REFERENCES pombos(id) NOT NULL,
    concorrente_id UUID REFERENCES concorrentes(id) NOT NULL,
    numero_cesto VARCHAR(20),
    is_designado BOOLEAN DEFAULT FALSE,
    is_serie_a BOOLEAN DEFAULT FALSE,
    is_serie_b BOOLEAN DEFAULT FALSE,
    is_anel_ouro BOOLEAN DEFAULT FALSE,
    hora_chegada_bruta TIMESTAMP,
    hora_chegada_corrigida TIMESTAMP,
    UNIQUE(concurso_id, pombo_id)
);

-- 9. CLASSIFICAÇÕES APURADAS E DOUBLADAS
CREATE TABLE classificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concurso_id UUID REFERENCES concursos(id) ON DELETE CASCADE,
    entidade_id UUID REFERENCES entidades(id) NOT NULL,
    pombo_id UUID REFERENCES pombos(id) NOT NULL,
    concorrente_id UUID REFERENCES concorrentes(id) NOT NULL,
    distancia_metros DECIMAL(12, 3) NOT NULL,
    tempo_voo_segundos INT NOT NULL,
    velocidade_m_min DECIMAL(10, 4) NOT NULL,
    posicao INT NOT NULL,
    coeficiente_fci DECIMAL(10, 4) NOT NULL,
    pontos_obtidos DECIMAL(10, 2) NOT NULL,
    is_designado BOOLEAN DEFAULT FALSE,
    premio_financeiro DECIMAL(10, 2) DEFAULT 0.00
);

-- 10. TORNEIOS ELIMINATÓRIOS (MATA-MATA)
CREATE TABLE eliminatorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concurso_id UUID REFERENCES concursos(id) ON DELETE CASCADE,
    fase VARCHAR(30) NOT NULL,
    numero_chave INT NOT NULL,
    pombo_a_id UUID REFERENCES pombos(id) NOT NULL,
    pombo_b_id UUID REFERENCES pombos(id) NOT NULL,
    vencedor_id UUID REFERENCES pombos(id)
);

-- Índices para performance GPC
CREATE INDEX idx_enc_concurso ON encachotamentos(concurso_id);
CREATE INDEX idx_class_concurso ON classificacoes(concurso_id, posicao);
CREATE INDEX idx_matriz_conc ON matriz_distancias(concorrente_id, ponto_soltura_id);
