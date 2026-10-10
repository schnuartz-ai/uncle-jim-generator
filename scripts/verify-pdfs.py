"""Render real PDF pages and export real address-QR pixels for independent decoding."""
import json
from pathlib import Path
import pypdfium2 as pdfium
from pypdf import PdfReader
import pdfplumber

GRID_COLUMNS = 5
GRID_ROWS = 5
GRID_CAPACITY = GRID_COLUMNS * GRID_ROWS
GRID_START_X_MM = 20
GRID_START_Y_MM = 83
CELL_WIDTH_MM = 34
ROW_GAP_MM = 27
QR_SIZE_MM = 20.5

out = Path('output/qa')
out.mkdir(parents=True, exist_ok=True)
report = []
for file in sorted(Path('output/pdf').glob('*.pdf')):
    model_file = file.with_suffix('.json')
    if not model_file.exists():
        continue
    wallet = json.loads(model_file.read_text(encoding='utf-8'))
    reader = PdfReader(file)
    text = '\n'.join(page.extract_text() for page in reader.pages)
    compact = ''.join(text.split())
    assert 'FamilyWallet' in compact, file
    assert ''.join(wallet['descriptor'].split()) in compact, file
    assert 'Watch-Only' in compact, file
    assert 'GrüßeausKöln' in compact, file
    for address in wallet['addresses']:
        assert address['address'] in compact, (file, address)
    rendered = pdfium.PdfDocument(str(file))
    target = out / file.stem
    target.mkdir(exist_ok=True)
    qrs = []
    with pdfplumber.open(file) as layout:
        for page_index, page in enumerate(layout.pages):
            assert abs(float(page.width) * 25.4/72 - 210) < .05
            assert abs(float(page.height) * 25.4/72 - 297) < .05
            for char in page.chars:
                assert char['x0'] >= 0 and char['x1'] <= page.width + .1, (file, char['text'], 'horizontal overflow')
                assert char['top'] >= 0 and char['bottom'] <= page.height, (file, char['text'], 'vertical overflow')
            if page_index < (len(wallet['addresses'])+GRID_CAPACITY-1)//GRID_CAPACITY:
                rectangles = [r for r in page.rects if abs(r['width']*25.4/72-170)<.05 and abs(r['height']*25.4/72-200)<.05]
                assert rectangles, (file, 'missing exact 170 x 200 cut outline')
                blue_lines = [line for line in page.lines if line['stroking_color'] and len(line['stroking_color']) >= 3 and line['stroking_color'][:3] == (0.12, 0.6, 0.9) and abs(line['top']-line['bottom']) < .1]
                logo_words = [word for word in page.extract_words() if word['text'] in {'CLAVASTACK', 'UNCLE', 'JIM', 'WALLET'} and word['top'] < 100]
                assert len(blue_lines) == 1 and logo_words, (file, 'missing short brand underline')
                blue = blue_lines[0]
                assert blue['x1']-blue['x0'] < 180, (file, 'brand underline is not short')
                assert abs(blue['x1']-max(word['x1'] for word in logo_words)) < 1, (file, 'brand underline does not end under the brand text')
                strip = page.crop((0, 229*72/25.4, page.width, page.height)).extract_text() or ''
                assert 'Family Wallet' not in strip and 'xpub' not in strip and 'bc1' not in strip, (file,'wallet data on discarded strip')
    for i in range(len(rendered)):
        rendered[i].render(scale=1.5).to_pil().save(target/f'page-{i+1}.png')
    scale = 300/72
    mm = 300/25.4
    pages = {}
    for i, address in enumerate(wallet['addresses']):
        p = i//GRID_CAPACITY
        if p not in pages:
            pages[p]=rendered[p].render(scale=scale).to_pil().convert('RGBA')
        local = i%GRID_CAPACITY
        x=(GRID_START_X_MM+(local%GRID_COLUMNS)*CELL_WIDTH_MM+(CELL_WIDTH_MM-QR_SIZE_MM)/2)*mm
        y=(GRID_START_Y_MM+(local//GRID_COLUMNS)*ROW_GAP_MM)*mm
        crop=pages[p].crop((round(x),round(y),round(x+QR_SIZE_MM*mm),round(y+QR_SIZE_MM*mm)))
        raw=target/f'qr-{i}.rgba'
        raw.write_bytes(crop.tobytes())
        qrs.append({'file':str(raw),'width':crop.width,'height':crop.height,'expected':address['address']})
    descriptor_crop=pages[0].crop((round(136*mm),round(23*mm),round((136+48)*mm),round((23+48)*mm)))
    descriptor_raw=target/'qr-wallet-descriptor.rgba'
    descriptor_raw.write_bytes(descriptor_crop.tobytes())
    qrs.append({'file':str(descriptor_raw),'width':descriptor_crop.width,'height':descriptor_crop.height,'expected':wallet['descriptor']})
    # Product links are decoded from the real removable strip, not source matrices.
    image=pages[0]
    for product,x in [('debasafetueten',143),('backup-stack',169)]:
        crop=image.crop((round(x*mm),round(242*mm),round((x+20)*mm),round(262*mm)))
        raw=target/f'{product}.rgba';raw.write_bytes(crop.tobytes())
        prefix='/de' if file.stem.endswith('-de') else ''
        qrs.append({'file':str(raw),'width':crop.width,'height':crop.height,'expected':f'https://clavastack.com{prefix}/products/{product}'})
    report.append({'fixture':file.stem,'pages':len(reader.pages),'addressCount':len(wallet['addresses']),'qrs':qrs})
    print(f'{file.name}: A4 bounds, exact descriptors, address text, Unicode and trim geometry verified')
(out/'qr-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
