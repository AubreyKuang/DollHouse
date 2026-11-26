/* Shared by the TapTap storage check, screenshot and video scripts: a static server
   for the built package and headless Chrome over the DevTools protocol (Node 22+
   for the global WebSocket). */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),os=require("node:os");
const {spawn}=require("node:child_process");

const root=path.resolve(__dirname,"../.."),site=path.join(root,"dist/taptap/dollhouse");
const CHROME=process.env.CHROME||"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function serve(){
  if(!fs.existsSync(path.join(site,"index.html")))throw new Error("Run python3 scripts/build-taptap.py first");
  const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
  const server=http.createServer((req,res)=>{
    const file=path.join(site,decodeURIComponent(new URL(req.url,"http://x").pathname));
    if(!file.startsWith(site)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve(server)));
}

async function chrome(){
  if(typeof WebSocket==="undefined")throw new Error("Node 22 or newer is required");
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"dollhouse-chrome-"));
  const proc=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--no-first-run","--no-default-browser-check",
    "--hide-scrollbars","--mute-audio","--autoplay-policy=no-user-gesture-required",`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","pipe"]});
  const port=await new Promise((resolve,reject)=>{
    let log="";proc.stderr.on("data",d=>{log+=d;const m=log.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/);if(m)resolve(m[1]);});
    proc.on("exit",()=>reject(new Error("Chrome exited:\n"+log)));
  });
  const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws=new WebSocket(pages.find(p=>p.type==="page").webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener("open",r,{once:true}));
  let id=0;const waiting=new Map(),listeners=new Map();
  ws.addEventListener("message",e=>{
    const m=JSON.parse(e.data);
    if(m.method){for(const fn of listeners.get(m.method)||[])fn(m.params);return;}
    if(waiting.has(m.id)){const {resolve,reject}=waiting.get(m.id);waiting.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;waiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const on=(method,fn)=>{if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);};
  const close=()=>{ws.close();proc.on("exit",()=>{try{fs.rmSync(profile,{recursive:true,force:true});}catch{/* Chrome may still be flushing its profile. */}});proc.kill();};
  const evaluate=async expression=>{
    const r=await send("Runtime.evaluate",{expression:`(async()=>{${expression}})()`,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    return r.result.value;
  };
  return {send,on,evaluate,close};
}

// Opens the package; `preload` runs before the game's scripts on every load.
async function gameSession(viewport,{preload=""}={}){
  const server=await serve(),url=`http://127.0.0.1:${server.address().port}/index.html`;
  const browser=await chrome(),{send,evaluate}=browser;
  const errors=[];
  browser.on("Runtime.exceptionThrown",({exceptionDetails})=>errors.push(exceptionDetails.exception?.description||exceptionDetails.text));
  await send("Page.enable");await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",viewport);
  if(viewport.mobile)await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
  // window.confirm would stall headless Chrome; the restart prompt is accepted.
  await send("Page.addScriptToEvaluateOnNewDocument",{source:`window.confirm=()=>true;${preload}`});
  const open=async()=>{
    await send("Page.navigate",{url});
    for(let i=0;i<100;i++){await sleep(100);if(await evaluate(`return document.readyState==="complete"`).catch(()=>false))break;}
    await sleep(800);
  };
  // Real input: keys held through the DevTools input domain, as a player would.
  const key=async(code,keyName,ms)=>{
    const vk={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Space:32,KeyP:80,Escape:27}[code];
    await send("Input.dispatchKeyEvent",{type:"keyDown",code,key:keyName,windowsVirtualKeyCode:vk});
    await sleep(ms);
    await send("Input.dispatchKeyEvent",{type:"keyUp",code,key:keyName,windowsVirtualKeyCode:vk});
  };
  const clickAt=async(x,y)=>{
    for(const type of ["mousePressed","mouseReleased"])await send("Input.dispatchMouseEvent",{type,x,y,button:"left",clickCount:1});
  };
  const click=async selector=>{
    const box=await evaluate(`const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error("no element "+${JSON.stringify(JSON.stringify(selector))});
      e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}`);
    await clickAt(box.x,box.y);
  };
  // A point on the house canvas, in scene pixels, to client coordinates.
  const sceneToClient=(x,y)=>evaluate(`const r=cv.getBoundingClientRect();
    return {x:r.left+${x}/(W+HOUSE_MARGIN)*r.width,y:r.top+${y}/HOUSE_HEIGHT*r.height}`);
  const close=()=>{browser.close();server.close();};
  return {...browser,url,errors,open,key,click,clickAt,sceneToClient,close};
}

module.exports={root,sleep,gameSession};
