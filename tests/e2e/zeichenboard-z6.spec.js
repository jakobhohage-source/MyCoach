// Zeichenboard Z6: Objekte per Tap-to-place setzen (Maus und Touch). Testdaten werden nicht gespeichert;
// der Marker und das Aufräumen sichern ab, falls doch etwas in der Datenbank landet.
const { test, expect } = require('@playwright/test');
const {
  makeMarker, watchPage, expectNoProblems, openTestEnv, login, cleanupByMarker,
} = require('./helpers');

const POINTS = [[20, 30], [50, 50], [80, 70]];

async function openBoard(page) {
  await page.click('.tb-link:has-text("Zeichenboard")');
  await page.click('#fp-half');
  await page.click('.fp-start-btn');
  await expect(page.locator('#boardOuter')).toBeVisible();
  await page.waitForFunction(() => boardInited && document.getElementById('drawCanvas').width > 0);
}

const state = (page) => page.evaluate(() => ({
  entities: entities.map((e) => ({ type: e.type, x: e.x, y: e.y })),
  paths: paths.length,
  placeType,
}));

function suite(title, contextOptions, tap) {
  test.describe(title, () => {
    let marker;
    let problems;
    test.use(contextOptions);

    test.beforeEach(async ({ page }) => {
      marker = makeMarker('z6');
      problems = watchPage(page);
      await openTestEnv(page);
      await login(page);
      await openBoard(page);
    });
    test.afterEach(async ({ page }) => {
      await cleanupByMarker(page, marker);
    });

    // Seitenkoordinaten eines Feldpunkts (Feld-Prozent im #playerLayer)
    async function pt(page, px, py) {
      const b = await page.locator('#playerLayer').boundingBox();
      return { x: b.x + b.width * px / 100, y: b.y + b.height * py / 100 };
    }
    async function tapField(page, px, py) {
      const p = await pt(page, px, py);
      await tap(page, p.x, p.y);
    }

    test('3 Taps setzen 3 Objekte an den getippten Stellen, Werkzeug bleibt aktiv', async ({ page }) => {
      const btn = page.locator('#btn-add-att');
      await btn.click();
      await expect(btn).toHaveClass(/\bon\b/);
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#modePill')).toContainText('Platzieren: Angreifer');
      await expect(page.locator('#bsHint')).toContainText('setzen');
      expect((await state(page)).entities).toHaveLength(0); // Button allein setzt nichts

      for (const [x, y] of POINTS) await tapField(page, x, y);
      const s = await state(page);
      expect(s.entities).toHaveLength(3);
      POINTS.forEach(([x, y], i) => {
        expect(Math.abs(s.entities[i].x - x)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.entities[i].y - y)).toBeLessThanOrEqual(1);
      });
      expect(s.paths).toBe(0); // keine Linie beim Platzieren
      await expect(btn).toHaveClass(/\bon\b/);
      await expect(page.locator('#bsStats')).toContainText('Objekte: 3');
      expectNoProblems(problems);
    });

    test('Beenden per Button, Werkzeugwechsel und Esc', async ({ page }) => {
      const btn = page.locator('#btn-add-att');
      // erneuter Klick auf denselben Button
      await btn.click();
      await btn.click();
      await expect(btn).not.toHaveClass(/\bon\b/);
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#modePill')).toHaveText('Zeichnen');
      await tapField(page, 40, 40);
      expect((await state(page)).entities).toHaveLength(0);

      // Werkzeugwechsel (Zeichenwerkzeug)
      await btn.click();
      await page.click('#tool-line');
      await expect(btn).not.toHaveClass(/\bon\b/);
      await tapField(page, 40, 40);
      expect((await state(page)).entities).toHaveLength(0);

      // Wechsel auf anderes Objekt-Werkzeug
      await btn.click();
      await page.click('#btn-add-ball');
      await expect(btn).not.toHaveClass(/\bon\b/);
      await expect(page.locator('#btn-add-ball')).toHaveClass(/\bon\b/);
      await page.click('#btn-run-mode');
      await expect(page.locator('#btn-add-ball')).not.toHaveClass(/\bon\b/);

      // Esc (nur mit Tastatur sinnvoll, gilt auch im Touch-Kontext mit Tastaturereignis)
      await btn.click();
      await page.keyboard.press('Escape');
      await expect(btn).not.toHaveClass(/\bon\b/);
      await expect(page.locator('#modePill')).toHaveText('Zeichnen');
      await tapField(page, 40, 40);
      expect((await state(page)).entities).toHaveLength(0);

      // Esc im Namensfeld beendet das Platzieren nicht
      await btn.click();
      await page.focus('#playerNameInput');
      await page.keyboard.press('Escape');
      await expect(btn).toHaveClass(/\bon\b/);
      expectNoProblems(problems);
    });

    test('Tap auf vorhandenes Objekt setzt nichts Neues, danach Pfeil zeichnen', async ({ page }) => {
      await page.click('#btn-add-def');
      await tapField(page, 30, 40);
      await tapField(page, 70, 40);
      expect((await state(page)).entities).toHaveLength(2);
      // Tap mitten auf das erste Objekt
      const c = await page.locator('#playerLayer .field-entity').first().boundingBox();
      await tap(page, c.x + c.width / 2, c.y + c.height / 2);
      expect((await state(page)).entities).toHaveLength(2);

      // beenden, dann Pfeil ziehen (Maus/Pointer-Ereignisse)
      await page.click('#btn-add-def');
      const a = await pt(page, 20, 85);
      const b = await pt(page, 60, 85);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => (await state(page)).paths).toBe(1);
      expect((await state(page)).entities).toHaveLength(2);
      expectNoProblems(problems);
    });

    // ---- Erweiterung: alle Objekt-Werkzeuge, Verschieben, Speichern/Öffnen, Vorlagen ----
    const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

    test('Torwart, Hütchen, Stange, Ball, Pylone setzen an der Tap-Position', async ({ page }) => {
      const tools = [['gk', '#btn-add-gk', 15, 20], ['cone', '#btn-add-cone', 35, 25], ['pole', '#btn-add-pole', 55, 35],
        ['ball', '#btn-add-ball', 75, 45], ['pylon', '#btn-add-pylon', 40, 75]];
      for (const [, id, x, y] of tools) {
        await page.click(id);
        await expect(page.locator(id)).toHaveAttribute('aria-pressed', 'true');
        await tapField(page, x, y);
      }
      const s = await state(page);
      expect(s.entities.map((e) => e.type)).toEqual(tools.map((t) => t[0]));
      tools.forEach(([, , x, y], i) => {
        expect(near(s.entities[i].x, x), 'x ' + tools[i][0] + ' ' + s.entities[i].x).toBe(true);
        expect(near(s.entities[i].y, y), 'y ' + tools[i][0] + ' ' + s.entities[i].y).toBe(true);
      });
      // 2 Hütchen hintereinander: keine Ketten-Zufallslogik
      await page.click('#btn-add-cone');
      await tapField(page, 10, 90);
      await tapField(page, 30, 90);
      const c = (await state(page)).entities.slice(-2);
      expect(near(c[0].x, 10) && near(c[0].y, 90) && near(c[1].x, 30) && near(c[1].y, 90)).toBe(true);
      expectNoProblems(problems);
    });

    test('Gruppe: Dialog, dann ein Tap setzt die Gruppe an der Stelle, Modus endet', async ({ page }) => {
      await page.click('#btn-add-group');
      await expect(page.locator('#groupDialogOverlay')).toBeVisible();
      await page.click('#groupDialogOverlay .gd-btn.ok');
      await expect(page.locator('#groupDialogOverlay')).toBeHidden();
      expect((await state(page)).entities).toHaveLength(0);
      await expect(page.locator('#modePill')).toContainText('Platzieren: Gruppe');
      await tapField(page, 65, 55);
      let s = await state(page);
      expect(s.entities).toHaveLength(1);
      expect(s.entities[0].type).toBe('group');
      expect(near(s.entities[0].x, 65) && near(s.entities[0].y, 55)).toBe(true);
      expect(s.placeType).toBeNull();
      await expect(page.locator('#btn-add-group')).not.toHaveClass(/\bon\b/);
      await tapField(page, 30, 30); // zweiter Tap setzt nichts mehr
      expect((await state(page)).entities).toHaveLength(1);
      expectNoProblems(problems);
    });

    test('Verschieben eines vorhandenen Objekts im Platzier-Modus', async ({ page }) => {
      await page.click('#btn-add-att');
      await tapField(page, 30, 40);
      await tapField(page, 70, 40);
      const before = (await state(page)).entities;
      const el = await page.locator('#playerLayer .field-entity').first().boundingBox();
      const to = await pt(page, 45, 75);
      await page.mouse.move(el.x + el.width / 2, el.y + el.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
      const s = await state(page);
      expect(s.entities).toHaveLength(2);
      expect(Math.hypot(s.entities[0].x - before[0].x, s.entities[0].y - before[0].y)).toBeGreaterThan(10);
      expect(s.entities[1].x).toBeCloseTo(before[1].x, 1);
      expect(s.placeType).toBe('attacker'); // Modus bleibt aktiv
      await tapField(page, 20, 20);
      expect((await state(page)).entities).toHaveLength(3);
      expectNoProblems(problems);
    });

    async function saveBoard(page) {
      await page.click('.ttbtn:has-text("Speichern")');
      await page.fill('#saveExName', marker);
      await page.click('button:has-text("Auf Startseite speichern")');
      await expect(page.locator('#saveDialogOverlay')).toBeHidden();
      await expect(page.locator('#savedExercisesList .saved-item', { hasText: marker })).toHaveCount(1);
    }
    async function openSaved(page) {
      await page.click('.tb-link:has-text("Dashboard")');
      await page.locator('#savedExercisesList .saved-item', { hasText: marker }).click();
      await expect(page.locator('#boardOuter')).toBeVisible();
    }

    test('Getippte Positionen bleiben nach Speichern und Öffnen identisch', async ({ page }) => {
      const spec = [['btn-add-att', 22.5, 33.3], ['btn-add-def', 61, 47], ['btn-add-gk', 8, 52], ['btn-add-cone', 77, 81], ['btn-add-ball', 50, 12]];
      for (const [id, x, y] of spec) { await page.click('#' + id); await tapField(page, x, y); }
      await page.click('#btn-add-ball'); // beenden
      const before = (await state(page)).entities;
      expect(before).toHaveLength(5);
      await saveBoard(page);
      const rows = await page.evaluate(async (m) => {
        const { data } = await sb.from('tactics').select('board_data').eq('user_id', currentUser.id).eq('name', m);
        return data || [];
      }, marker);
      expect(rows).toHaveLength(1);
      rows[0].board_data.entities.forEach((e, i) => {
        expect(e.x).toBeCloseTo(before[i].x, 1);
        expect(e.y).toBeCloseTo(before[i].y, 1);
      });
      await openSaved(page);
      const after = (await state(page)).entities;
      expect(after.map((e) => e.type)).toEqual(before.map((e) => e.type));
      after.forEach((e, i) => {
        expect(e.x).toBeCloseTo(before[i].x, 1);
        expect(e.y).toBeCloseTo(before[i].y, 1);
      });
      expectNoProblems(problems);
    });

    test('Öffnen einer gespeicherten Taktik im Platzier-Modus: kein Geister-Platzieren', async ({ page }) => {
      await page.click('#btn-add-att');
      await tapField(page, 30, 30);
      await page.click('#btn-add-att'); // beenden
      await saveBoard(page);
      await page.click('#btn-add-def'); // Modus aktiv
      await openSaved(page);
      const s0 = await state(page);
      expect(s0.entities).toHaveLength(1);
      expect(s0.placeType).toBeNull();
      await expect(page.locator('#btn-add-def')).not.toHaveClass(/\bon\b/);
      await tapField(page, 70, 70);
      const s1 = await state(page);
      expect(s1.entities.length, 'Geister-Platzieren').toBe(1);
      expectNoProblems(problems);
    });

    test('Board verlassen und wieder betreten: kein Platzieren beim nächsten Klick', async ({ page }) => {
      await page.click('#btn-add-att');
      await page.click('.tb-link:has-text("Dashboard")');
      await page.click('.tb-link:has-text("Zeichenboard")');
      await expect(page.locator('#boardOuter')).toBeVisible();
      await expect(page.locator('#btn-add-att')).not.toHaveClass(/\bon\b/);
      await expect(page.locator('#btn-add-att')).toHaveAttribute('aria-pressed', 'false');
      await tapField(page, 40, 40);
      const s = await state(page);
      expect(s.placeType).toBeNull();
      expect(s.entities).toHaveLength(0);
      expectNoProblems(problems);
    });

    test('Rechtsklick setzt kein Objekt, Linksklick schon', async ({ page }) => {
      await page.click('#btn-add-att');
      const p = await pt(page, 40, 40);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.mouse.click(p.x, p.y, { button: 'middle' });
      expect((await state(page)).entities).toHaveLength(0);
      await page.mouse.click(p.x, p.y);
      expect((await state(page)).entities).toHaveLength(1);
      expectNoProblems(problems);
    });

    test('Vorlagen und Formationen (placeEntityAt) setzen feste Positionen wie bisher', async ({ page }) => {
      await page.click('#btn-presets');
      await page.click('.balltype-opt:has-text("Passviereck")');
      const s = await state(page);
      expect(s.entities.length).toBeGreaterThanOrEqual(4);
      s.entities.forEach((e) => { expect(e.x).toBeGreaterThan(0); expect(e.x).toBeLessThan(100); });
      // zweimal dieselbe Vorlage ergibt gleiche Positionen (keine Zufallsstreuung)
      expect(s.placeType).toBeNull();
      const n = s.entities.length;
      await page.click('#btn-presets');
      await page.click('.balltype-opt:has-text("Passviereck")');
      const s2 = await state(page);
      const second = s2.entities.slice(n);
      second.forEach((e, i) => { expect(e.x).toBeCloseTo(s.entities[i].x, 1); expect(e.y).toBeCloseTo(s.entities[i].y, 1); });
      expectNoProblems(problems);
    });
  });
}

suite('Z6 Maus 1280x800', { viewport: { width: 1280, height: 800 } },
  (page, x, y) => page.mouse.click(x, y));

suite('Z6 Touch Tablet 820x1180', { viewport: { width: 820, height: 1180 }, hasTouch: true },
  (page, x, y) => page.touchscreen.tap(x, y));
