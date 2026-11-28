import sys, os, re, json, xlrd, openpyxl, datetime
def linhas(f):
    out=[]
    if f.lower().endswith('.xls'):
        b=xlrd.open_workbook(f, formatting_info=False)
        for sh in b.sheets():
            rows=[]
            for r in range(sh.nrows):
                v=[]
                for c in range(sh.ncols):
                    x=sh.cell(r,c)
                    # as células com erro do Excel (#DIV/0!, #VALOR!…) ficam vazias: o xlrd dá o código (7 = #DIV/0!), que não é nota
                    if x.ctype==xlrd.XL_CELL_ERROR: v.append(''); continue
                    if x.ctype==xlrd.XL_CELL_DATE:
                        try: v.append(xlrd.xldate_as_datetime(x.value,b.datemode).date().isoformat())
                        except Exception: v.append(x.value)
                    else: v.append(x.value)
                rows.append(v)
            out.append((sh.name, rows))
    else:
        b=openpyxl.load_workbook(f, data_only=True, read_only=True)
        for ws in b.worksheets:
            # os erros do Excel («#DIV/0!») também ficam vazios
            rows=[[ ('' if isinstance(c,str) and c.startswith('#') and c.endswith(('!','?','A')) else c.isoformat()[:10] if isinstance(c,(datetime.date,datetime.datetime)) else c) for c in r] for r in ws.iter_rows(values_only=True)]
            out.append((ws.title, rows))
    return out
def limpa(v):
    if v is None: return ''
    if isinstance(v,float) and v.is_integer(): v=int(v)
    return str(v).strip()
if __name__=='__main__':
    for f in sys.argv[1:]:
        try: fs=linhas(f)
        except Exception as e: print('ERRO',f,e); continue
        for nome,rows in fs:
            rows=[[limpa(c) for c in r] for r in rows]
            rows=[r for r in rows if any(r)]
            nip=sum(1 for r in rows if any(re.fullmatch(r'I?\d{6,10}',c) for c in r))
            print(f'### {f} | folha «{nome}» | {len(rows)} linhas, {nip} com NIP')
            for r in rows[:7]: print('   ', ' | '.join(c for c in r if c)[:220])
