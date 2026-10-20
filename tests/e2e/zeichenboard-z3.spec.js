// Z3 Easing im Zeichenboard. Es werden keine Daten gespeichert, daher kein Aufräumen nötig.
// Bewegungen werden bewusst über den App-Zustand (movements) angelegt statt per Maus: Das Zeichnen
// per UI erzeugt zufällige Dauern und braucht Mausfahrten über Spieler; für exakte Wege (Geraden,
// feste Dauer) wäre das fragil. Das Objekt hat dieselbe Form wie das, was die UI anlegt.
// Positionen werden über buildGlobalTimeline()/entityPosAt() zu festen Zeitpunkten gelesen.
const { test, expect } = require('@playwright/test');
const { watchPage, expectNoProblems, openTestEnv, login } = require('./helpers');

test.describe('Zeichenboard Z3 Easing', () => {
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
    await page.click('#btn-add-att');
    await page.click('#btn-add-def');
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(2);
  });

  // Legt Bewegungen an: Läufer = Entity 0, Ball-Quelle = Entity 1.
  const setMovs = (page, defs) => page.evaluate((defs) => {
    movements = defs.map((d, i) => ({
      id: i + 1, entityId: entities[d.who].id, startPtSnap: d.pts[0], pts: d.pts,
      color: '#f0bc2e', type: d.type, ballSubType: null, pathType: 'straight', duration: d.dur, startTime: 0,
    }));
    return true;
  }, defs);

  // Weganteil (0..1) der Entity entlang x (Geraden in x-Richtung) zu den Zeitanteilen
  const sample = (page, who, fracs, x0, x1) => page.evaluate(({ who, fracs, x0, x1 }) => {
    const tl = buildGlobalTimeline();
    const m = tl.movs.find((mm) => mm.entityId === entities[who].id);
    const pr = { x: 0, y: 0, w: 100, h: 100 };
    return {
      total: tl.total,
      dur: m.dur,
      vals: fracs.map((f) => (entityPosAt(tl, entities[who].id, m.gStart + f * m.dur, pr, 0).x - x0) / (x1 - x0)),
    };
  }, { who, fracs, x0, x1 });

  const RUN = [{ x: 100, y: 300 }, { x: 500, y: 300 }];

  test('Lauf: sanftes Anlaufen und Auslaufen, Dauer und Endpunkte unverändert (Kriterien 1, 2, 4, 5)', async ({ page }) => {
    await setMovs(page, [{ who: 0, type: 'run', pts: RUN, dur: 4 }]);
    const r = await sample(page, 0, [0, 0.25, 0.5, 0.75, 1], 100, 500);
    expect(r.vals[0]).toBeCloseTo(0, 3);
    expect(r.vals[1]).toBeLessThan(0.25);
    expect(r.vals[2]).toBeGreaterThan(0.48);
    expect(r.vals[2]).toBeLessThan(0.52);
    expect(r.vals[3]).toBeGreaterThan(0.75);
    expect(r.vals[4]).toBeCloseTo(1, 3); // 1 px = 0,0025
    // Dauer/total unverändert: Dauer 4 s + Nachlauf 1,1 s
    expect(r.dur).toBeCloseTo(4, 2);
    expect(r.total).toBeCloseTo(5.1, 1);

    // Geschwindigkeit: Mitte mindestens doppelt so schnell wie an den Enden
    const f = 0.01;
    const s = await sample(page, 0, [0, f, 0.5 - f / 2, 0.5 + f / 2, 1 - f, 1], 100, 500);
    const startStep = s.vals[1] - s.vals[0];
    const midStep = s.vals[3] - s.vals[2];
    const endStep = s.vals[5] - s.vals[4];
    expect(midStep).toBeGreaterThan(2 * startStep);
    expect(midStep).toBeGreaterThan(2 * endStep);
    expectNoProblems(problems);
  });

  test('Pass: schnell am Anfang, läuft am Ende aus, andere Kurve als der Lauf (Kriterium 3)', async ({ page }) => {
    await setMovs(page, [{ who: 1, type: 'ballpath', pts: RUN, dur: 2 }]);
    const r = await sample(page, 1, [0, 0.25, 0.5, 1], 100, 500);
    expect(r.vals[1]).toBeGreaterThan(0.25 + 0.05); // Lauf-Kurve läge bei ca. 0,15
    expect(r.vals[3]).toBeCloseTo(1, 3);
    const f = 0.01;
    const s = await sample(page, 1, [0, f, 0.5, 0.5 + f, 1 - f, 1], 100, 500);
    const startStep = s.vals[1] - s.vals[0];
    const midStep = s.vals[3] - s.vals[2];
    const endStep = s.vals[5] - s.vals[4];
    expect(startStep).toBeGreaterThan(midStep);
    expect(midStep).toBeGreaterThan(endStep);
    expect(endStep).toBeLessThan(startStep / 10);
    expectNoProblems(problems);
  });

  test('Mehrpunkt-Weg: Position bleibt auf dem Weg, Endpunkt exakt (Kriterium 5, Edge Cases)', async ({ page }) => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ x: 100 + i * 100, y: 300 }));
    await setMovs(page, [{ who: 0, type: 'run', pts, dur: 0.8 }]);
    const r = await sample(page, 0, [0, 0.1, 0.3, 0.6, 0.9, 1, 1.5], 100, 500);
    r.vals.forEach((v) => { expect(Number.isFinite(v)).toBe(true); });
    for (let i = 1; i < r.vals.length; i++) expect(r.vals[i]).toBeGreaterThanOrEqual(r.vals[i - 1] - 1e-9);
    expect(r.vals[5]).toBeCloseTo(1, 3);
    expect(r.vals[6]).toBeCloseTo(1, 3);
    expectNoProblems(problems);
  });

  // Ball endet 10 px neben dem Laufweg bei Wegteil s. Der Läufer (Weg 400 px, 5 s) erreicht den
  // Abfangpunkt bei Zeitanteil s, also nach 5*s Sekunden; der Ball braucht ebenso lang.
  // Mit Ballannahme läuft die Kurve auf dem gekürzten Weg: sanfter Stopp statt Kappung bei Höchsttempo.
  for (const s of [0.25, 0.5, 0.75]) {
    test(`Ballannahme bei Wegteil ${s}: Treffpunkt, sanfter Stopp, total unverändert (Kriterium 4, 6)`, async ({ page }) => {
      const px = 100 + 400 * s;
      const tStop = 5 * s;
      await setMovs(page, [
        { who: 0, type: 'run', pts: RUN, dur: 5 },
        { who: 1, type: 'ballpath', pts: [{ x: px, y: 50 }, { x: px, y: 310 }], dur: tStop },
      ]);
      const r = await page.evaluate((tStop) => {
        const tl = buildGlobalTimeline();
        const pr = { x: 0, y: 0, w: 100, h: 100 };
        const run = tl.movs.find((m) => m.type === 'run');
        const at = (i, t) => entityPosAt(tl, entities[i].id, t, pr, 0);
        const rp = at(0, tStop), bp = at(1, tStop);
        const dt = 0.05;
        return {
          stopFrac: run.stopFrac, total: tl.total,
          dist: Math.hypot(rp.x - bp.x, rp.y - bp.y),
          lateX: at(0, tStop + 1).x,
          endStep: at(0, tStop).x - at(0, tStop - dt).x,
          startStep: at(0, dt).x - at(0, 0).x,
          maxStep: Math.max(...Array.from({ length: 40 }, (_, i) => at(0, tStop * (i + 1) / 40).x - at(0, tStop * i / 40).x)),
        };
      }, tStop);
      expect(r.stopFrac).toBeCloseTo(s, 3);
      expect(r.dist).toBeLessThanOrEqual(10 + 5);
      expect(r.lateX).toBeCloseTo(px, 0); // läuft nicht über den Abfangpunkt hinaus
      // Vorher (linear): max(Läufer 5*s ; Ball 5*s) + 1,1
      expect(r.total).toBeCloseTo(tStop + 1.1, 1);
      // Sanfter Stopp: Schritt in den letzten 0,05 s deutlich kleiner als das Tempo in der Mitte
      expect(r.endStep).toBeLessThan(r.maxStep * 0.05 / (tStop / 40) * 0.3);
      expect(r.startStep).toBeLessThan(r.maxStep * 0.05 / (tStop / 40) * 0.3);
      expectNoProblems(problems);
    });
  }

  test('Einzelphase (pbTick) und Sequenz zeigen dieselben Positionen (Kriterium 7)', async ({ page }) => {
    await setMovs(page, [{ who: 0, type: 'run', pts: RUN, dur: 4 }]);
    const res = await page.evaluate(() => {
      const out = [];
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0; // pbTick manuell mit eigenen Zeitstempeln treiben
      const origDraw = window.drawBoardEntity;
      let lastDraw = null;
      window.drawBoardEntity = (c, ent, x, y) => { lastDraw = { x, y }; return origDraw(c, ent, x, y); };
      const tl = buildGlobalTimeline();
      const pr = { x: 0, y: 0, w: 100, h: 100 };
      updatePlaybackUI();
      for (const f of [0.25, 0.5, 0.75]) {
        pbTime = 0; pbPlaying = true; pbLastTS = 1000;
        document.getElementById('pbSpeed').value = '1';
        pbTick(1000 + f * 4 * 1000);
        const seq = entityPosAt(tl, entities[0].id, f * 4, pr, 0);
        out.push({ f, pb: lastDraw.x, seq: seq.x });
        pbStop();
      }
      window.drawBoardEntity = origDraw;
      window.requestAnimationFrame = origRaf;
      return out;
    });
    res.forEach((o) => { expect(Math.abs(o.pb - o.seq)).toBeLessThan(1); });
    expectNoProblems(problems);
  });

  test('Video-Export und Sequenz-Wiedergabe: keine Konsolenfehler (Kriterium 9)', async ({ page }) => {
    await setMovs(page, [{ who: 0, type: 'run', pts: RUN, dur: 1 }]);
    await page.evaluate(() => playFullSequence());
    await page.waitForTimeout(600);
    await page.evaluate(() => stopFullSequence());
    // drawGlobalFrame wird vom Export geteilt: mehrere Frames direkt zeichnen
    await page.evaluate(() => {
      const tl = buildGlobalTimeline();
      const pr = fieldPx();
      for (let t = 0; t <= tl.total; t += 0.1) drawGlobalFrame(animCtx, pr, tl, t);
    });
    expectNoProblems(problems);
  });
});
