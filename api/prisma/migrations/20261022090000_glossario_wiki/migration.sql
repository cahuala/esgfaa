-- CreateTable
CREATE TABLE "glossario" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "termo" TEXT NOT NULL,
    "definicao" TEXT NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glossario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paginas_wiki" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paginas_wiki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versoes_wiki" (
    "id" SERIAL NOT NULL,
    "pagina_id" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "autor_id" INTEGER NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versoes_wiki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "glossario_cadeira_id_termo_idx" ON "glossario"("cadeira_id", "termo");

-- CreateIndex
CREATE UNIQUE INDEX "paginas_wiki_cadeira_id_titulo_key" ON "paginas_wiki"("cadeira_id", "titulo");

-- CreateIndex
CREATE INDEX "versoes_wiki_pagina_id_id_idx" ON "versoes_wiki"("pagina_id", "id");

-- AddForeignKey
ALTER TABLE "glossario" ADD CONSTRAINT "glossario_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossario" ADD CONSTRAINT "glossario_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paginas_wiki" ADD CONSTRAINT "paginas_wiki_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_wiki" ADD CONSTRAINT "versoes_wiki_pagina_id_fkey" FOREIGN KEY ("pagina_id") REFERENCES "paginas_wiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versoes_wiki" ADD CONSTRAINT "versoes_wiki_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

