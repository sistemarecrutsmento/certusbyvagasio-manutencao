'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');

test('Certus sales landing serves its real app screenshots and fits desktop/mobile',async()=>{
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname;const file=path.resolve(root,pathname==='/'?'index.html':`.${pathname}`);if(!file.startsWith(root)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}const ext=path.extname(file),type={'.html':'text/html; charset=utf-8','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:/Controle de jornada/}).waitFor();
  const desktop=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,imgs:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))}));
  assert.ok(desktop.width<=desktop.client+1,'desktop page must not overflow horizontally');
  assert.ok(desktop.imgs.every(i=>i.loaded),`all landing images should load: ${JSON.stringify(desktop.imgs)}`);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'landing-preview/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'landing-preview/mobile.png',fullPage:true});
  const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(mobile.width<=mobile.client+1,'mobile page must not expand viewport');
  assert.equal(await page.locator('.desktop-frame img').count(),1);
  assert.equal(await page.locator('.phone-frame img').count(),1);
  assert.equal(await page.locator('.tablet-frame img').count(),1);
  assert.equal(await page.locator('.desktop-frame img').count(),1);
  const deviceRatios=await page.evaluate(()=>['.desktop-frame img','.tablet-frame img','.phone-frame img'].map(s=>{const i=document.querySelector(s),r=i.getBoundingClientRect();return {selector:s,actual:r.width/r.height,native:i.naturalWidth/i.naturalHeight}}));
  assert.ok(deviceRatios.every(x=>Math.abs(x.actual-x.native)<0.04),`device screenshots must preserve their original proportions: ${JSON.stringify(deviceRatios)}`);
  const portraitTablet=await page.locator('.tablet-frame img').evaluate(i=>i.naturalHeight>i.naturalWidth);
  assert.equal(portraitTablet,true,'shared terminal must be shown on a portrait tablet');
  const deviceSizeRatio=await page.evaluate(()=>document.querySelector('.tablet-frame').getBoundingClientRect().width/document.querySelector('.phone-frame').getBoundingClientRect().width);
  assert.ok(deviceSizeRatio>2,`tablet must read visibly larger than phone, width ratio=${deviceSizeRatio}`);
  const standAlignment=await page.evaluate(()=>{const m=document.querySelector('.desktop-frame').getBoundingClientRect(),s=document.querySelector('.desktop-stand').getBoundingClientRect();return Math.abs((m.left+m.width/2)-(s.left+s.width/2))});
  assert.ok(standAlignment<2,`monitor stand must be centered under display, offset=${standAlignment}px`);
  const bezel=await page.locator('.desktop-frame').evaluate(e=>parseFloat(getComputedStyle(e).borderLeftWidth));
  assert.ok(bezel<=1.5,`monitor bezel should be slim, got ${bezel}px`);
  assert.ok(await page.getByRole('link',{name:/Solicitar demonstração/}).count()>=1);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
