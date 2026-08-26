import { syntheticTest as test, expect } from '../../playwright.config.js';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { createStatusFixture } from '../../packages/test-support/src/status-fixture.js';
import { buildStatusAssets } from '../../scripts/build/build.mjs';

test('real browser pairs via HTTP, refreshes without jobs, clears forbidden data, and marks network snapshot stale',async({page,context,browser})=>{
  expect(browser.version()).toBe('151.0.7922.34');
  const h=createHarness();let f:Awaited<ReturnType<typeof createStatusFixture>>|undefined;
  try{
    const assets=join(h.root,'assets');await buildStatusAssets(join(process.cwd(),'apps/status'),assets);f=await createStatusFixture({assetsRoot:assets});
    await page.goto(f.api.origin+'/status');await expect(page.getByRole('heading',{name:'此页面尚未获得本地访问权限'})).toBeVisible();
    await expect(page.locator('#protected')).toBeEmpty();await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/);
    expect((await f.approve(await page.locator('#pair-code').innerText())).status).toBe(200);
    f.hold();await page.getByRole('button',{name:'刷新状态'}).click();await expect(page.getByRole('status')).toHaveText('正在读取本地服务状态…');f.release();
    await expect(page.getByRole('heading',{name:'尚无自检记录'})).toBeVisible();await expect(page.locator('#protected')).toContainText(f.build.version);
    await expect(page.locator('#protected')).toContainText('API 可连接，但 Worker 未运行');
    const count=()=>f!.db.prepare('SELECT COUNT(*) AS n FROM jobs').get();const before=count();
    await page.getByRole('button',{name:'刷新状态'}).click();await expect(page.getByRole('status')).toHaveText('本地状态已读取。');expect(count()).toEqual(before);
    await context.setOffline(true);await page.getByRole('button',{name:'刷新状态'}).click();await expect(page.getByRole('status')).toContainText('以下为上次读取结果');await expect(page.locator('#protected')).toContainText(f.build.version);
    await context.setOffline(false);f.deny(true);await page.getByRole('button',{name:'刷新状态'}).click();await expect(page.locator('#protected')).toBeEmpty();await expect(page.getByRole('heading',{name:'此页面尚未获得本地访问权限'})).toBeVisible();
  }finally{if(f)await f.close();await h.cleanup();}
});

for(const [result,stage,cleanup,actual,message] of [
  ['failed','stopped','not_observed',false,'安装失败，服务尚未就绪。当前没有可恢复的旧版'],
  ['running','cleanup','cleanup_pending',true,'旧受管程序、入口或进程尚未清理完成'],
  ['restored','rollback','complete',true,'升级失败，已恢复旧版。'],
  ['human_needed','stopped','pending',false,'操作已停止，尚不能确认安全恢复方式。'],
  ['running','selfcheck','pending',true,'检测到组件版本不一致'],
] as const)test(`actual status projection ${result}/${stage}/${cleanup}`,async({page})=>{
  const h=createHarness();let f:Awaited<ReturnType<typeof createStatusFixture>>|undefined;
  try{
    const assets=join(h.root,'assets');await buildStatusAssets(join(process.cwd(),'apps/status'),assets);f=await createStatusFixture({assetsRoot:assets});
    const operationId=randomUUID();const gate=await f.maintenance.enterMaintenance({operationId,expectedGeneration:0,owner:'installer',leaseUntil:Date.now()+60000});
    await f.projections.writeInstall({operationId,result,stage,cleanup,targetBuild:{...f.build,version:'0.1.0-beta.2'},actualBuild:actual?f.build:null,checkedAt:new Date().toISOString()},{operationId,expectedGeneration:gate.generation});
    await page.goto(f.api.origin+'/status');await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/);expect((await f.approve(await page.locator('#pair-code').innerText())).status).toBe(200);await page.getByRole('button',{name:'刷新状态'}).click();
    await expect(page.locator('#protected')).toContainText(message);await expect(page.locator('#protected')).not.toContainText('操作完成：目标版本已启动');
  }finally{if(f)await f.close();await h.cleanup();}
});
