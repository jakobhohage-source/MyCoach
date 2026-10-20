// Z3 Easing: Abspielen über die echte Bedienung (Wege per Maus ziehen, Play-Button, Pause, Stop, Phasen).
// Zusätzlich: Bildfolge als Sichtmaterial (nur wenn Z3_FRAMES_DIR gesetzt ist) und Export-Smoke-Test.
const { test, expect } = require('@playwright/test');
const { watchPage, expectNoProblems, openTestEnv, login } = require('./helpers');

const FRAMES_DIR = process.env.Z3_FRAMES_DIR;

test.describe('Zeichenboard Z3 Easing, echte Bedienung', () => {
  let problems;

  test.beforeEach(async ({ page }) => {
    problems = watchPage(page);
    await openTestEnv(page);
    await login(page);
    await page.click('.tb-link:has-text("Zeichenboard")');
    await page.click('#fp-half');
    await page.click('.fp-start-btn');
    await expect(page.locator('#boardOuter')).toBeVisible();
    await page.waitForFunction(() => boardInited && document.getElementById('drawCanvas').width > 0);
  });

  // Figur an feste Feldposition (Prozent) legen: Zufallspositionen wären nicht reproduzierbar.
  const place = (page, type, x, y) => page.evaluate(({ type, x, y }) => {
    const e = placeEntityAt(type, x, y);
    return e.id;
  }, { type, x, y });

  // Weg per Maus ziehen: Modus wählen, Figur anklicken, auf dem Canvas ziehen.
  async function drawMove(page, modeBtn, entityId, toPct) {
    await page.click(modeBtn);
    await page.click(`.field-entity[data-eid="${entityId}"]`);
    const box = await page.locator('#drawCanvas').boundingBox();
    const fp = await page.evaluate(() => fieldPx());
    const cv = await page.evaluate(() => ({ w: canvas.width, h: canvas.height }));
    const sx = box.width / cv.w, sy = box.height / cv.h;
    const tx = box.x + (fp.x + toPct.x / 100 * fp.w) * sx;
    const ty = box.y + (fp.y + toPct.y / 100 * fp.h) * sy;
    await page.mouse.move(tx - 40, ty - 20);
    await page.mouse.down();
    await page.mouse.move(tx - 10, ty - 5, { steps: 4 });
    await page.mouse.move(tx, ty, { steps: 4 });
    await page.mouse.up();
  }

  async function waitIdle(page, timeout = 20000) {
    await expect(page.locator('#pbPlay')).toHaveText('▶', { timeout });
  }

  test('Lauf per UI anlegen und abspielen: läuft durch, endet, Pause/Stop/erneut', async ({ page }) => {
    const a = await place(page, 'attacker', 20, 50);
    await drawMove(page, '#btn-run-mode', a, { x: 60, y: 50 });
    expect(await page.evaluate(() => movements.length)).toBe(1);
    const dur = await page.evaluate(() => movements[0].duration);

    // Durchlauf
    await page.click('#pbPlay');
    await expect(page.locator('#pbPlay')).toHaveText('⏸');
    await waitIdle(page, (dur + 6) * 1000);
    expect(await page.evaluate(() => pbPlaying)).toBe(false);

    // Pause mitten drin, Fortsetzen, Ende
    await page.click('#pbPlay');
    await page.waitForTimeout(Math.min(600, dur * 400));
    await page.click('#pbPlay'); // Pause (Toggle)
    const tPause = await page.evaluate(() => pbTime);
    expect(tPause).toBeGreaterThan(0);
    expect(await page.evaluate(() => pbPlaying)).toBe(false);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => pbTime)).toBeCloseTo(tPause, 5); // keine Bewegung in der Pause
    await page.click('#pbPlay');
    await waitIdle(page, (dur + 6) * 1000);

    // Zurücksetzen und erneut abspielen
    await page.click('#pbRewind');
    expect(await page.evaluate(() => pbTime)).toBe(0);
    await page.click('#pbPlay');
    await waitIdle(page, (dur + 6) * 1000);

    // Gesamtsequenz starten und per Stop-Button abbrechen, dann erneut bis zum Ende
    await page.click('#pbSeqBtn');
    await expect(page.locator('#pbSeqBtn')).toHaveText('⏹');
    await page.waitForTimeout(300);
    await page.click('#pbSeqBtn');
    await expect(page.locator('#pbSeqBtn')).toHaveText('⏭');
    await page.click('#pbSeqBtn');
    await expect(page.locator('#pbSeqBtn')).toHaveText('⏭', { timeout: (dur + 8) * 1000 });
    expectNoProblems(problems);
  });

  test('Mehrere gleichzeitige Bewegungen (2 Läufer + Ball) und zwei Phasen', async ({ page }) => {
    const a = await place(page, 'attacker', 15, 30);
    const d = await place(page, 'defender', 15, 70);
    const b = await place(page, 'ball', 50, 50);
    await drawMove(page, '#btn-run-mode', a, { x: 55, y: 30 });
    await drawMove(page, '#btn-run-mode', d, { x: 55, y: 70 });
    await drawMove(page, '#btn-ball-mode', b, { x: 85, y: 50 });
    expect(await page.evaluate(() => movements.length)).toBe(3);

    await page.click('#pbPlay');
    await waitIdle(page, 25000);

    // Phase 2 per Bedienung anlegen, dort einen weiteren Lauf
    await page.click('.board-phase-tab:has-text("+")');
    expect(await page.evaluate(() => boardPhases.length)).toBe(2);
    await drawMove(page, '#btn-run-mode', a, { x: 80, y: 30 });
    const r = await page.evaluate(() => {
      saveBoardPhaseState();
      const tl = buildGlobalTimeline();
      return { phases: tl.phaseStart.length, total: tl.total, movs: tl.movs.length };
    });
    expect(r.phases).toBe(2);
    expect(r.movs).toBe(4);
    await page.click('#pbSeqBtn');
    await expect(page.locator('#pbSeqBtn')).toHaveText('⏭', { timeout: (r.total + 8) * 1000 });
    // Sequenzende: Zustand wieder bedienbar
    expect(await page.evaluate(() => seqPlaying)).toBe(false);
    expectNoProblems(problems);
  });

  test('Sehr kurze Bewegung (2 Punkte, Mindestdauer): kein NaN, Endpunkt exakt', async ({ page }) => {
    const a = await place(page, 'attacker', 30, 50);
    await drawMove(page, '#btn-run-mode', a, { x: 34, y: 50 });
    const r = await page.evaluate(() => {
      const m = movements[0];
      const tl = buildGlobalTimeline();
      const pr = fieldPx();
      const mm = tl.movs[0];
      const out = [];
      for (let f = 0; f <= 1.0001; f += 0.1) {
        const p = entityPosAt(tl, m.entityId, mm.gStart + f * mm.dur, pr, 0);
        out.push(p);
      }
      const end = m.pts[m.pts.length - 1];
      return { n: m.pts.length, dur: m.duration, out, end };
    });
    r.out.forEach((p) => { expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); });
    const last = r.out[r.out.length - 1];
    expect(Math.hypot(last.x - r.end.x, last.y - r.end.y)).toBeLessThan(1);
    for (let i = 1; i < r.out.length; i++) expect(r.out[i].x).toBeGreaterThanOrEqual(r.out[i - 1].x - 1e-6);
    await page.click('#pbPlay');
    await waitIdle(page, 8000);
    expectNoProblems(problems);
  });

  test('Video-Export startet und endet ohne Fehler', async ({ page }) => {
    const a = await place(page, 'attacker', 20, 50);
    await drawMove(page, '#btn-run-mode', a, { x: 40, y: 50 });
    await page.evaluate(() => {
      // Dauer kurz halten, damit der Test schnell ist
      movements[0].duration = 1;
    });
    const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await page.evaluate(() => exportVideo());
    await expect(page.locator('#saveProgress')).toContainText('Video', { timeout: 5000 });
    const dl = await download;
    expect(dl, 'Export hat keinen Download ausgelöst').not.toBeNull();
    expectNoProblems(problems);
  });

  (FRAMES_DIR ? test : test.skip)('Bildfolge Lauf und Pass (Sichtmaterial)', async ({ page }) => {
    const a = await place(page, 'attacker', 15, 35);
    const b = await place(page, 'ball', 15, 70);
    await drawMove(page, '#btn-run-mode', a, { x: 80, y: 35 });
    await drawMove(page, '#btn-ball-mode', b, { x: 80, y: 70 });
    await page.evaluate(() => { movements.forEach((m) => { m.duration = 4; m.startTime = 0; }); pbDuration = 4; });
    await page.selectOption('#pbSpeed', '0.5');
    await page.click('#pbPlay');
    const shots = [];
    // Frames bei festen Abspielzeiten: Wiedergabe jeweils anhalten, Bild machen, fortsetzen ist zu grob;
    // stattdessen pbTick manuell auf definierte Zeiten stellen.
    await page.evaluate(() => { pbStop(); });
    const times = [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0];
    for (const t of times) {
      await page.evaluate((t) => {
        const raf = window.requestAnimationFrame;
        window.requestAnimationFrame = () => 0;
        pbPlaying = true; pbTime = t; pbLastTS = 1000;
        document.getElementById('pbSpeed').value = '1';
        pbTick(1000);
        pbPlaying = false;
        window.requestAnimationFrame = raf;
      }, t);
      const p = `${FRAMES_DIR}/frame-t${t.toFixed(1)}.png`;
      await page.locator('#boardOuter').screenshot({ path: p });
      shots.push(p);
    }
    expect(shots.length).toBe(times.length);
    expectNoProblems(problems);
  });
});
