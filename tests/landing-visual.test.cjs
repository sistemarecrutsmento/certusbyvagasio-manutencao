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
  assert.equal(await page.locator('.phone-frame img').count(),2);
  assert.ok(await page.getByRole('link',{name:/Solicitar demonstração/}).count()>=1);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
});
