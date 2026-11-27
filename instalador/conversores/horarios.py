"""
Os docentes de cada cadeira, tirados da legenda dos horários mensais do arquivo da Administração Escolar
(docs/ARQUIVO <ano>/HORÁRIO MENSAL/*.xlsx). Cada legenda tem «SIGLA-Nome da cadeira» e, na mesma linha ou na
seguinte, «n-Posto-Nome/Posto-Nome…» (os docentes, como estão escritos: abreviados, com «Ass.Portuguesa»,
«Conferencista», «Director do Curso»…). Não se ligam sozinhos às fichas: sai uma folha para a Repartição conferir.

  python3 horarios.py <pasta docs> <saida.xlsx> [carga.json]
  (o carga.json vai para CARREGAR: a Gestão Escolar procura cada docente nas fichas do Pessoal e a Repartição confirma)
"""
import sys, os, re, glob, json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

SIGLA = re.compile(r'^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\s]{0,12}?)\s*-\s*(.{4,})$')
DOCENTES = re.compile(r'^(\d{1,2})\s*-\s*(.+)$')
# o que não é o nome de um docente (sozinho): a assessoria portuguesa, o conferencista, a direcção do curso
NAO_PESSOA = re.compile(r'^\s*(ass\.?\s*(portuguesa|port\.?|pt\.?)|conferencista|direc[çc][ãa]o do curso|director do curso)\s*$', re.I)


def linhas(f):
    b = openpyxl.load_workbook(f, read_only=True, data_only=True)
    s = b.worksheets[0]
    return [[str(v).strip() for v in r if v not in (None, '') and str(v).strip()] for r in s.iter_rows(values_only=True)]


def ler(f):
    rows = linhas(f)
    titulo = [' '.join(r) for r in rows[:4] if r]
    curso = next((t for t in titulo if re.search(r'curso', t, re.I)), '')
    mes = next((re.sub(r'(?i).*hor[áa]rio do m[êe]s\s*', '', t) for t in titulo if re.search(r'hor[áa]rio', t, re.I)), '')
    try:
        i = next(k for k, r in enumerate(rows) if r and r[0].lower().startswith('legenda'))
    except StopIteration:
        return curso, mes, []
    cadeiras, docentes = [], []
    for r in rows[i + 1:i + 40]:
        for c in r:
            c = re.sub(r'\s{2,}', ' ', c).strip()
            m = DOCENTES.match(c)
            if m:
                docentes.append((int(m.group(1)), m.group(2).strip()))
                continue
            m = SIGLA.match(c)
            if m and len(m.group(1).replace('.', '').strip()) <= 8:
                cadeiras.append((m.group(1).strip().rstrip('.'), m.group(2).strip()))
    # emparelha pela ordem: a 1.ª cadeira com o «1-…», a 2.ª com o «2-…» (como nas legendas); o que sobra fica sem par
    pares = []
    por_n = {n: d for n, d in docentes}
    for k, (sig, nome) in enumerate(cadeiras):
        pares.append((sig, nome, por_n.get(k + 1, '')))
    return curso, mes, pares


def nomes(texto):
    # separa os docentes («Cor-Hamilton/T.Cor-Mac Donald, Moacir») e tira quem não é uma pessoa
    partes = re.split(r'\s*/\s*|\s*,\s*|\s+e\s+', texto)
    # «(Ass.PT)» fica como nota: é um docente da assessoria portuguesa
    limpas = [re.sub(r'\s*\(\s*ass\.?\s*(portuguesa|port\.?|pt\.?)\s*\)', ' (Ass. PT)', p, flags=re.I).strip(' -') for p in partes]
    return [p for p in limpas if p and not NAO_PESSOA.search(p)]


def main(docs, saida, carga=None):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Docentes por cadeira'
    cab = ['Ano lectivo', 'Curso', 'Mês', 'Sigla', 'Cadeira', 'Docentes (como no horário)', 'Docentes (separados)', 'Confirmar: nome completo de cada docente', 'Ficheiro']
    ws.append(cab)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='861D0C'); c.alignment = Alignment(wrap_text=True)
    n = 0
    para_carga = []
    for f in sorted(glob.glob(os.path.join(docs, 'ARQUIVO *', 'HORÁRIO MENSAL', '*.xlsx'))):
        if os.path.basename(f).startswith('~$'):
            continue
        ano = re.search(r'ARQUIVO (\d{4})-(\d{4})', f)
        ano = f'{ano.group(1)}/{ano.group(2)}' if ano else ''
        try:
            curso, mes, pares = ler(f)
        except Exception as e:  # noqa: BLE001
            print('não li', f, e)
            continue
        for sig, cad, doc in pares:
            ws.append([ano, curso, mes, sig, cad, doc, '; '.join(nomes(doc)), '', os.path.relpath(f, docs)])
            if nomes(doc):
                para_carga.append({'anoLetivo': ano, 'curso': curso, 'mes': mes, 'sigla': sig, 'cadeira': cad, 'texto': doc, 'nomes': nomes(doc)})
            n += 1
    for col, w in zip('ABCDEFGHI', [11, 46, 12, 9, 46, 60, 50, 50, 50]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = 'A2'
    wb.save(saida)
    print(f'{n} linha(s) em {saida}')
    if carga:
        with open(carga, 'w', encoding='utf-8') as fj:
            json.dump({'tipo': 'docentes-horarios', 'linhas': para_carga}, fj, ensure_ascii=False, indent=1)
        print(f'{len(para_carga)} linha(s) com docentes em {carga}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
