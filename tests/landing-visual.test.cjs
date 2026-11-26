'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');

test('Certus landing uses the approved palette and renders on desktop and mobile',async()=>{
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname;const file=path.resolve(root,pathname==='/'?'index.html':`.${pathname}`);if(!file.startsWith(root)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}const ext=path.extname(file),type={'.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:/Controle de jornada/}).waitFor();
  assert.equal(await page.locator('#blackfriday-promo').count(),0,'the removed promotion modal must stay absent');
  const heroPrimary=page.locator('.hero-actions .btn-primary');
  assert.match(await heroPrimary.innerText(),/Conheça o Certus/);
  assert.equal(await heroPrimary.getAttribute('href'),'#demonstracao','Conheça o Certus should take visitors to Explore the Certus');
  const heroSecondary=page.locator('.hero-actions .btn-outline');
  assert.equal((await heroSecondary.innerText()).trim(),'Já sou cliente');
  assert.equal(await heroSecondary.getAttribute('href'),'https://vagasio.com.br/certus/','Já sou cliente should open the real login page');
  const headerDemo=page.locator('.header-actions .btn-primary');
  assert.match((await headerDemo.innerText()).trim(),/Solicitar demonstração/);
  assert.match(await headerDemo.getAttribute('href'),/^https:\/\/wa\.me\/5516997902168\?/,'Solicitar demonstração should open the confirmed commercial WhatsApp');
  const heroProof=(await page.locator('.hero-checks').innerText()).replace(/\s+/g,' ');
  assert.match(heroProof,/off-line no terminal compartilhado/i);
  assert.match(heroProof,/Demonstração e teste gratuitos/i);
  assert.match(heroProof,/Planos a partir de R\$ 59,90\/mês/i);
  const pricing=(await page.locator('#planos').innerText()).replace(/\s+/g,' ');
  assert.match(pricing,/Planos a partir de R\$ 59,90\/mês/i);
  assert.match(pricing,/Demonstração e teste gratuitos/i);
  assert.equal(await page.locator('.hero').count(),1);
  const palette=await page.evaluate(()=>{
   const css=s=>getComputedStyle(document.querySelector(s));
   return {theme:document.querySelector('meta[name="theme-color"]').content,bodyText:css('body').color,bodyBg:css('body').backgroundColor,shell:css('.dark-shell').backgroundColor,primary:css('.btn-primary').backgroundColor,featureBg:css('.feature-icon').backgroundColor,featureText:css('.feature-icon').color,eyebrow:css('.section-copy .eyebrow').color};
  });
  assert.equal(palette.theme,'#191316');
  assert.equal(palette.bodyText,'rgb(25, 19, 22)','body text should use black');
  assert.equal(palette.bodyBg,'rgb(255, 255, 255)','main background should use white');
  assert.equal(palette.primary,'rgb(123, 6, 54)','primary action should use wine');
  assert.equal(palette.featureBg,'rgb(246, 245, 246)','feature icon backing should use ice');
  assert.equal(palette.featureText,'rgb(123, 6, 54)','feature icons should use wine');
  assert.equal(palette.eyebrow,'rgb(123, 6, 54)','light-section accents should use wine');
  const desktop=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,imgs:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))}));
  assert.ok(desktop.width<=desktop.client+1,'desktop page must not overflow horizontally');
  assert.ok(desktop.imgs.every(i=>i.loaded),`all landing images should load: ${JSON.stringify(desktop.imgs)}`);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'landing-preview/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(mobile.width<=mobile.client+1,'mobile page must not expand viewport');
  assert.equal(await page.locator('.desktop-frame img').count(),1);
  assert.equal(await page.locator('.phone-frame img').count(),1);
  assert.equal(await page.locator('.tablet-frame img').count(),1);
  const deviceRatios=await page.evaluate(()=>['.desktop-frame img','.tablet-frame img','.phone-frame img'].map(s=>{const i=document.querySelector(s),r=i.getBoundingClientRect();return {selector:s,actual:r.width/r.height,native:i.naturalWidth/i.naturalHeight}}));
  assert.ok(deviceRatios.every(x=>Math.abs(x.actual-x.native)<0.04),`device screenshots must preserve original proportions: ${JSON.stringify(deviceRatios)}`);
  const deviceSizeRatio=await page.evaluate(()=>document.querySelector('.tablet-frame').getBoundingClientRect().width/document.querySelector('.phone-frame').getBoundingClientRect().width);
  assert.ok(deviceSizeRatio>1.4,`portrait tablet must be visibly larger than phone, width ratio=${deviceSizeRatio}`);
  await page.screenshot({path:'landing-preview/mobile.png',fullPage:true});
  const tourTabs=page.locator('.tour-tab');
  assert.equal(await tourTabs.count(),17,'visual tour should cover company, employee and shared-terminal screens');
  for(let i=0;i<await tourTabs.count();i++){
   const tab=tourTabs.nth(i),src=await tab.getAttribute('data-tour-src'),label=await tab.getAttribute('data-tour-title');
   await tab.click();
   await page.waitForFunction(src=>document.querySelector('#tour-image')?.getAttribute('src')===src,src,{timeout:10000});
   await page.locator('#tour-image').evaluate(img=>img.decode());
   assert.equal((await page.locator('#tour-title').innerText()).trim(),label,`tour screen ${label} should be selectable`);
   assert.ok(await page.locator('#tour-image').evaluate(img=>img.naturalWidth>0),`screenshot ${src} should load`);
  }
  await page.locator('.tour-tab').first().click();
  await page.locator('#tour-expand').click();
  await page.locator('#tour-dialog[open]').waitFor();
  await page.locator('#tour-dialog-close').click();
  assert.deepEqual(errors,[]);
  assert.ok(await page.getByRole('link',{name:/Solicitar demonstração/}).count()>=1);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
