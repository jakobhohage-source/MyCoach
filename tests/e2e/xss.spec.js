// XSS-Regressionstest für die Lücke aus fix/xss-inline-handler:
// Name und Verein mit Schadcode dürfen beim Anzeigen, Kommentare-Aufklappen und Kontakt-Aufnehmen nichts ausführen.
const { test, expect } = require('@playwright/test');
const {
  makeMarker, watchPage, expectNoProblems, openTestEnv, login, openCommunityTab, cleanupByMarker,
} = require('./helpers');

const EVIL_NAME = '"><img src=x onerror=alert(1)>';
const EVIL_CLUB = "x');alert(2);//";
// Fremde Nutzer-ID, damit die eigene Anfrage wie die eines anderen Trainers angezeigt wird
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000000';

test.describe('XSS-Regression', () => {
  let marker;
  let problems;
  let originalMeta = null;

  test.beforeEach(async ({ page }) => {
    marker = makeMarker('xss');
    problems = watchPage(page);
    await openTestEnv(page);
    await login(page);
    originalMeta = await page.evaluate(() => currentUser.user_metadata);
  });

  test.afterEach(async ({ page }) => {
    await cleanupByMarker(page, marker);
    // Profil des Testkontos immer zurücksetzen, auch wenn der Test fehlschlägt
    if (originalMeta) {
      await page.evaluate(async ({ meta, realId }) => {
        if (realId && currentUser) currentUser.id = realId;
        const { error } = await sb.auth.updateUser({ data: { name: meta.name, role: meta.role, club: meta.club } });
        if (error) throw new Error('Profil konnte nicht zurückgesetzt werden: ' + error.message);
        currentUser.user_metadata = { ...currentUser.user_metadata, name: meta.name, role: meta.role, club: meta.club };
      }, { meta: originalMeta, realId: await page.evaluate(() => window.__e2eRealUserId || null) });
    }
  });

  test('präparierter Name und Verein werden nur als Text angezeigt', async ({ page }) => {
    // Profil mit Schadcode-Name und -Verein setzen
    await page.evaluate(async ({ name, club }) => {
      const meta = { ...currentUser.user_metadata, name, club: { type: 'hobby', name: club } };
      const { error } = await sb.auth.updateUser({ data: { name: meta.name, role: meta.role, club: meta.club } });
      if (error) throw new Error(error.message);
      currentUser.user_metadata = meta;
    }, { name: EVIL_NAME, club: EVIL_CLUB });

    // Beitrag: Autor und Verein erscheinen unverändert als Text
    await openCommunityTab(page, 'pinnwand');
    await page.click('#comm-pinnwand .comm-new-btn');
    await page.fill('#pmTitle', marker);
    await page.fill('#pmBody', 'XSS-Regressionstest, wird sofort wieder gelöscht.');
    await page.click('#postModalOverlay button:has-text("Veröffentlichen")');
    const card = page.locator('#pinnwandList .comm-card', { hasText: marker });
    await expect(card).toHaveCount(1);
    await expect(card.locator('.comm-card-meta')).toContainText(`${EVIL_NAME} · ${EVIL_CLUB}`);
    await expect(card.locator('img')).toHaveCount(0);

    // Kommentare aufklappen und kommentieren
    await card.locator('.comm-comment-toggle').click();
    await card.locator('.comment-input').fill(`Kommentar ${marker}`);
    await card.locator('.comment-send-btn').click();
    const comment = card.locator('.comment-item', { hasText: `Kommentar ${marker}` });
    await expect(comment.locator('.comment-meta')).toContainText(`${EVIL_NAME} · ${EVIL_CLUB}`);
    await expect(comment.locator('img')).toHaveCount(0);
    // Zu- und wieder aufklappen
    await card.locator('.comm-comment-toggle').click();
    await card.locator('.comm-comment-toggle').click();
    await expect(comment).toBeVisible();

    // Testspiel-Anfrage anlegen
    await openCommunityTab(page, 'testspiele');
    await page.click('#comm-testspiele .comm-new-btn');
    await page.fill('#fmDate', '2030-01-15');
    await page.fill('#fmMessage', marker);
    await page.click('#friendlyModalOverlay button:has-text("Anfrage veröffentlichen")');
    const request = page.locator('#friendlyList .comm-card', { hasText: marker });
    await expect(request).toHaveCount(1);
    await expect(request.locator('.comm-card-title')).toContainText(EVIL_CLUB);

    // Als „fremder Trainer“ ansehen: Mit nur einem Testkonto wird die eigene Nutzer-ID im Browser
    // kurz ersetzt, damit die App „Kontakt aufnehmen“ zeigt. Es wird keine Nachricht gesendet.
    await page.evaluate((otherId) => {
      window.__e2eRealUserId = currentUser.id;
      currentUser.id = otherId;
      return loadFriendlyRequests();
    }, OTHER_USER_ID);
    const foreign = page.locator('#friendlyList .comm-card', { hasText: marker });
    await foreign.locator('.comm-contact-btn').click();
    await expect(page.locator('#composeModalOverlay')).toBeVisible();
    await expect(page.locator('#composeRecipientLabel')).toHaveText(EVIL_CLUB);
    await page.evaluate(() => closeCompose());
    await page.evaluate(() => {
      currentUser.id = window.__e2eRealUserId;
      delete window.__e2eRealUserId;
      return loadFriendlyRequests();
    });

    // Einen Moment warten, damit verzögert ausgelöster Code auffallen würde
    await page.waitForTimeout(500);
    expectNoProblems(problems);
  });
});
