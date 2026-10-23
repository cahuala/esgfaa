-- CreateTable
CREATE TABLE "protecao_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "dados" JSONB NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protecao_sistema_pkey" PRIMARY KEY ("id")
);

