"""Genera la guía de poses de Otto Kols en PDF (A5) para ottokols.es/descargas/.
Uso: cd herramientas/guia-poses && python3 hacer_pdf.py [ruta_salida]"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
AQUI = pathlib.Path(__file__).resolve().parent
SALIDA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI.parent.parent / 'PortfolioOtto' / 'descargas' / 'guia-poses-otto-kols-r4m8.pdf'
async def main():
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto((AQUI / 'guia.html').as_uri()); await pg.wait_for_timeout(1200)
        await pg.pdf(path=str(SALIDA), prefer_css_page_size=True, print_background=True)
        await b.close()
    print(SALIDA, SALIDA.stat().st_size)
asyncio.run(main())
