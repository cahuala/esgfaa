"""
Compara o arquivo da Administração Escolar (arquivo.json) com as listas de DOCENTES E DISCENTES (já convertidas:
sem-arquivo.json) e escreve a conferência em Excel.
Uso: python comparar.py <arquivo.json> <sem-arquivo.json> <CONFERIR do conversor.xlsx> <saida.xlsx>
"""
import sys, re, json, collections, unicodedata
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

ARQ, LISTAS, CONF, SAIDA = sys.argv[1:5]
src = open(__file__.replace('comparar.py', 'converter_academicos.py')).read()
ns = {'__file__': __file__}
exec(src.split('def titulo(t):')[0].replace('PASTA, CURSOS, SAIDA, CONFERIR = sys.argv[1:5]', ''), ns)
exec('import difflib\n' + src[src.index('def tokens(n)'):src.index('GRAU = [')], ns)
exec(src[src.index('SIGLA_CURSO = ['):src.index('HAB_TXT = [')], ns)
sem, chave_posto, POSTOS, POLICIA, parecidos, curso_de = ns['sem'], ns['chave_posto'], ns['POSTOS'], ns['POLICIA'], ns['parecidos'], ns['curso_de']
NOME_POSTO = ns['NOME_POSTO']

arq = json.load(open(ARQ))
pessoas = json.load(open(LISTAS))['pessoas']


def posto_canon(t):
    k = chave_posto(re.sub(r'\(reformad[oa]\)', '', str(t or ''), flags=re.I))
    if k in POSTOS: return POSTOS[k][0]
    if k in POLICIA: return POLICIA[k]
    return str(t or '').strip()


def posto_lista(p):
    return p.get('posto') or p.get('postoExterno') or ''


def nome_posto(x): return NOME_POSTO.get(x, x)


por_numero = {}
for p in pessoas:
    for n in [p.get('nip'), p.get('numeroAgente'), *(p.get('outrosNips') or [])]:
        if n: por_numero[str(n).upper()] = p
# quem as listas põem em cada curso (sigla, edição)
nas_listas = collections.defaultdict(list)
for p in pessoas:
    for a in p.get('anos', []):
        k = curso_de(a['curso'])
        if k and a['papel'] == 'estudante': nas_listas[k].append(p)

resumo, difs, so_arq, so_listas, sem_rel = [], [], [], [], []
for t in arq['turmas']:
    k = (t['sigla'], t['edicao'])
    nome_t = f"{t['edicao']}.º {t['sigla']} ({t['anoLetivo']})"
    lst = nas_listas.get(k, [])
    vistos = set()
    n_iguais = n_dif = n_so = 0
    pauta = t.get('pauta') or {}
    nips_pauta = {e['nip'] for e in pauta.get('estudantes', []) if e['nip']}
    for x in t['relacao']:
        p = por_numero.get(str(x.get('nip') or '').upper()) if x.get('nip') else None
        if not p and x.get('nip'):
            m = [q for n, q in por_numero.items() if n.lstrip('I').lstrip('0') == str(x['nip']).upper().lstrip('I').lstrip('0') and parecidos(q['nome'], x['nome'])]
            p = m[0] if m else None
        if p and not parecidos(p['nome'], x['nome']):
            difs.append([nome_t, x.get('nip'), x['nome'], p['nome'], 'NIP de outra pessoa', f"No arquivo o NIP {x.get('nip')} é de «{x['nome']}»; nas listas é de «{p['nome']}». Não se carregou: confirme qual está certo."])
            n_dif += 1
            continue
        if not p:
            m = [q for q in lst if parecidos(q['nome'], x['nome'])] or [q for q in pessoas if sem(q['nome']) == sem(x['nome'])]
            p = m[0] if len(m) == 1 else None
        if not p:
            so_arq.append([nome_t, x.get('nip') or '', nome_posto(posto_canon(x.get('posto'))), x['nome'], x.get('ramo') or '', x.get('unidade') or '', 'na pauta' if x.get('nip') in nips_pauta else ('sem pauta' if not pauta else 'não está na pauta')])
            n_so += 1
            continue
        vistos.add(id(p))
        d = []
        if sem(p['nome']) != sem(x['nome']): d.append(('Nome', x['nome'], p['nome']))
        pa, pl = posto_canon(x.get('posto')), posto_lista(p)
        if pa and pl and sem(pa) != sem(pl) and sem(nome_posto(pa)) != sem(nome_posto(pl)): d.append(('Posto', nome_posto(pa), nome_posto(pl)))
        ra = next((r for r in ('EXE', 'FAN', 'MGA') if r in str(x.get('ramo') or '').upper()), '')
        if ra and p.get('ramo') and ra != p['ramo'] and not p.get('ramoPorConfirmar'): d.append(('Ramo', ra, p['ramo']))
        norm = lambda n: str(n).upper().lstrip('I').lstrip('0')
        if x.get('nip') and (p.get('nip') or p.get('numeroAgente')) and norm(x['nip']) not in {norm(n) for n in [p.get('nip'), p.get('numeroAgente'), *(p.get('outrosNips') or [])] if n}:
            d.append(('NIP', x['nip'], p.get('nip') or p.get('numeroAgente')))
        if not x.get('nip') and (p.get('nip') or p.get('numeroAgente')): d.append(('NIP', '(em branco)', p.get('nip') or p.get('numeroAgente')))
        for campo, va, vl in d:
            difs.append([nome_t, x.get('nip') or '', x['nome'], p['nome'], campo, f'Arquivo: {va} | Listas: {vl}'])
        if d: n_dif += 1
        else: n_iguais += 1
    for p in lst:
        if id(p) not in vistos:
            so_listas.append([nome_t, p.get('nip') or p.get('numeroAgente') or '', nome_posto(posto_lista(p)), p['nome'], p.get('ramo') or '', '; '.join(p.get('origens', []))[:200]])
    # quem está na pauta mas não na relação nominal do arquivo
    nips_rel = {x['nip'] for x in t['relacao'] if x.get('nip')}
    nomes_rel = [x['nome'] for x in t['relacao']]
    for e in pauta.get('estudantes', []):
        if (e['nip'] and e['nip'] not in nips_rel) or (not e['nip'] and not any(parecidos(e['nome'], n) for n in nomes_rel)):
            sem_rel.append([nome_t, e['nip'] or '', e['posto'], e['nome'], e.get('final') if e.get('final') is not None else '', e.get('mencao') or '', f"{pauta['ficheiro']} «{pauta['folha']}»"])
    resumo.append([t['anoLetivo'], t['curso'], len(t['relacao']), len(pauta.get('estudantes', [])) if pauta else '', len(pauta.get('ucs', [])) if pauta else '', len(t['cadeiras']), len(lst), n_iguais, n_dif, n_so, sum(1 for p in lst if id(p) not in vistos),
                   f"{pauta['ficheiro']} «{pauta['folha']}»" if pauta else ''])

