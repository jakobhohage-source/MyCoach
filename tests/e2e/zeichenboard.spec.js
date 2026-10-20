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

    // Zuletzt gesetzten Spieler verschieben. Er liegt im DOM zuoberst, auch wenn die App
    // die Spieler zufällig übereinander platziert hat.
    const before = (await boardState(page)).entities;
    const last = before.length - 1;
    const cl = await page.locator('#playerLayer .field-entity').last().boundingBox();
    await drag(page, { x: cl.x + cl.width / 2, y: cl.y + cl.height / 2 }, { x: cb.x + cb.width * 0.7, y: cb.y + cb.height * 0.5 });
    await expect.poll(async () => {
      const e = (await boardState(page)).entities[last];
      return Math.hypot(e.x - before[last].x, e.y - before[last].y) > 3;
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

  // Gemeinsame Prüfung für Kriterium 2 und 3: Board sichtbar, Feldauswahl nicht, Canvas hat Größe
  async function expectBoardOpen(page) {
    await expect(page.locator('#boardOuter')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fieldPicker')).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const c = document.getElementById('drawCanvas');
      return c.width > 0 && c.height > 0;
    })).toBe(true);
    const box = await page.locator('#drawCanvas').boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  }

  test('Taktik direkt nach Reload öffnen', async ({ page }) => {
    const expected = await buildAndSave(page);
    await reloadAndLogin(page);
    await page.locator('#savedExercisesList .saved-item', { hasText: marker }).click();
    await expectBoardOpen(page);
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
    expectRestored(await boardState(page), expected);
    expectNoProblems(problems);
  });

  test('Im selben Besuch erneut öffnen, auch mit anderem Feldtyp (Kriterium 4)', async ({ page }) => {
    const expected = await buildAndSave(page);
    await reloadAndLogin(page);
    const item = page.locator('#savedExercisesList .saved-item', { hasText: marker });
    await item.click();
    await expectBoardOpen(page);
    expectRestored(await boardState(page), expected);

    // Zurück zum Dashboard, erneut öffnen (Board ist initialisiert)
    await page.click('.tb-link:has-text("Dashboard")');
    await item.click();
    await expectBoardOpen(page);
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
    expectRestored(await boardState(page), expected);

    // Synthetische Taktik (nur im Speicher, nicht in der DB) mit anderem Feldtyp
    await page.click('.tb-link:has-text("Dashboard")');
    await page.evaluate(() => {
      savedExercises.push({ id: 'synthetic-full', name: 'synthetic', field: 'full', movCount: 0, time: '',
        boardData: { fieldType: 'full', entities: [], paths: [], movements: [] } });
      openSavedEx('synthetic-full');
    });
    await expectBoardOpen(page);
    await expect.poll(async () => (await boardState(page)).field).toBe('full');
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(0);
    await page.evaluate(() => { savedExercises = savedExercises.filter((x) => x.id !== 'synthetic-full'); });
    expectNoProblems(problems);
  });

  test('Edge Cases: ohne boardData Feldauswahl, ohne fieldType Fallback full', async ({ page }) => {
    // frisch nach Login, Board nicht initialisiert; erst warten, bis loadSavedExercises die Liste gesetzt hat
    await page.waitForFunction(() => document.querySelector('#savedExercisesList .saved-item, #savedExercisesList .saved-empty'));
    await page.evaluate(() => {
      savedExercises.push({ id: 'syn-null', name: 'syn-null', field: 'x', movCount: 0, time: '', boardData: null });
      savedExercises.push({ id: 'syn-nofield', name: 'syn-nofield', field: 'x', movCount: 0, time: '',
        boardData: { entities: [{ id: 1, type: 'ball', x: 50, y: 50 }] } });
      openSavedEx('syn-null');
    });
    await expect(page.locator('#fieldPicker')).toBeVisible();
    await expect(page.locator('#boardOuter')).not.toBeVisible();

    await page.click('.tb-link:has-text("Dashboard")');
    await page.evaluate(() => openSavedEx('syn-nofield'));
    // Hinweis: Eintrag bleibt nur im Speicher der Seite
    await expectBoardOpen(page);
    await expect.poll(async () => (await boardState(page)).field).toBe('full');
    await expect(page.locator('#playerLayer .field-entity')).toHaveCount(1);
    expectNoProblems(problems);
  });

  // Kriterium 1 zusätzlich für Tablet und Handy (Touch). Größe des Felds auf dem Handy gehört zu Z8.
  for (const vp of [
    { name: 'Tablet 820x1180', viewport: { width: 820, height: 1180 } },
    { name: 'Handy 390x844', viewport: { width: 390, height: 844 } },
  ]) {
    test.describe(vp.name, () => {
      test.use({ viewport: vp.viewport, hasTouch: true, isMobile: true });

      // Tablet und Handy: Aufbau per Maus ist dort nicht praktikabel (Handy-Feld winzig, Z8).
      // Die Taktik wird deshalb in beiden Fällen direkt in der Testumgebung angelegt, geöffnet wird per Klick in der Liste.
      test('Taktik direkt nach Reload öffnen', async ({ page }) => {
        const entitiesSeed = [
          { id: 1, type: 'attacker', x: 20, y: 30, color: '#e8614e', label: 'A' },
          { id: 2, type: 'attacker', x: 40, y: 60, color: '#e8614e', label: 'A' },
          { id: 3, type: 'defender', x: 60, y: 30, color: '#4fa3e0', label: 'V' },
          { id: 4, type: 'defender', x: 80, y: 60, color: '#4fa3e0', label: 'V' },
        ];
        await page.evaluate(async ({ m, ents }) => {
          const pts = (a, b) => [{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }];
          const { error } = await sb.from('tactics').insert({
            user_id: currentUser.id, name: m, field_type: 'half', created_at: new Date().toISOString(),
            board_data: {
              fieldType: 'half', movements: [], entities: ents,
              paths: [
                { color: '#f0bc2e', size: 2, tool: 'arrow', pts: pts([10, 10], [60, 10]) },
                { color: '#f0bc2e', size: 2, tool: 'arrow', pts: pts([10, 80], [60, 60]) },
              ],
            },
          });
          if (error) throw new Error(error.message);
        }, { m: marker, ents: entitiesSeed });
        await reloadAndLogin(page);
        await page.locator('#savedExercisesList .saved-item', { hasText: marker }).click();
        await expectBoardOpen(page);
        await expect(page.locator('#playerLayer .field-entity')).toHaveCount(4);
        const st = await boardState(page);
        expect(st.field).toBe('half');
        expect(st.paths.map((x) => x.tool)).toEqual(['arrow', 'arrow']);
        expectNoProblems(problems);
      });
    });
  }
});
