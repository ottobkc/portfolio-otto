"""Genera el PDF de la guía y la imagen de portada para /guia/.
Uso: cd herramientas/guia && python3 hacer_pdf.py"""
import asyncio, pathlib
from playwright.async_api import async_playwright
AQUI = pathlib.Path(__file__).resolve().parent
MD = AQUI.parent.parent / 'MirarDespacio'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 560, 'height': 794}, device_scale_factor=2)
        await pg.goto((AQUI / 'guia.html').as_uri()); await pg.wait_for_timeout(800)
        await pg.pdf(path=str(MD / 'descargas' / '10-ejercicios-mirar-despacio-k7q2.pdf'), prefer_css_page_size=True, print_background=True)
        el = pg.locator('.portada')
        await el.screenshot(path=str(AQUI / 'portada.png'))
        await b.close()
    from PIL import Image
    Image.open(AQUI / 'portada.png').convert('RGB').resize((760, 1077), Image.LANCZOS).save(MD / 'assets' / 'guia-portada.jpg', quality=86)
asyncio.run(main())
