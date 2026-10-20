// Sicherheitsnetz Zeichenboard: Spielfeld öffnen, Spieler und Linien setzen, verschieben,
// speichern, Seite neu laden, Taktik öffnen und prüfen. Alle Testdaten werden wieder entfernt.
const { test, expect } = require('@playwright/test');
const {
  makeMarker, watchPage, expectNoProblems, openTestEnv, login, cleanupByMarker,
} = require('./helpers');

test.describe('Zeichenboard', () => {
  let marker;
  let problems;

  test.beforeEach(async ({ page }) => {
    marker = makeMarker('board');
    problems = watchPage(page);
    await openTestEnv(page);
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupByMarker(page, marker);
  });

  const boardState = (page) => page.evaluate(() => ({
    entities: entities.map((e) => ({ type: e.type, x: e.x, y: e.y })),
    paths: paths.map((p) => ({ tool: p.tool, n: p.pts.length })),
    movements: movements.length,
    field: selectedFieldType,
  }));

  // Zieht mit der Maus von A nach B (Seitenkoordinaten)
  async function drag(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }

  async function savedTactic(page) {
    return page.evaluate(async (m) => {
      const { data } = await sb.from('tactics').select('field_type,board_data').eq('user_id', currentUser.id).eq('name', m);
      return data || [];
    }, marker);
  }

  async function saveCurrentBoard(page) {
    await page.click('.ttbtn:has-text("Speichern")');
    await page.fill('#saveExName', marker);
    await page.click('button:has-text("Auf Startseite speichern")');
    await expect(page.locator('#saveDialogOverlay')).toBeHidden();
    await expect(page.locator('#savedExercisesList .saved-item', { hasText: marker })).toHaveCount(1);
  }

  async function reloadAndLogin(page) {
    await page.reload();
    await expect(page.locator('#testEnvBadge')).toHaveText('TESTUMGEBUNG');
    await login(page);
    await expect(page.locator('#savedExercisesList .saved-item', { hasText: marker })).toHaveCount(1);
  }

  // Baut eine kleine Übung: 4 Spieler, 2 Pfeile, ein verschobener Spieler. Speichert sie unter dem Marker.
  async function buildAndSave(page) {
    await page.click('.tb-link:has-text("Zeichenboard")');
    await page.click('#fp-half');
    await page.click('.fp-start-btn');
    await expect(page.locator('#boardOuter')).toBeVisible();
    await page.waitForFunction(() => boardInited && document.getElementById('drawCanvas').width > 0);

    // 4 Spieler setzen
    await page.click('#btn-add-att');
    await page.click('#btn-add-att');
    await page.click('#btn-add-def');
    await page.click('#btn-add-def');
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
    await expect(page.locator('#bsStats')).toContainText('Objekte: 4');

    // 2 Linien (Pfeil ist das Standardwerkzeug)
    const cb = await page.locator('#drawCanvas').boundingBox();
    await drag(page, { x: cb.x + cb.width * 0.15, y: cb.y + cb.height * 0.1 }, { x: cb.x + cb.width * 0.45, y: cb.y + cb.height * 0.1 });
    await drag(page, { x: cb.x + cb.width * 0.15, y: cb.y + cb.height * 0.92 }, { x: cb.x + cb.width * 0.5, y: cb.y + cb.height * 0.8 });
    await expect.poll(async () => (await boardState(page)).paths.length).toBe(2);
    await expect(page.locator('#bsStats')).toContainText('Zeichnungen: 2');

    // Ersten Spieler verschieben
    const startPos = (await boardState(page)).entities[0];
    const c0 = await page.locator('#playerLayer .field-entity').first().boundingBox();
    await drag(page, { x: c0.x + c0.width / 2, y: c0.y + c0.height / 2 }, { x: cb.x + cb.width * 0.7, y: cb.y + cb.height * 0.5 });
    await expect.poll(async () => {
      const e = (await boardState(page)).entities[0];
      return Math.hypot(e.x - startPos.x, e.y - startPos.y) > 3;
    }).toBe(true);

    const state = await boardState(page);
    await saveCurrentBoard(page);
    return state;
  }

  function expectRestored(restored, expected) {
    expect(restored.field).toBe('half');
    expect(restored.entities.map((e) => e.type)).toEqual(expected.entities.map((e) => e.type));
    restored.entities.forEach((e, i) => {
      expect(e.x).toBeCloseTo(expected.entities[i].x, 1);
      expect(e.y).toBeCloseTo(expected.entities[i].y, 1);
    });
    expect(restored.paths.map((p) => p.tool)).toEqual(['arrow', 'arrow']);
  }

  test('Übung aufbauen, speichern, neu laden und wieder öffnen', async ({ page }) => {
    const expected = await buildAndSave(page);

    // Datenbankzeile entspricht dem App-Zustand
    const rows = await savedTactic(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].field_type).toBe('half');
    expect(rows[0].board_data.entities).toHaveLength(4);
    expect(rows[0].board_data.paths).toHaveLength(2);
    expect(rows[0].board_data.entities[0].x).toBeCloseTo(expected.entities[0].x, 1);
    expect(rows[0].board_data.entities[0].y).toBeCloseTo(expected.entities[0].y, 1);

    await reloadAndLogin(page);
    // Umweg wegen bekanntem Fehler (siehe Test unten): erst das Board regulär öffnen,
    // dann zurück zum Dashboard und die Taktik öffnen.
    await page.click('.tb-link:has-text("Zeichenboard")');
    await page.click('.fp-start-btn');
    await expect(page.locator('#boardOuter')).toBeVisible();
    await page.click('.tb-link:has-text("Dashboard")');
    await page.locator('#savedExercisesList .saved-item', { hasText: marker }).click();

    // Sichtbarer Zustand: Board da, 4 Spieler im DOM, Statuszeile stimmt
    await expect(page.locator('#boardOuter')).toBeVisible();
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
    await expect(page.locator('#bsStats')).toContainText('Objekte: 4 · Zeichnungen: 2');
    // App-Zustand
    expectRestored(await boardState(page), expected);
    // Linien sind auf dem Canvas wirklich gezeichnet (nicht nur im Zustand)
    await expect.poll(() => page.evaluate(() => {
      const c = document.getElementById('drawCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    })).toBeGreaterThan(100);

    expectNoProblems(problems);
  });

  // Bekannter App-Fehler: Nach einem Seiten-Reload zeigt das direkte Öffnen einer gespeicherten Taktik
  // eine leere Ansicht, weil openSavedEx das Board (boardOuter) nicht einblendet, solange boardInited false ist.
  // test.fail() hält die Suite grün und schlägt Alarm (unerwartet bestanden), sobald der Fehler behoben ist.
  test('Taktik direkt nach Reload öffnen (bekannter Fehler)', async ({ page }) => {
    test.fail();
    const expected = await buildAndSave(page);
    await reloadAndLogin(page);
    await page.locator('#savedExercisesList .saved-item', { hasText: marker }).click();
    await expect(page.locator('#boardOuter')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
    expectRestored(await boardState(page), expected);
  });
});
