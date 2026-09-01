import { syntheticTest as test, expect } from '../../playwright.config.js';
import { createSyntheticAuthE2E } from '../../packages/test-support/src/auth-e2e.js';

test.describe('synthetic auth browser to paired UI E2E', () => {
  test('auth E2E local containment', async () => {
    const e2e = await createSyntheticAuthE2E();
    try {
      await e2e.pair();
      await expect(e2e.uiPage.locator('#protected')).toBeVisible();
    } finally {
      const audit = await e2e.close();
      expect(audit).toMatchObject({ realSchoolRequests: 0, externalSockets: 0, residualRoots: 0, browserArtifacts: 0 });
    }
  });

  test('official redirect and marker', async () => {
    for (const scenario of ['direct', 'redirect-1', 'redirect-2', 'redirect-3'] as const) {
      const e2e = await createSyntheticAuthE2E({ moodleScenario: scenario });
      try {
        await e2e.enqueueLoginCompleted('moodle');
        const job = await e2e.pump();
        expect(job, JSON.stringify(e2e.audit())).toMatchObject({ source: 'moodle', state: 'succeeded', resultCode: 'authenticated' });
      } finally { await e2e.close(); }
    }
    for (const scenario of ['missing-marker', 'ambiguous-marker', 'cross-final', 'interaction'] as const) {
      const e2e = await createSyntheticAuthE2E({ moodleScenario: scenario });
      try {
        await e2e.enqueueLoginCompleted('moodle');
        const job = await e2e.pump();
        expect(job?.state).not.toBe('succeeded');
        expect(e2e.audit().sourceRequests.edstem).toBe(0);
        expect(e2e.audit().popupInteractions).toBe(0);
      } finally { await e2e.close(); }
    }
  });

  test('Moodle then EdStem', async () => {
    const e2e = await createSyntheticAuthE2E();
    try {
      await e2e.pair();
      await e2e.uiPage.getByRole('button', { name: '打开 Moodle 官方登录窗口' }).click();
      await e2e.uiPage.getByRole('button', { name: '我已完成 Moodle 登录' }).click();
      await e2e.waitForEnqueued(1);
      await e2e.pump();
      await e2e.refresh();
      await expect(e2e.uiPage.locator('.source-card').first()).toContainText('authenticated');
      await expect(e2e.uiPage.locator('.source-card').nth(1)).toContainText('not_observed');
      await e2e.pump();
      await e2e.refresh();
      await expect(e2e.uiPage.locator('.source-card').nth(1)).toContainText('authenticated');
      expect(e2e.audit().timeline.map(item => item.source)).toEqual(['moodle', 'edstem']);
    } finally { await e2e.close(); }
  });

  test('binding and mismatch', async () => {
    const e2e = await createSyntheticAuthE2E();
    try {
      await e2e.completeDualProbe();
      await e2e.refresh();
      await expect(e2e.uiPage.getByRole('button', { name: '确认两个账户对应' })).toBeVisible();
      const confirmation = e2e.uiPage.waitForResponse(response => response.url().endsWith('/api/auth/binding/confirm'));
      await e2e.uiPage.getByRole('button', { name: '确认两个账户对应' }).click();
      expect((await confirmation).status()).toBe(200);
      await e2e.waitForBindingStatus('confirmed');
      await e2e.refresh();
      await expect(e2e.uiPage.locator('.binding-panel')).toContainText('confirmed');
      expect(await e2e.probeApprovedCourseVisibility()).toEqual({ moodle: true, edstem: true });
    } finally { await e2e.close(); }

    const mismatch = await createSyntheticAuthE2E({ edstemSubject: 'different-stable-subject' });
    try {
      await mismatch.completeDualProbe();
      await mismatch.refresh();
      await expect(mismatch.uiPage.locator('.binding-panel')).toContainText('账户身份不一致');
      expect(mismatch.audit().courseRequests).toBe(0);
    } finally { await mismatch.close(); }
  });

  test('busy stop and fence', async () => {
    const e2e = await createSyntheticAuthE2E({ barrier: 'read' });
    try {
      await e2e.pair();
      const primary = e2e.uiPage.getByRole('button', { name: '打开 Moodle 官方登录窗口' });
      await primary.dblclick();
      await expect(e2e.uiPage.getByRole('button', { name: '我已完成 Moodle 登录' })).toBeVisible();
      await e2e.uiPage.getByRole('button', { name: '我已完成 Moodle 登录' }).press('Enter');
      await e2e.waitForEnqueued(1);
      const running = e2e.pump();
      await e2e.waitAtBarrier();
      await e2e.requestCancel('moodle');
      await e2e.releaseBarrier();
      await expect(running).rejects.toThrow();
      expect(e2e.audit().jobsEnqueued).toBe(1);
      expect(e2e.audit().commitsAfterCancel).toBe(0);
    } finally { await e2e.close(); }
  });

  test('auth E2E protected purge and sensitive surfaces', async () => {
    for (const status of [401, 403] as const) {
      for (const path of ['/api/status', '/api/auth/status', '/api/auth/receipts?*']) {
        const e2e = await createSyntheticAuthE2E();
        try {
          await e2e.completeDualProbe();
          await e2e.refresh();
          expect((await e2e.surfaceInventory()).protectedVisibleHits).toBeGreaterThan(0);
          await e2e.failNextAuth(path, status);
          await e2e.refresh();
          const after = await e2e.surfaceInventory();
          expect(after.protectedVisibleHits).toBe(0);
          expect(after.forbiddenHits).toEqual([]);
        } finally { await e2e.close(); }
      }
    }
    const stale = await createSyntheticAuthE2E();
    try {
      await stale.completeDualProbe();
      await stale.refresh();
      await stale.failNextAuth('/api/auth/status', 500);
      expect(await stale.refresh()).toContain('以下为上次读取结果');
      expect((await stale.surfaceInventory()).protectedVisibleHits).toBeGreaterThan(0);
      await expect(stale.uiPage.locator('.stale-notice').first()).toBeVisible();
    } finally { await stale.close(); }
  });

  test('receipt cell isolation, 24 hour gate and Windows blocked', async () => {
    const e2e = await createSyntheticAuthE2E();
    try {
      await e2e.pair();
      await e2e.appendSyntheticReceipt({ source: 'moodle', scenario: 'd.24h_recheck', status: 'pass' });
      await e2e.appendSyntheticReceipt({ source: 'moodle', scenario: 'd.24h_recheck', status: 'human_needed' });
      await e2e.refresh();
      await expect(e2e.uiPage.locator('.checkpoint-ledger')).toContainText('等待跨日复查');
      await expect(e2e.uiPage.locator('.platform-gaps')).toContainText('macOS 结果不能替代 Windows 验证；Phase 3 仍被阻塞。');
      expect(e2e.audit().evidenceClasses).toEqual(['S']);
      expect(e2e.audit().evidenceReceipts).toBe(2);
    } finally { await e2e.close(); }
  });

  test('keyboard and narrow layout', async () => {
    const e2e = await createSyntheticAuthE2E();
    try {
      await e2e.pair();
      for (const width of [1280, 759, 599, 320]) {
        await e2e.uiPage.setViewportSize({ width, height: 900 });
        expect(await e2e.uiPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await e2e.uiPage.locator('button').evaluateAll(items => items.every(item => getComputedStyle(item).minHeight === '48px'))).toBe(true);
      }
      await e2e.uiPage.setViewportSize({ width: 1280, height: 900 });
      await e2e.uiPage.evaluate(() => { document.body.style.zoom = '2'; });
      expect(await e2e.uiPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await e2e.uiPage.evaluate(() => { document.body.style.zoom = ''; });
      const refresh = e2e.uiPage.getByRole('button', { name: '刷新状态' });
      await refresh.focus();
      await e2e.refresh();
      await expect(refresh).toBeFocused();
      await e2e.uiPage.keyboard.press('Tab');
      await expect(e2e.uiPage.locator(':focus')).toBeVisible();
    } finally { await e2e.close(); }
  });
});
