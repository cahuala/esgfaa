-- o ano lectivo com que cada utilizador do painel trabalha (vazio = o actual)
ALTER TABLE "utilizadores" ADD COLUMN "ano_trabalho" TEXT NOT NULL DEFAULT '';
