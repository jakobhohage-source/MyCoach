// Regressionsschutz: Beim Ziehen von Ball und Hütchen im Zeichenboard dürfen keine Reste
// (Streifen von Objekt oder Schatten) an alten Positionen zurückbleiben. Der Fehler trat in
// Safari auf dem Mac auf; in Playwright (Chromium und WebKit) ist er nicht reproduzierbar,
// der Test schützt daher nur vor sichtbaren Rückständen. Läuft in beiden Projekten
// (siehe playwright.config.js). Es werden keine Daten gespeichert.
const { test, expect } = require('@playwright/test');
const { watchPage, expectNoProblems, openTestEnv, login } = require('./helpers');

// Retina-Auflösung wie auf dem Mac, dort trat der Fehler auf
test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });

const MARGIN = 12; // CSS-px um die Objekt-Box: deckt den Schatten (blur 6-10px) ab

for (const { name, btn, sel } of [
  { name: 'Ball', btn: '#btn-add-ball', sel: '.fe-ball' },
  { name: 'Hütchen', btn: '#btn-add-cone', sel: '.fe-cone' },
]) {
  test(`Zeichenboard: ${name} ziehen hinterlässt keine Reste`, async ({ page }) => {
    const problems = watchPage(page);
    await openTestEnv(page);
    await login(page);
    await page.click('.tb-link:has-text("Zeichenboard")');
    await page.click('#fp-half');
    await page.click('.fp-start-btn');
    await page.waitForFunction(() => boardInited && document.getElementById('drawCanvas').width > 0);
    await page.click(btn);
    await expect(page.locator(`#playerLayer ${sel}`)).toHaveCount(1);
    // Toast ("platziert") liegt evtl. im Bildausschnitt und würde das Ergebnis verfälschen
    await page.addStyleTag({ content: '#toastEl{visibility:hidden !important}' });

    const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const ent = page.locator('#playerLayer .field-entity').first();
    const area = await page.locator('#boardArea').boundingBox();
    const field = await page.locator('#playerLayer').boundingBox();
    const startBox = await ent.boundingBox();
    const sx = startBox.x + startBox.width / 2, sy = startBox.y + startBox.height / 2;

    // Referenz vor dem Ziehen: Board ohne Objekt
    await ent.evaluate((el) => { el.style.visibility = 'hidden'; });
    await frames();
    const base = await page.screenshot({ clip: area });
    await ent.evaluate((el) => { el.style.visibility = 'visible'; });

    // In vielen kleinen Schritten quer über das Feld ziehen
    const tx = field.x + field.width * (sx < field.x + field.width / 2 ? 0.85 : 0.15);
    const ty = field.y + field.height * (sy < field.y + field.height / 2 ? 0.8 : 0.2);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 40 });
    await page.mouse.up();
    await frames();

    // Objekt steht an der neuen Position
    const endBox = await ent.boundingBox();
    expect(Math.abs(endBox.x + endBox.width / 2 - tx)).toBeLessThan(3);
    expect(Math.abs(endBox.y + endBox.height / 2 - ty)).toBeLessThan(3);

    // Direkt danach, Objekt sichtbar: Pixel außerhalb von Start- und Endbox (+ Rand) müssen
    // der Referenz entsprechen. Boxen relativ zum Clip, in CSS-px.
    const after = await page.screenshot({ clip: area });
    const rel = (b) => ({ x0: b.x - area.x - MARGIN, y0: b.y - area.y - MARGIN, x1: b.x - area.x + b.width + MARGIN, y1: b.y - area.y + b.height + MARGIN });
    const diff = await page.evaluate(async ([a, b, boxes, dpr]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [A, B] = await Promise.all([load(a), load(b)]);
      const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
      const da = px(A), db = px(B);
      let n = 0;
      for (let y = 0; y < A.height; y++) {
        for (let x = 0; x < A.width; x++) {
          const cx = x / dpr, cy = y / dpr;
          if (boxes.some((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1)) continue;
          const i = (y * A.width + x) * 4;
          if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 8) n++;
        }
      }
      return n;
    }, [base.toString('base64'), after.toString('base64'), [rel(startBox), rel(endBox)], 2]);
    // Schwelle 0: Das Board ist statisch, jeder abweichende Pixel wäre ein Rest.
    expect(diff, `Restpixel von ${name} außerhalb der Objekt-Box`).toBe(0);
    expectNoProblems(problems);
  });
}
