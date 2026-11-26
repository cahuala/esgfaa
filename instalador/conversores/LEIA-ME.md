# Conversores das listas e do arquivo (dados reais: só no computador da Repartição)

Os ficheiros de entrada (`docs/DOCENTES E DISCENTES`, `docs/ARQUIVO 2023-2024`, `2024-2025`, `2025-2026`) e tudo o que
estes scripts escrevem têm **dados pessoais reais**: ficam fora do git (estão no `.gitignore`), não se enviam por e-mail
e só vão para o pendrive. Aqui fica só o código.

## O que faz cada um

| Script | Lê | Escreve |
|---|---|---|
| `finalistas.py` | as relações de discentes e finalistas em Word (`.docx`) | `cursos.json` |
| `converter_academicos.py` | as listas de docentes (Excel), `cursos.json` e, se se der, o `arquivo.json` | `academicos.json` (carga do Pessoal) e `CONFERIR.xlsx` |
| `arquivo.py` | as relações nominais, as pautas finais e as pautas por cadeira do arquivo | `arquivo.json` (o curso e o ano vêm da edição, não do nome da pasta) |
| `comparar.py` | `arquivo.json` e as listas convertidas sem o arquivo | `CONFERENCIA.xlsx` (arquivo × listas: iguais, diferenças, só num lado) |
| `gestao.py` | `arquivo.json` e `academicos.json` | `gestao-pautas.json` (para o painel: Administração Escolar › Arquivo) |

## Como se corre (macOS)

```sh
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install openpyxl xlrd python-docx
P=/tmp/venv/bin/python; C=instalador/conversores; T=/tmp/conversao; mkdir -p $T/docx
# os .doc passam a .docx (o textutil vem no macOS)
for f in "docs/DOCENTES E DISCENTES"/*.doc; do textutil -convert docx -output "$T/docx/$(basename "${f%.doc}").docx" "$f"; done
cp "docs/DOCENTES E DISCENTES"/*.docx $T/docx/
$P -I $C/finalistas.py $T/cursos.json $T/docx/*.docx
$P -I $C/arquivo.py docs $T/arquivo.json
$P -I $C/converter_academicos.py "docs/DOCENTES E DISCENTES" $T/cursos.json $T/sem-arquivo.json $T/c0.xlsx
$P -I $C/converter_academicos.py "docs/DOCENTES E DISCENTES" $T/cursos.json $T/academicos.json $T/CONFERIR.xlsx $T/arquivo.json
$P -I $C/comparar.py $T/arquivo.json $T/sem-arquivo.json $T/CONFERIR.xlsx $T/CONFERENCIA.xlsx
$P -I $C/gestao.py $T/arquivo.json $T/academicos.json $T/gestao-pautas.json
```

- **Pessoal**: o pendrive leva `academicos.json` dentro da chave `academicos` do `relacoes.json`
  (`node instalador/preparar-pendrive.mjs --relacoes <ficheiro>`); a actualização carrega-o uma vez por versão e
  nunca duplica nem muda o que já está (só completa o que está em branco).
- **Gestão**: `gestao-pautas.json` carrega-se no painel, em Administração Escolar › Arquivo (mostra primeiro o que
  entra; o que já está no sistema não muda).
