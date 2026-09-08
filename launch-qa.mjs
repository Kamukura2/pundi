import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const base='C:/JensenBot/Tooling/PundiWebAstraLaunch';
const evidence=path.join(base,'evidence');mkdirSync(evidence,{recursive:true});
const state=JSON.parse(readFileSync(path.join(base,'preview/state.json'))),url=state.url;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({serviceWorkers:'block'});
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8');
const report={url,viewports:[],routes:[],errors};
for(const [width,height] of [[390,844],[768,1024],[1280,720],[1366,768],[1440,900],[1920,1080]]){
 await page.setViewportSize({width,height});await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async i=>{i.loading='eager';try{await i.decode()}catch{}}));});
 await page.addScriptTag({content:axe});
 const a11y=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)}))});
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),clipped:[...document.querySelectorAll('h1,h2,h3,p,summary,a')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&getComputedStyle(e).position!=='absolute'&&(r.left< -1||r.right>innerWidth+1)}).map(e=>e.textContent.slice(0,70)),fonts:document.fonts.check('700 24px "Pundi Heading"')&&document.fonts.check('400 14px "Pundi Body"'),h1:document.querySelectorAll('h1').length}));
 await page.screenshot({path:path.join(evidence,`launch-${width}x${height}.png`),fullPage:true});report.viewports.push({width,height,...layout,a11y});
}
await page.keyboard.press('Tab');report.keyboardSkip=await page.locator('.skip-link').evaluate(el=>el===document.activeElement);
await page.emulateMedia({reducedMotion:'reduce'});report.reducedMotion=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
for(const route of ['/','/landing.html','/privacy','/terms','/support','/updates','/catatan-keuangan','/pencatat-pengeluaran','/budgeting','/aset-investasi','/net-worth','/trading-journal','/backup-keuangan','/kalkulator-net-worth','/robots.txt','/sitemap.xml','/icons/icon.svg','/media/pundi-social.png','/app.html','/auth/reset-password']){
 const r=await page.goto(new URL(route,url).href,{waitUntil:'networkidle'});report.routes.push({route,status:r.status()});
 if(route==='/app.html'){
  await page.locator('#authGate').waitFor({state:'visible'});await page.locator('#authModeToggle').click();const signup=await page.locator('#authConfirm').isVisible();await page.locator('#authModeToggle').click();await page.locator('#authForgotPassword').click();report.auth={signup,forgot:await page.locator('#authTitle').textContent(),noindex:await page.locator('meta[name="robots"]').getAttribute('content')};
 }
}
report.pass=report.viewports.every(v=>!v.overflow&&!v.brokenImages.length&&!v.clipped.length&&!v.a11y.length&&v.fonts&&v.h1===1)&&report.routes.every(r=>r.status===200)&&report.auth.signup&&report.auth.forgot==='Reset password'&&report.keyboardSkip;
writeFileSync(path.join(evidence,'browser-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(!report.pass)process.exitCode=1;
