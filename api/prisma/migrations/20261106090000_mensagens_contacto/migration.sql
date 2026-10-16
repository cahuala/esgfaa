-- CreateTable
CREATE TABLE "mensagens_contacto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL DEFAULT '',
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'nova',
    "notas" TEXT NOT NULL DEFAULT '',
    "tratado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagens_contacto_estado_criado_em_idx" ON "mensagens_contacto"("estado", "criado_em");


-- o editor-chefe (que modera os comentários) passa a tratar também as mensagens do formulário de contacto
UPDATE "papeis"
SET "permissoes" = "permissoes" || '["contactos.ver", "contactos.gerir"]'::jsonb
WHERE "id" = 'editor_chefe'
  AND "permissoes" ? 'comentarios.ver'
  AND NOT ("permissoes" ? 'contactos.ver');
