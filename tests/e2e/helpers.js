// Gemeinsame Hilfsfunktionen für die Browser-Tests.
const { expect } = require('@playwright/test');

// Bestätigungsdialoge, die die App beim Löschen absichtlich zeigt. Alles andere gilt als Fehler.
const EXPECTED_CONFIRMS = ['Beitrag löschen?', 'Anfrage löschen?'];

// Eindeutige Kennung für Testdaten, damit das Aufräumen nur eigene Einträge trifft.
function makeMarker(prefix) {
  return `E2E-${prefix}-${Date.now()}`;
}

// Sammelt unerwartete Dialoge sowie Konsolen- und Seitenfehler.
function watchPage(page) {
  const problems = { dialogs: [], consoleErrors: [], pageErrors: [] };
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm' && EXPECTED_CONFIRMS.includes(dialog.message())) {
      await dialog.accept();
      return;
    }
    problems.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => problems.pageErrors.push(err.message));
  return problems;
}

function expectNoProblems(problems) {
  expect(problems.dialogs, 'Unerwarteter Dialog (alert/prompt/confirm)').toEqual([]);
  expect(problems.pageErrors, 'JavaScript-Fehler auf der Seite').toEqual([]);
  expect(problems.consoleErrors, 'Fehler in der Browser-Konsole').toEqual([]);
}

// Sicherheitsregel: Tests laufen nur lokal und nur, wenn die App den Hinweis TESTUMGEBUNG zeigt.
async function openTestEnv(page) {
  await page.goto('/');
  const host = new URL(page.url()).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`ABBRUCH: Tests laufen nur auf localhost, nicht auf "${host}".`);
  }
  const badge = page.locator('#testEnvBadge');
  const ok = await badge.isVisible() && (await badge.textContent()) === 'TESTUMGEBUNG';
  if (!ok) {
    throw new Error('ABBRUCH: Hinweis "TESTUMGEBUNG" nicht sichtbar. Die App ist womöglich mit der Live-Datenbank verbunden. Es wird nichts getestet.');
  }
}

async function login(page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('ABBRUCH: TEST_EMAIL oder TEST_PASSWORD fehlt in tests/e2e/.account.local.');
  }
  await page.fill('#loginEmail', email);
  await page.fill('#loginPassword', password);
  await page.click('#btnLogin');
  await expect(page.locator('#appShell')).toHaveClass(/visible/);
  // enterApp lädt Übungen und Pläne nach dem Einblenden
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && currentUser.id);
}

async function openCommunityTab(page, tab) {
  await page.click('.tb-link:has-text("Community")');
  await page.click(tab === 'pinnwand' ? '#ctabPinnwand' : '#ctabTestspiele');
  // Erst weitermachen, wenn beide Listen fertig geladen sind. Sonst überschreibt die
  // noch laufende Erstladung später die Liste mit einem älteren Stand.
  for (const list of ['#pinnwandList', '#friendlyList']) {
    await expect(page.locator(list)).not.toContainText('Lade');
  }
}

// Löscht alle Testdaten des angemeldeten Testkontos, die den Marker enthalten. Läuft auch nach Fehlern.
async function cleanupByMarker(page, marker) {
  await page.evaluate(async (m) => {
    if (typeof sb === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const uid = user.id;
    const { data: posts } = await sb.from('community_posts').select('id').eq('user_id', uid).like('title', `%${m}%`);
    const postIds = (posts || []).map((p) => p.id);
    if (postIds.length) await sb.from('post_comments').delete().in('post_id', postIds);
    await sb.from('post_comments').delete().eq('user_id', uid).like('body', `%${m}%`);
    if (postIds.length) await sb.from('community_posts').delete().in('id', postIds);
    await sb.from('friendly_requests').delete().eq('user_id', uid).like('message', `%${m}%`);
    await sb.from('tactics').delete().eq('user_id', uid).like('name', `%${m}%`);
  }, marker);
}

module.exports = {
  makeMarker,
  watchPage,
  expectNoProblems,
  openTestEnv,
  login,
  openCommunityTab,
  cleanupByMarker,
};
