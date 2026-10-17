-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "utilizadores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao_token" INTEGER NOT NULL DEFAULT 1,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(3),
    "ultimo_acesso" TIMESTAMPTZ(3),
    "deve_mudar" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL DEFAULT '',
    "pai_id" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_id" INTEGER,
    "funcao" TEXT NOT NULL DEFAULT 'execucao',
    "tipo" TEXT NOT NULL DEFAULT 'militar',
    "posto_requerido" TEXT,
    "categoria_civil" TEXT,
    "vagas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "vinculo" TEXT NOT NULL DEFAULT 'funcionario',
    "nome" TEXT NOT NULL,
    "nome_guerra" TEXT NOT NULL DEFAULT '',
    "nip" TEXT,
    "numero_agente" TEXT,
    "bi" TEXT,
    "data_nascimento" DATE,
    "genero" TEXT,
    "estado_civil" TEXT,
    "naturalidade" TEXT NOT NULL DEFAULT '',
    "provincia" TEXT NOT NULL DEFAULT '',
    "nacionalidade" TEXT NOT NULL DEFAULT 'Angolana',
    "pai" TEXT NOT NULL DEFAULT '',
    "mae" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "telefone" TEXT NOT NULL DEFAULT '',
    "morada" TEXT NOT NULL DEFAULT '',
    "habilitacao" TEXT,
    "area_formacao" TEXT NOT NULL DEFAULT '',
    "foto_id" TEXT,
    "unidade_id" INTEGER,
    "cargo_id" INTEGER,
    "data_cargo" DATE,
    "ramo" TEXT,
    "posto" TEXT,
    "fps" TEXT,
    "quadro_especial" TEXT,
    "especialidade" TEXT NOT NULL DEFAULT '',
    "situacao" TEXT DEFAULT 'activo',
    "efectividade" TEXT DEFAULT 'comissao_normal',
    "data_ingresso" DATE,
    "data_ingresso_qp" DATE,
    "data_antiguidade_posto" DATE,
    "data_situacao" DATE,
    "avaliacao_favoravel" BOOLEAN NOT NULL DEFAULT true,
    "aptidao_fisica" BOOLEAN NOT NULL DEFAULT true,
    "processo_pendente" BOOLEAN NOT NULL DEFAULT false,
    "carreira_civil" TEXT,
    "categoria_civil" TEXT,
    "vinculo_civil" TEXT,
    "data_admissao" DATE,
    "data_categoria" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "chave" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'formacao',
    "local" TEXT NOT NULL DEFAULT '',
    "inicio" DATE,
    "fim" DATE,
    "aproveitamento" BOOLEAN,
    "classificacao" DECIMAL(5,2),

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "posto_anterior" TEXT,
    "posto_novo" TEXT,
    "cargo_nome" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "documento" TEXT NOT NULL DEFAULT '',
    "entidade" TEXT NOT NULL DEFAULT '',
    "proposta_id" INTEGER,
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graduacoes" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "posto" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "proposta_id" INTEGER,

    CONSTRAINT "graduacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencas" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "dias" INTEGER NOT NULL,
    "despacho" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propostas" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "titulo" TEXT NOT NULL,
    "fundamentacao" TEXT NOT NULL DEFAULT '',
    "criado_por" TEXT NOT NULL,
    "submetida_em" TIMESTAMPTZ(3),
    "decidido_por" TEXT NOT NULL DEFAULT '',
    "decidida_em" TIMESTAMPTZ(3),
    "documento" TEXT NOT NULL DEFAULT '',
    "data_documento" DATE,
    "entidade" TEXT NOT NULL DEFAULT '',
    "motivo" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_proposta" (
    "id" SERIAL NOT NULL,
    "proposta_id" INTEGER NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "posto_atual" TEXT,
    "posto_proposto" TEXT,
    "modalidade" TEXT,
    "cargo_id" INTEGER,
    "categoria_atual" TEXT,
    "categoria_proposta" TEXT,
    "inicio" DATE,
    "fim" DATE,
    "verificacao" JSONB NOT NULL DEFAULT '{}',
    "justificacao" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "itens_proposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "quando" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilizador" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvo" TEXT NOT NULL DEFAULT '',
    "detalhes" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacao" (
    "pessoa_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultima_tentativa" TIMESTAMPTZ(3),
    "erro" TEXT NOT NULL DEFAULT '',
    "conta_portal_id" INTEGER,

    CONSTRAINT "sincronizacao_pkey" PRIMARY KEY ("pessoa_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_email_key" ON "utilizadores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_nip_key" ON "pessoas"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_numero_agente_key" ON "pessoas"("numero_agente");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_bi_key" ON "pessoas"("bi");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_email_key" ON "pessoas"("email");

-- CreateIndex
CREATE INDEX "pessoas_tipo_ativo_idx" ON "pessoas"("tipo", "ativo");

-- CreateIndex
CREATE INDEX "eventos_pessoa_id_data_idx" ON "eventos"("pessoa_id", "data");

-- CreateIndex
CREATE INDEX "licencas_pessoa_id_inicio_idx" ON "licencas"("pessoa_id", "inicio");

-- CreateIndex
CREATE INDEX "propostas_estado_idx" ON "propostas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "itens_proposta_proposta_id_pessoa_id_key" ON "itens_proposta"("proposta_id", "pessoa_id");

-- CreateIndex
CREATE INDEX "auditoria_quando_idx" ON "auditoria"("quando");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graduacoes" ADD CONSTRAINT "graduacoes_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencas" ADD CONSTRAINT "licencas_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_proposta" ADD CONSTRAINT "itens_proposta_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_proposta" ADD CONSTRAINT "itens_proposta_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sincronizacao" ADD CONSTRAINT "sincronizacao_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

