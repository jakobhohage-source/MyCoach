// Smoke-Test: Login, Beitrag mit Kommentar, Taktik. Alle Testdaten werden wieder entfernt.
const { test, expect } = require('@playwright/test');
const {
  makeMarker, watchPage, expectNoProblems, openTestEnv, login, openCommunityTab, cleanupByMarker,
} = require('./helpers');

test.describe('Smoke', () => {
  let marker;
  let problems;

  test.beforeEach(async ({ page }) => {
    marker = makeMarker('smoke');
    problems = watchPage(page);
    await openTestEnv(page);
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupByMarker(page, marker);
  });

  test('Beitrag, Kommentar und Taktik anlegen und löschen', async ({ page }) => {
    // Beitrag schreiben
    await openCommunityTab(page, 'pinnwand');
    await page.click('#comm-pinnwand .comm-new-btn');
    await page.fill('#pmTitle', marker);
    await page.fill('#pmBody', 'Automatischer Smoke-Test, wird sofort wieder gelöscht.');
    await page.click('#postModalOverlay button:has-text("Veröffentlichen")');

    const card = page.locator('#pinnwandList .comm-card', { hasText: marker });
    await expect(card).toHaveCount(1);
    // Name und Verein setzt die Datenbank aus dem Profil des Testkontos
    await expect(card.locator('.comm-card-meta')).toContainText('Test Trainer · Testverein');

    // Kommentieren
    await card.locator('.comm-comment-toggle').click();
    await card.locator('.comment-input').fill(`Kommentar ${marker}`);
    await card.locator('.comment-send-btn').click();
    const comment = card.locator('.comment-item', { hasText: `Kommentar ${marker}` });
    await expect(comment).toHaveCount(1);
    await expect(comment.locator('.comment-meta')).toContainText('Test Trainer · Testverein');
    await expect(card.locator('.comm-comment-toggle')).toContainText('1 Kommentar');

    // Kommentar und Beitrag löschen
    await comment.locator('button:has-text("✕")').click();
    await expect(card.locator('.comment-item')).toHaveCount(0);
    await card.locator('.comm-card-header button:has-text("🗑")').click();
    await expect(page.locator('#pinnwandList .comm-card', { hasText: marker })).toHaveCount(0);

    // Taktik anlegen
    await page.click('.tb-link:has-text("Zeichenboard")');
    const startBtn = page.locator('.fp-start-btn');
    if (await startBtn.isVisible()) await startBtn.click();
    await expect(page.locator('#boardOuter')).toBeVisible();
    await page.click('.ttbtn:has-text("Speichern")');
    await page.fill('#saveExName', marker);
    await page.click('button:has-text("Auf Startseite speichern")');
    await expect(page.locator('#saveDialogOverlay')).toBeHidden();

    // Taktik auf der Startseite finden und löschen
    await page.click('.tb-link:has-text("Dashboard")');
    const saved = page.locator('#savedExercisesList .saved-item', { hasText: marker });
    await expect(saved).toHaveCount(1);
    await saved.locator('.saved-item-del').click();
    await expect(page.locator('#savedExercisesList .saved-item', { hasText: marker })).toHaveCount(0);
    // Zeile ist auch in der Datenbank weg
    const remaining = await page.evaluate(async (m) => {
      const { data } = await sb.from('tactics').select('id').eq('user_id', currentUser.id).eq('name', m);
      return (data || []).length;
    }, marker);
    expect(remaining).toBe(0);

    expectNoProblems(problems);
  });
});
