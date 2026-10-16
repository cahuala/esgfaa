-- CreateTable
CREATE TABLE "textos_traduzidos" (
    "lingua" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textos_traduzidos_pkey" PRIMARY KEY ("lingua","chave")
);

