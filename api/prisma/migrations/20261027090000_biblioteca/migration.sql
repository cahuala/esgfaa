-- CreateTable
CREATE TABLE "biblioteca_obras" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT NOT NULL DEFAULT '',
    "autores" JSONB NOT NULL DEFAULT '[]',
    "ano" INTEGER,
    "editora" TEXT NOT NULL DEFAULT '',
    "edicao" TEXT NOT NULL DEFAULT '',
    "isbn" TEXT,
    "cota" TEXT NOT NULL DEFAULT '',
    "assuntos" JSONB NOT NULL DEFAULT '[]',
    "idioma" TEXT NOT NULL DEFAULT 'pt',
    "resumo" TEXT NOT NULL DEFAULT '',
    "ficheiro_id" TEXT,
    "acesso" TEXT NOT NULL DEFAULT 'todos',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biblioteca_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biblioteca_exemplares" (
    "id" SERIAL NOT NULL,
    "obra_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'bom',
    "localizacao" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biblioteca_exemplares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biblioteca_emprestimos" (
    "id" SERIAL NOT NULL,
    "exemplar_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "emprestado_em" TIMESTAMPTZ(3) NOT NULL,
    "prazo" TIMESTAMPTZ(3) NOT NULL,
    "renovacoes" INTEGER NOT NULL DEFAULT 0,
    "devolvido_em" TIMESTAMPTZ(3),
    "exemplar_ativo" INTEGER,
    "registado_por" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "biblioteca_emprestimos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biblioteca_obras_isbn_key" ON "biblioteca_obras"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "biblioteca_exemplares_codigo_key" ON "biblioteca_exemplares"("codigo");

-- CreateIndex
CREATE INDEX "biblioteca_exemplares_obra_id_idx" ON "biblioteca_exemplares"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "biblioteca_emprestimos_exemplar_ativo_key" ON "biblioteca_emprestimos"("exemplar_ativo");

-- CreateIndex
CREATE INDEX "biblioteca_emprestimos_conta_id_devolvido_em_idx" ON "biblioteca_emprestimos"("conta_id", "devolvido_em");

-- CreateIndex
CREATE INDEX "biblioteca_emprestimos_exemplar_id_idx" ON "biblioteca_emprestimos"("exemplar_id");

-- AddForeignKey
ALTER TABLE "biblioteca_obras" ADD CONSTRAINT "biblioteca_obras_ficheiro_id_fkey" FOREIGN KEY ("ficheiro_id") REFERENCES "ficheiros_privados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biblioteca_exemplares" ADD CONSTRAINT "biblioteca_exemplares_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "biblioteca_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biblioteca_emprestimos" ADD CONSTRAINT "biblioteca_emprestimos_exemplar_id_fkey" FOREIGN KEY ("exemplar_id") REFERENCES "biblioteca_exemplares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biblioteca_emprestimos" ADD CONSTRAINT "biblioteca_emprestimos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

