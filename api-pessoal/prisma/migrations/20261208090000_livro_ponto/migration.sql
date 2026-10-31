-- CreateTable
CREATE TABLE "aparelhos_ponto" (
    "id" SERIAL NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "local" TEXT NOT NULL DEFAULT '',
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "modelo" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "ultimo_contacto" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aparelhos_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandos_ponto" (
    "id" SERIAL NOT NULL,
    "aparelho_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "resposta" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMPTZ(3),

    CONSTRAINT "comandos_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marcacoes" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "quando" TIMESTAMPTZ(0) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'aparelho',
    "verificacao" TEXT NOT NULL DEFAULT '',
    "aparelho_id" INTEGER,
    "justificacao" TEXT NOT NULL DEFAULT '',
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marcacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digitais_ponto" (
    "pessoa_id" INTEGER NOT NULL,
    "aparelho_id" INTEGER NOT NULL,
    "dedo" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digitais_ponto_pkey" PRIMARY KEY ("pessoa_id","aparelho_id","dedo")
);

-- CreateIndex
CREATE UNIQUE INDEX "aparelhos_ponto_numero_serie_key" ON "aparelhos_ponto"("numero_serie");

-- CreateIndex
CREATE INDEX "comandos_ponto_aparelho_id_estado_idx" ON "comandos_ponto"("aparelho_id", "estado");

-- CreateIndex
CREATE INDEX "marcacoes_quando_idx" ON "marcacoes"("quando");

-- CreateIndex
CREATE UNIQUE INDEX "marcacoes_pessoa_id_quando_key" ON "marcacoes"("pessoa_id", "quando");

-- AddForeignKey
ALTER TABLE "comandos_ponto" ADD CONSTRAINT "comandos_ponto_aparelho_id_fkey" FOREIGN KEY ("aparelho_id") REFERENCES "aparelhos_ponto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacoes" ADD CONSTRAINT "marcacoes_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacoes" ADD CONSTRAINT "marcacoes_aparelho_id_fkey" FOREIGN KEY ("aparelho_id") REFERENCES "aparelhos_ponto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digitais_ponto" ADD CONSTRAINT "digitais_ponto_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digitais_ponto" ADD CONSTRAINT "digitais_ponto_aparelho_id_fkey" FOREIGN KEY ("aparelho_id") REFERENCES "aparelhos_ponto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

