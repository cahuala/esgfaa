-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "militar_alocado_id" INTEGER;

-- AlterTable
ALTER TABLE "propostas" ADD COLUMN     "extracto_id" INTEGER;

-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "pessoa_id" INTEGER,
ADD COLUMN     "unidade_id" INTEGER;

-- CreateTable
CREATE TABLE "processos" (
    "pessoa_id" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "estante" TEXT NOT NULL DEFAULT '',
    "prateleira" TEXT NOT NULL DEFAULT '',
    "posicao" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processos_pkey" PRIMARY KEY ("pessoa_id")
);

-- CreateTable
CREATE TABLE "documentos_pessoais" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ficheiro" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "data" DATE,
    "extracto_id" INTEGER,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pessoais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extractos" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "entidade" TEXT NOT NULL DEFAULT '',
    "ficheiro" TEXT NOT NULL DEFAULT '',
    "nome_original" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "proposta_id" INTEGER,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicado_em" TIMESTAMPTZ(3),

    CONSTRAINT "extractos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_extracto" (
    "id" SERIAL NOT NULL,
    "extracto_id" INTEGER NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "posto_novo" TEXT,
    "cargo_id" INTEGER,
    "encontrado_por" TEXT NOT NULL DEFAULT 'manual',
    "aplicado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "itens_extracto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" SERIAL NOT NULL,
    "protocolo" TEXT NOT NULL,
    "sentido" TEXT NOT NULL DEFAULT 'interno',
    "tipo" TEXT NOT NULL DEFAULT 'oficio',
    "numero" TEXT NOT NULL DEFAULT '',
    "assunto" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "classificacao" TEXT NOT NULL DEFAULT 'normal',
    "origem_unidade_id" INTEGER,
    "entidade_externa" TEXT NOT NULL DEFAULT '',
    "tem_fisico" BOOLEAN NOT NULL DEFAULT false,
    "prazo" DATE,
    "estado" TEXT NOT NULL DEFAULT 'em_curso',
    "criado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_expediente" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "ficheiro" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos" (
    "id" SERIAL NOT NULL,
    "expediente_id" INTEGER NOT NULL,
    "de_unidade_id" INTEGER,
    "para_unidade_id" INTEGER,
    "nota" TEXT NOT NULL DEFAULT '',
    "enviado_por_id" INTEGER NOT NULL,
    "enviado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recebido_por_id" INTEGER,
    "recebido_em" TIMESTAMPTZ(3),
    "fisico" TEXT NOT NULL DEFAULT 'nao_aplica',
    "fisico_portador" TEXT NOT NULL DEFAULT '',
    "fisico_recebido_em" TIMESTAMPTZ(3),

    CONSTRAINT "movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "unidade_id" INTEGER,
    "chave" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes" (
    "conversa_id" INTEGER NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "lido_ate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participantes_pkey" PRIMARY KEY ("conversa_id","utilizador_id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" SERIAL NOT NULL,
    "conversa_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "ficheiro" TEXT,
    "nome_original" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processos_numero_key" ON "processos"("numero");

-- CreateIndex
CREATE INDEX "documentos_pessoais_pessoa_id_idx" ON "documentos_pessoais"("pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "itens_extracto_extracto_id_pessoa_id_key" ON "itens_extracto"("extracto_id", "pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_protocolo_key" ON "expedientes"("protocolo");

-- CreateIndex
CREATE INDEX "expedientes_criado_em_idx" ON "expedientes"("criado_em");

-- CreateIndex
CREATE INDEX "movimentos_para_unidade_id_recebido_em_idx" ON "movimentos"("para_unidade_id", "recebido_em");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_unidade_id_key" ON "conversas"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_chave_key" ON "conversas"("chave");

-- CreateIndex
CREATE INDEX "mensagens_conversa_id_id_idx" ON "mensagens"("conversa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_pessoa_id_key" ON "utilizadores"("pessoa_id");

-- AddForeignKey
ALTER TABLE "utilizadores" ADD CONSTRAINT "utilizadores_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilizadores" ADD CONSTRAINT "utilizadores_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_militar_alocado_id_fkey" FOREIGN KEY ("militar_alocado_id") REFERENCES "pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_pessoais" ADD CONSTRAINT "documentos_pessoais_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_pessoais" ADD CONSTRAINT "documentos_pessoais_extracto_id_fkey" FOREIGN KEY ("extracto_id") REFERENCES "extractos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_extracto" ADD CONSTRAINT "itens_extracto_extracto_id_fkey" FOREIGN KEY ("extracto_id") REFERENCES "extractos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_extracto" ADD CONSTRAINT "itens_extracto_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_expediente" ADD CONSTRAINT "anexos_expediente_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos" ADD CONSTRAINT "movimentos_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- a Escola envia as propostas ao escalão superior; o extracto conclui-as (já não há "despacho" da Escola)
UPDATE "propostas" SET "estado" = 'enviada' WHERE "estado" = 'submetida';
UPDATE "propostas" SET "estado" = 'concluida' WHERE "estado" = 'aprovada';
UPDATE "propostas" SET "estado" = 'indeferida' WHERE "estado" = 'rejeitada';
