"""Compacta os CSVs do painel em .csv.gz (≈10x menores) antes de subir ao Supabase Storage.

Uso:  python compactar_csv.py PASTA_COM_OS_CSV
Gera, na mesma pasta, um .csv.gz para cada .csv. Suba os .gz no bucket "dados"
(substituindo os antigos). O painel lê o .gz automaticamente.
"""
import gzip, shutil, sys
from pathlib import Path

ESPERADOS = ["cards.csv", "kanban_titulos.csv", "pagadores.csv", "titulos_jan_jun.csv",
             "titulos_jul_dez.csv", "disciplinas.csv", "planos_alunos.csv"]

pasta = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
for csv in sorted(pasta.glob("*.csv")):
    destino = csv.with_suffix(".csv.gz")
    with open(csv, "rb") as ent, gzip.GzipFile(destino, "wb", compresslevel=9, mtime=0) as sai:
        shutil.copyfileobj(ent, sai)
    print(f"{csv.name:28s} {csv.stat().st_size/1e6:6.2f} MB  ->  {destino.stat().st_size/1e6:5.2f} MB")
faltando = [n for n in ESPERADOS if not (pasta / n).exists() and not (pasta / (n + ".gz")).exists()]
if faltando:
    print("\nAtenção: não encontrei", ", ".join(faltando))
