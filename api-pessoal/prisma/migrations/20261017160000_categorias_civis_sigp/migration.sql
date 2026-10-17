-- categorias do pessoal civil passam a ser as do SIGP (faa_categorias_civis)
UPDATE "pessoas" SET "carreira_civil" = 'tecnico_superior' WHERE "carreira_civil" = 'tecnica_superior';
UPDATE "pessoas" SET "carreira_civil" = 'tecnico_medio' WHERE "carreira_civil" IN ('tecnica', 'tecnica_media');
UPDATE "pessoas" SET "carreira_civil" = 'administrativo' WHERE "carreira_civil" = 'administrativa';
UPDATE "pessoas" SET "carreira_civil" = 'auxiliar_escritorio' WHERE "carreira_civil" = 'auxiliar';
UPDATE "pessoas" SET "carreira_civil" = 'auxiliar_servicos_gerais' WHERE "carreira_civil" = 'operaria';
-- empregados domiciliares: categoria «Trabalhador Domiciliar» (como no SIGP)
UPDATE "pessoas" SET "carreira_civil" = 'trabalhador_domiciliar', "categoria_civil" = 'Trabalhador Domiciliar' WHERE "vinculo" = 'domiciliar';
