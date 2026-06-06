// Playwright test for /prototype route
import { test, expect } from '@playwright/test';

// #region agent log D
await fetch('http://127.0.0.1:7846/ingest/2a02bcd4-67b8-44cb-ae7d-61415a62c8ca',{
  method:'POST',
  headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be2d71'},
  body:JSON.stringify({sessionId:'be2d71',runId:'pre',hypothesisId:'D',location:'prototype.spec.ts:4',message:'Playwright navigation start',data:{url:'http://127.0.0.1:3000/prototype'},timestamp:Date.now()})
}).catch(()=>{});
// #endregion

test('prototype page loads and shows title', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/prototype');
  // #region agent log E
  await fetch('http://127.0.0.1:7846/ingest/2a02bcd4-67b8-44cb-ae7d-61415a62c8ca',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be2d71'},
    body:JSON.stringify({sessionId:'be2d71',runId:'pre',hypothesisId:'E',location:'prototype.spec.ts:12',message:'Page title fetched',data:{title:await page.title()},timestamp:Date.now()})
  }).catch(()=>{});
  // #endregion
  await expect(page).toHaveTitle(/Fortis/);
});
