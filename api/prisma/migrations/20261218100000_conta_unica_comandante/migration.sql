-- A conta do Comandante no painel é a do Sistema de Gestão de Pessoal (o mesmo e-mail e a mesma palavra-passe).
ALTER TABLE "utilizadores" ADD COLUMN "gerida_pelo_pessoal" BOOLEAN NOT NULL DEFAULT false;
