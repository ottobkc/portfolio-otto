"""Genera los PDF de las chuletas A6 (con sangrado) a partir de los .html de esta carpeta.
Uso: cd herramientas/chuletas && python3 hacer_pdf.py"""
import asyncio, pathlib
from playwright.async_api import async_playwright
AQUI = pathlib.Path(__file__).resolve().parent
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for h in sorted(AQUI.glob('*.html')):
            pg = await b.new_page()
            await pg.goto(h.as_uri()); await pg.wait_for_timeout(800)
            await pg.pdf(path=str(AQUI / f'chuleta-{h.stem}-A6-sangrado.pdf'), prefer_css_page_size=True, print_background=True)
            await pg.close()
        await b.close()
asyncio.run(main())
