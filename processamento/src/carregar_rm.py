# Lê as extrações "Lançamentos à Receber" do RM (1º e 2º semestre) e junta em novo_raw.pkl
from openpyxl import load_workbook
import pandas as pd, json
import zipfile, csv, datetime, re
DATAS={'Data de Previsão de Baixa','Mês de Competência','Data de Emissão','Data de Vencimento','Data de Baixa','Data de Criação','Data de Alteração','Empréstimo (Venc. Anterior)','Data de Cancelamento','Data de Pagamento'}
INTS={'Ref. Lançamento','Filial','Coligada do Cli/For','Parcela a Pagar','Cota a Pagar','Coligada da Conta/Caixa','Número de Bloqueios','Ref. do Dado Original','Lançamento Efetuado com Desconto','Convênio','Coligada do Convenio','Tipo dos Juros ao Dia','Dias de Carência para Juros','Dias em Atraso'}
BOOLS={'Permite a Edição de Lançamento','Liberação Autorizada','Lançamento Já Foi Impresso em Uma Ap.'}
NUM=re.compile(r'^-?[\d.]+,\d+$')
def _conv(col,v):
    if v=='' : return None
    if col in DATAS:
        m=re.match(r'^(\d{2})/(\d{2})/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$',v)
        if m:
            d,mo,y,H,M,S=m.groups(); return datetime.datetime(int(y),int(mo),int(d),int(H or 0),int(M or 0),int(S or 0))
        m=re.match(r'^(\d{2})/(\d{4})$',v)
        if m: return datetime.datetime(int(m.group(2)),int(m.group(1)),1)
        return v
    if col in BOOLS: return 1 if v.lower()=='true' else 0 if v.lower()=='false' else v
    if col in INTS:
        try: return int(v)
        except: return v
    if NUM.match(v):
        x=float(v.replace('.','').replace(',','.'))
        return int(x) if x==int(x) else x
    return v
def ler_csv_rm(f):
    with open(f,encoding='latin1',newline='') as fh:
        rd=csv.reader(fh,delimiter=';'); h=next(rd)
        rows=[[_conv(h[i],c) for i,c in enumerate(r)] for r in rd if any(x.strip() for x in r)]
    return h,rows

arquivos=json.loads('''{{RM_FILES}}''')
dfs=[]
for f in arquivos:
    if not zipfile.is_zipfile(f):
        h,body=ler_csv_rm(f); seen={}
        for i,c in enumerate(h):
            if c in seen: h[i]=f'{c}_{i}'
            seen[c]=1
        d=pd.DataFrame(body,columns=h); d['_arq']=f[-12:]; dfs.append(d)
        print(f.split('/')[-1],'(csv)',len(body),'linhas'); continue
    wb=load_workbook(f,read_only=True,data_only=True)
    for ws in wb.worksheets:
        if ws.title=='Sheet2': continue
        rows=list(ws.iter_rows(values_only=True))
        if not rows: continue
        h=list(rows[0]); seen={}
        for i,c in enumerate(h):
            if c in seen: h[i]=f'{c}_{i}'
            seen[c]=1
        d=pd.DataFrame(rows[1:],columns=h); d['_arq']=f[-12:]; dfs.append(d)
        print(f.split('/')[-1],ws.title,len(rows)-1,'linhas')
    wb.close()
df=pd.concat(dfs,ignore_index=True)
# as extrações 1S e 2S se sobrepõem (ex.: emitido em jun, vence em jul): o mesmo lançamento vem nas duas
_n=len(df); df=df.drop_duplicates('Ref. Lançamento',keep='last').reset_index(drop=True)
print('duplicados entre extrações (removidos):',_n-len(df))
# o painel trabalha com títulos de vencimento em 2026 (jan–dez), como na base original
_v=pd.to_datetime(df['Data de Vencimento'],errors='coerce')
_fora=((_v<'2026-01-01')|(_v>'2026-12-31 23:59')).sum()
df=df[~((_v<'2026-01-01')|(_v>'2026-12-31 23:59'))].reset_index(drop=True)
print('fora de 2026 (descartados):',_fora)
# a 2ª coluna "Situação da Parcela" (texto: ACORDO, ENV. CAPER...) é a usada nas regras
if 'Situação da Parcela_113' not in df.columns:
    dup=[c for c in df.columns if str(c).startswith('Situação da Parcela_')]
    if dup: df=df.rename(columns={dup[0]:'Situação da Parcela_113'})
falt=[c for c in ['Ref. Lançamento','Nome','Histórico','Situação da Parcela_113','Desconto condicional','Imagem - Status','Status Cnab'] if c not in df.columns]
if falt: raise SystemExit('Colunas obrigatórias ausentes na extração: '+', '.join(falt))
df.to_pickle('{{WORK}}/novo_raw.pkl')
print('total',df.shape)
