import { syntheticTest as test,expect } from '../../playwright.config.js';
import { createHarness } from '../../packages/test-support/src/harness.js';
import { createStatusFixture } from '../../packages/test-support/src/status-fixture.js';
import { buildStatusAssets } from '../../scripts/build/build.mjs';
import { JobRunner } from '../../packages/application/src/job-runner.js';
import { redactText } from '../../packages/application/src/policy.js';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

test('actual DOM keyboard, details, 320px and 200% zoom keep long inert job text readable',async({page})=>{
  const h=createHarness();let f:Awaited<ReturnType<typeof createStatusFixture>>|undefined;
  try{
    const assets=join(h.root,'assets');await buildStatusAssets(join(process.cwd(),'apps/status'),assets);f=await createStatusFixture({assetsRoot:assets});
    const value='<img src="https://school.invalid" onerror="window.xss=true">'+ '很长的中文任务结果'.repeat(40);
    const j=await f.jobs.enqueue({kind:'echo',value,idempotencyKey:randomUUID(),scope:f.scope},{expectedGeneration:0});await new JobRunner(f.jobs).runOnce('synthetic',{expectedGeneration:0},async job=>job.request.value);
    await f.projections.writeSelfcheck({jobId:j.id,featureResult:'not_observed',probes:[],checkedAt:new Date().toISOString()},{operationId:null,expectedGeneration:0});
    await page.goto(f.api.origin+'/status');await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/);await f.approve(await page.locator('#pair-code').innerText());
    await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'刷新状态'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('status')).toHaveText('本地状态已读取。');await expect(page.getByRole('button')).toBeFocused();
    await expect(page.locator('#protected')).toContainText(j.id);await expect(page.locator('#protected')).toContainText(redactText(value));expect(await page.locator('#protected img').count()).toBe(0);
    await expect(page.locator('#protected')).toContainText('尚未观察到 Worker');
    await page.keyboard.press('Tab');await expect(page.locator('summary')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('details')).toHaveAttribute('open','');
    expect(await page.locator('summary').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
    await expect(page.getByRole('status')).toHaveAttribute('aria-live','polite');expect(await page.locator('[aria-live]').count()).toBe(1);
    await page.evaluate(()=>{const events:string[]=[];(window as unknown as {announcements:string[]}).announcements=events;new MutationObserver(()=>events.push(document.querySelector('#feedback')!.textContent!)).observe(document.querySelector('#feedback')!,{childList:true});});
    await page.getByRole('button').click();await expect(page.getByRole('status')).toHaveText('本地状态已读取。');await expect(page.getByRole('button')).toBeFocused();
    expect(await page.evaluate(()=>(window as unknown as {announcements:string[]}).announcements)).toEqual(['正在读取本地服务状态…','本地状态已读取。']);
    for(const zoom of ['100%','200%']){await page.setViewportSize({width:320,height:800});await page.evaluate(z=>{document.documentElement.style.zoom=z;},zoom);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  }finally{if(f)await f.close();await h.cleanup();}
});

test('offline after actual synthetic successful job labels historical completion and does not claim current connectivity',async({page,context})=>{
  const h=createHarness();let f:Awaited<ReturnType<typeof createStatusFixture>>|undefined;
  try{
    const assets=join(h.root,'assets');await buildStatusAssets(join(process.cwd(),'apps/status'),assets);f=await createStatusFixture({assetsRoot:assets});
    const operationId=randomUUID();const gate=await f.maintenance.enterMaintenance({operationId,expectedGeneration:0,owner:'installer',leaseUntil:Date.now()+60000});await f.maintenance.markExclusive(operationId,gate.generation);
    const ctx={expectedGeneration:gate.generation,selfcheck:{operationId,generation:gate.generation}};const j=await f.jobs.enqueue({kind:'echo',value:'synthetic success',idempotencyKey:randomUUID(),scope:f.scope},ctx);await new JobRunner(f.jobs).runOnce('synthetic',ctx,async job=>job.request.value);
    const checkedAt=new Date().toISOString();const probes=(['api','worker','cli','mcp'] as const).map(role=>({role,build:f!.build,health:'healthy' as const,evidence:'authenticated_probe' as const,checkedAt}));
    for(const probe of probes)await f.projections.writeComponent(probe,{operationId,expectedGeneration:gate.generation});
    await f.projections.writeSelfcheck({jobId:j.id,featureResult:'pass',checkedAt,probes},{operationId,expectedGeneration:gate.generation});
    await f.projections.writeInstall({operationId,stage:'complete',result:'succeeded',cleanup:'complete',targetBuild:f.build,actualBuild:f.build,checkedAt},{operationId,expectedGeneration:gate.generation});
    await page.goto(f.api.origin+'/status');await expect(page.locator('#pair-code')).toHaveText(/^[A-F0-9]{16}$/);await f.approve(await page.locator('#pair-code').innerText());await page.getByRole('button').click();await expect(page.locator('#protected')).toContainText('操作完成：目标版本已启动');
    await context.setOffline(true);await page.getByRole('button').click();await expect(page.getByRole('status')).toContainText('以下为上次读取结果');
    await expect(page.getByRole('heading',{name:'上次操作记录（旧快照）'})).toBeVisible();await expect(page.locator('#protected')).not.toContainText('API 可连接');await expect(page.locator('#protected')).toContainText('当前运行状态未确认');
  }finally{if(f)await f.close();await h.cleanup();}
});