wb = openpyxl.Workbook()
neg = Font(bold=True, color='FFFFFF'); fundo = PatternFill('solid', fgColor='1F4E78')


def folha(nome, cab, linhas, larguras, nota=''):
    ws = wb.create_sheet(nome)
    if nota:
        ws.append([nota]); ws['A1'].font = Font(italic=True)
    ws.append(cab)
    for c in ws[ws.max_row]: c.font, c.fill = neg, fundo
    for l in linhas: ws.append(l)
    for i, w in enumerate(larguras): ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = w
    ws.freeze_panes = ws.cell(row=ws.max_row - len(linhas) + 1, column=1)
    return ws


wb.remove(wb.active)
folha('Resumo', ['Ano lectivo', 'Curso', 'Relação nominal (arquivo)', 'Pauta final: discentes', 'Pauta final: cadeiras', 'Pautas por cadeira', 'Nas listas DOCENTES E DISCENTES', 'Iguais', 'Com diferenças', 'Só no arquivo', 'Só nas listas', 'Pauta usada'],
      resumo, [11, 58, 12, 12, 12, 12, 14, 9, 11, 10, 10, 80],
      'Arquivo da Administração Escolar (docs/ARQUIVO 2023-2024, 2024-2025, 2025-2026) comparado com as listas de docs/DOCENTES E DISCENTES. O curso e o ano vêm do conteúdo (a edição), não do nome da pasta.')
folha('Diferenças', ['Turma', 'NIP (arquivo)', 'Nome no arquivo', 'Nome nas listas', 'Campo', 'O que difere'], difs, [22, 13, 40, 40, 18, 110],
      'A mesma pessoa no arquivo e nas listas com algum dado diferente. Fica o que está nas listas (e na ficha do Pessoal); «NIP de outra pessoa» não se carrega.')
folha('Só no arquivo', ['Turma', 'NIP', 'Posto', 'Nome', 'Ramo', 'Unidade de proveniência', 'Pauta'], so_arq, [22, 13, 22, 42, 8, 40, 16],
      'Estão na relação nominal do arquivo e não nas listas: entram no Pessoal como novas fichas (estudantes desse ano, já saídos), menos os militares sem NIP.')
folha('Só nas listas', ['Turma', 'NIP', 'Posto', 'Nome', 'Ramo', 'Listas'], so_listas, [22, 13, 22, 42, 8, 90], 'Estão nas listas desse curso e não na relação nominal do arquivo.')
folha('Pauta sem relação', ['Turma', 'NIP', 'Posto', 'Nome', 'Média final', 'Classificação', 'Pauta'], sem_rel, [22, 13, 18, 42, 11, 13, 80], 'Estão na pauta final e não na relação nominal do arquivo.')
c = openpyxl.load_workbook(CONF)['Conferir']
ws = folha('A conferir (carga)', ['Motivo', 'Nome', 'NIP', 'Posto', 'Lista'], [list(r) for r in list(c.iter_rows(values_only=True))[1:]], [70, 42, 14, 22, 80], 'Não entram na carga do Pessoal até se corrigirem (o conversor das listas e do arquivo).')
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for cel in row: cel.alignment = Alignment(wrap_text=True, vertical='top')
wb.save(SAIDA)
print('turmas:', len(resumo), '| diferenças:', len(difs), '| só no arquivo:', len(so_arq), '| só nas listas:', len(so_listas), '| pauta sem relação:', len(sem_rel))
for r in resumo: print('  ', r[0], r[1][:45].ljust(45), 'arq', r[2], 'pauta', r[3], 'listas', r[6], 'iguais', r[7], 'dif', r[8], 'só arq', r[9], 'só listas', r[10])
