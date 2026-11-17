-- Histórico: a data pode não se saber (registos antigos lançados à mão: promoções, nomeações, louvores…).
ALTER TABLE "eventos" ALTER COLUMN "data" DROP NOT NULL;
