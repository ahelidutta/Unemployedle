// Run with Node 22+ and headless Chrome listening on localhost:9234.
// CAPTURE_PREVIEWS=1 also writes screenshots and animation frames to previews/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const targets = await (await fetch(process.env.BROWSER_DEBUG_URL || 'http://127.0.0.1:9234/json')).json();
const target = targets.find(target => target.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
  if (!message.id) return;
  const handler = pending.get(message.id);
  pending.delete(message.id);
  message.error ? handler.reject(message.error) : handler.resolve(message.result);
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function run(expression) {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function click(selector) {
  // Real pointer input verifies hit testing during motion, rather than just calling handlers.
  const rect = await run(`(() => {const e=document.querySelector(${JSON.stringify(selector)}); if(e.getBoundingClientRect().top<0||e.getBoundingClientRect().bottom>innerHeight)e.scrollIntoView({block:"nearest",behavior:"instant"}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2};})()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 });
}
async function navigate(listView = true) {
  await call('Page.navigate', { url: pathToFileURL(path.resolve('index.html')).href });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await run('document.querySelector("#board tbody") !== null')) {
      if (listView) await run('document.querySelector("[data-view=rows]").click()');
      return;
    }
    await pause(50);
  }
  throw Error('Page did not initialize');
}
try {
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate();
  await run('localStorage.clear(); document.querySelector("[data-group=lunch]").click()');
  assert.deepEqual(await run('[...document.querySelectorAll("#games .game")].map(b=>b.dataset.game)'), ['wordle', 'connections', 'quillion', 'worldle']);
  await click('#games [data-game=wordle]');
  assert.match(await run('document.querySelector("#board").textContent'), /Maya.*2\/6/s);
  // The visible scores are already current while their decorative tiles are flying.
  assert.ok(await run('document.querySelectorAll(".flying-tile").length > 0'));
  assert.equal(await run('document.querySelectorAll(".score-tile").length'), 4);
  // Cheers belong to this puzzle, player, group and day; no scores change.
  await run('cheers.clear(); document.querySelector(".cheer").click()');
  assert.equal(await run('document.querySelector(".cheer").getAttribute("aria-pressed")'), 'true');
  assert.ok(await run('document.querySelectorAll(".sparkle").length > 0'));
  await run('document.querySelector("#games [data-game=connections]").click()');
  assert.equal(await run('document.querySelector(".cheer").getAttribute("aria-pressed")'), 'false');
  await run('document.querySelector("#games [data-game=wordle]").click()');
  assert.equal(await run('document.querySelector(".cheer").getAttribute("aria-pressed")'), 'true');
  await navigate();
  assert.equal(await run('document.querySelector(".cheer").getAttribute("aria-pressed")'), 'true');
  await run('document.querySelector(".cheer").click()');
  assert.equal(await run('document.querySelector(".cheer").getAttribute("aria-pressed")'), 'false');
  assert.equal(await run('document.querySelector("#buddy")'), null);
  await click('.score-tile');
  assert.equal(await run('document.querySelector("#score-dialog").open'), true);
  assert.match(await run('document.querySelector("#score-dialog").textContent'), /Maya’s puzzle week/);
  assert.equal(await run('document.querySelectorAll(".week-day").length'), 7);
  await call('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await call('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await run('document.querySelector("#score-dialog").open'), false);
  await click('[data-view=tiles]');
  assert.equal(await run('document.querySelector("#board table").hidden'), true);
  assert.equal(await run('document.querySelectorAll(".mosaic-card").length'), 5);
  await click('.mosaic-card');
  assert.equal(await run('document.querySelector("#score-dialog").open'), true);
  await click('.dialog-close');
  await click('[data-view=rows]');
  const beforeSurprise = await run('selectedGame');
  await click('#pick-for-me');
  assert.notEqual(await run('selectedGame'), beforeSurprise);
  await run('document.querySelector("#games [data-game=wordle]").click(); window.scrollTo(0,0)');
  await click('[data-group=night]');
  assert.equal(await run('document.querySelector("#board").dataset.game'), 'connections');
  assert.match(await run('document.querySelector("#board").textContent'), /Night Owls.*Nina.*0 mistakes/s);
  assert.doesNotMatch(await run('document.querySelector("#board tbody").textContent'), /Maya|Jordan|Riley/);
  assert.deepEqual(await run('[...document.querySelectorAll("#games .game")].map(b=>b.dataset.game)'), ['connections', 'worldle']);
  await click('#games [data-game=worldle]');
  assert.match(await run('document.querySelector("#board").textContent'), /Leo.*1\/6/s);
  await click('[data-group=lunch]');
  assert.equal(await run('document.querySelector("#board").dataset.game'), 'worldle');
  assert.match(await run('document.querySelector("#board").textContent'), /Riley.*2\/6/s);
  // Rapid input must leave only the last selected board and no orphaned flights.
  await run(`for (const id of ['connections','wordle','quillion','worldle']) document.querySelector('#games [data-game='+id+']').click()`);
  assert.equal(await run('document.querySelector("#board").dataset.game'), 'worldle');
  await pause(1000);
  assert.equal(await run('document.querySelectorAll(".flying-tile").length'), 0);
  await run('document.querySelector("[data-group=night]").focus()');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await run('document.querySelector("#board").dataset.group'), 'night');
  assert.equal(await run('localStorage.getItem("unemploydle:lastGroup")'), 'night');
  await navigate();
  assert.equal(await run('document.querySelector("#board").dataset.group'), 'night');
  await click('.stats-link');
  assert.equal(await run('document.querySelector("#group-stats").closest(".board-shell").querySelector("#board") === document.querySelector("#board")'), true);
  assert.equal(await run('statsGame'), 'connections');
  assert.equal(await run('document.querySelectorAll(".compare-row").length'), 3);
  assert.equal(await run('document.querySelector("#pair-comparison")'), null);
  assert.equal(await run('document.querySelector("#comparison-metrics")'), null);
  assert.doesNotMatch(await run('document.querySelector("#group-stats").textContent'), /Solve rate|Average score|face-off/i);
  const ninaDays = await run('daysLed(filteredHistory(),"Nina")');
  assert.equal(await run('document.querySelector(`.standing-badge[data-standings-player="Nina"]`).textContent.trim()'), `${ninaDays} ${ninaDays===1?'day':'days'} in first`);
  assert.match(await run('document.querySelector("#leader-story").textContent'), /in first/);
  await click('.shared-history > summary');
  assert.equal(await run('document.querySelectorAll(".heatmap .day").length'), 21);
  await run('document.querySelector(".heatmap td:last-child .day").click()');
  assert.match(await run('document.querySelector("#day-detail").textContent'), /Aheli.*1 mistake/s);
  assert.match(await run('document.querySelector("#day-detail").textContent'), /Nina.*0 mistakes.*Leo.*No play recorded/s);
  assert.equal(await run('document.querySelectorAll(".matrix-table .day[aria-pressed=true]").length'), 3);
  await click('.compare-row[data-player=Nina]');
  assert.equal(await run('document.querySelector(`.heatmap[data-player="Nina"]`).dataset.highlight'), 'true');
  assert.equal(await run('document.querySelector(`.mosaic-card[data-player="Nina"]`).closest(".mosaic-piece").dataset.highlight'), 'true');
  assert.match(await run('document.querySelector("#standings-selection").textContent'), /Nina.*in first/);
  assert.deepEqual(await run('standingSummary([{name:"A",led:4},{name:"B",led:4},{name:"C",led:3}]).leaders.map(r=>r.name)'), ['A','B']);
  assert.equal(await run('standingSummary([{name:"A",led:0},{name:"B",led:0}]).leaders.length'), 0);
  await run('document.querySelector(`[data-period="28"]`).click()');
  assert.equal(await run('document.querySelectorAll(".heatmap .day").length'), 84);
  assert.equal(await run('document.querySelector(`.standing-badge[data-standings-player="Nina"]`).textContent.includes(daysLed(filteredHistory(),"Nina"))'), true);
  await click('[data-standing-scope=all]');
  assert.equal(await run('statsGame'), 'all');
  await run('document.querySelector("#games [data-game=worldle]").click()');
  assert.equal(await run('statsGame'), 'all');
  await click('[data-standing-scope=game]');
  assert.equal(await run('statsGame'), 'worldle');
  assert.match(await run('document.querySelector("#comparison-scope").textContent'), /Worldle.*28 days/);
  await run('document.querySelector(`[data-period="7"]`).click()');
  assert.equal(await run(`daysLed([{player:'A',date:'d1',game:'wordle',value:2,won:true},{player:'B',date:'d1',game:'wordle',value:2,won:true},{player:'A',date:'d1',game:'connections',value:0,won:true}], 'A')`), 1);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await run('document.querySelector("[data-group=lunch]").click(); document.querySelector("#games [data-game=wordle]").click()');
  assert.equal(await run('document.querySelectorAll(".flying-tile").length'), 0);
  assert.equal(await run('boardAnimations.length'), 0);
  await run('document.querySelector(".cheer").click(); document.querySelector("#pick-for-me").click()');
  assert.equal(await run('littleAnimations.size'), 0);
  assert.equal(await run('document.querySelectorAll(".sparkle").length'), 0);
  assert.match(await run('document.querySelector("#board tbody").textContent'), /Maya/);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 });
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, `overflow at ${width}px`);
  }
  // A normal phone viewport should bring offscreen scores into view after a game tap.
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await run('document.querySelector(".shared-history").open=false; window.scrollTo(0,0)');
  await click('#games [data-game=connections]');
  await pause(900);
  assert.ok(await run('document.querySelector(".board-section").getBoundingClientRect().top < 200'));
  assert.ok(await run('document.querySelector(".groups").getBoundingClientRect().top >= 0'));
  await click('[data-group=night]');
  assert.equal(await run('document.querySelector("#board").dataset.group'), 'night');
  // The new shared board opens in Pieces mode. Cheers must sync with List mode.
  await navigate(false);
  await run('document.querySelector("[data-group=lunch]").click()');
  assert.equal(await run('boardView'), 'tiles');
  assert.equal(await run('document.querySelector("#completion-fraction").textContent'), '12/20');
  await click('.mosaic .cheer');
  assert.equal(await run('document.querySelector(".mosaic .cheer").getAttribute("aria-pressed") === document.querySelector("table .cheer").getAttribute("aria-pressed")'), true);
  await click('[data-view=rows]');
  await click('[data-view=tiles]');
  await click('.mosaic-card');
  assert.equal(await run('document.querySelector("#score-dialog").open'), true);
  await click('.dialog-close');
  assert.equal(await run('document.activeElement.classList.contains("mosaic-card")'), true);
  // Layout remains usable in landscape and with the WCAG text-spacing overrides.
  await call('Emulation.setDeviceMetricsOverride', {width:844,height:390,deviceScaleFactor:1,mobile:true});
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true);
  await call('Emulation.setDeviceMetricsOverride', {width:375,height:844,deviceScaleFactor:1,mobile:true});
  await run(`document.querySelector('main').insertAdjacentHTML('beforeend', '<style id="spacing-test">*{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important}p{margin-bottom:2em!important}</style>')`);
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true);
  await run('document.querySelector("#spacing-test").remove()');
  await click('[data-stats-link]');
  assert.equal(await run('document.querySelectorAll(".compare-row").length'), 5);
  assert.equal(await run('document.querySelectorAll(".matrix-table .heatmap").length'), 5);
  await run('document.querySelector(".shared-history").open=true');
  assert.equal(await run('document.querySelector("#group-calendar").scrollWidth <= document.querySelector("#group-calendar").clientWidth'), true, 'the seven-day matrix should fit a 375px phone');
  // Check the principal semantic color pairs independently of screenshots.
  function luminance(hex) {const rgb=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  function contrast(a,b){const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(l[0]+.05)/(l[1]+.05);}
  for(const [ink,surface] of [['#172b45','#f1f4fc'],['#52617a','#ffffff'],['#ffffff','#1652cc'],['#283d21','#dcf139'],['#fffdf4','#006e59'],['#fffdf4','#1b52d9'],['#fffdf4','#bf3f22'],['#fffdf4','#7b33be'],['#fffdf4','#b62c6a'],['#fffdf4','#006f94'],['#fffdf4','#b13c56'],['#071c2f','#ef512e']])assert.ok(contrast(ink,surface)>=4.5, `${ink} on ${surface}`);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS: score accuracy, group/game switching, shared-game retention, fallback, rapid input, keyboard, persistence, connected first-place standings, tied leaders, synchronized board badges, aligned activity, saved cheers, score-week dialogs, puzzle view, surprise picks, reduced motion, synced piece/list cheers, dialog focus return, contrast pairs, text spacing, landscape, 320–1440px layouts.');

  if (process.env.CAPTURE_PREVIEWS === '1') {
    fs.mkdirSync('previews', { recursive: true });
    fs.mkdirSync('/private/tmp/unemploydle-capture', { recursive: true });
    async function shot(name, full = false, selector = null) {
      let clip;
      if (full) {
        const metrics = await call('Page.getLayoutMetrics');
        clip = { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 };
      }
      if(selector) clip=await run(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
      const result = await call('Page.captureScreenshot' , { format: 'png', captureBeyondViewport: true, ...(clip ? {clip} : {}) });
      fs.writeFileSync(full ? `previews/${name}.png` : `/private/tmp/unemploydle-capture/${name}.png`, Buffer.from(result.data, 'base64'));
      return result.data;
    }
    // Freeze each animation at explicit times so the captured sequence is repeatable.
    async function frames(name, selector) {
      await run(`document.querySelector(${JSON.stringify(selector)}).click(); for (const a of document.getAnimations()) a.pause()`);
      const list = [];
      for (const time of [0, 70, 140, 210, 280, 350, 420, 490, 560, 700, 900]) {
        await run(`for(const a of document.getAnimations()) { a.pause(); a.currentTime=${time}; }`);
        list.push({ image: await shot(`${name}-${time}`), delay: time === 900 ? 1100 : 80 });
      }
      await run('cancelBoardMotion(); for (const a of document.getAnimations()) a.finish(); for(const bit of document.querySelectorAll(".sparkle")) bit.remove()');
      return list;
    }
    for (const [name,width,height] of [['desktop',1440,1350],['mobile',390,1650]]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'mobile' });
      await navigate(false);
      await run('document.querySelector("[data-group=lunch]").click(); document.querySelector("#games [data-game=wordle]").click(); cancelBoardMotion(); document.querySelector(".shared-history").open=false; window.scrollTo(0,0)');
      await pause(450);
      await shot(`${name}-lunch-wordle`,true);
      const initial = {image:await shot(`${name}-home-frame`),delay:1300};
      const game = await frames(`${name}-game-switch`, '#games [data-game=connections]');
      await shot(`${name}-lunch-connections`,true);
      const settledGame = {image:await shot(`${name}-lunch-connections-frame`),delay:1300};
      const group = await frames(`${name}-group-switch`, '[data-group=night]');
      await shot(`${name}-night-connections`,true);
      const settledGroup = {image:await shot(`${name}-night-connections-frame`),delay:1500};
      const world = await frames(`${name}-worldle-switch`, '#games [data-game=worldle]');
      await shot(`${name}-night-worldle`,true);
      const settledWorld = {image:await shot(`${name}-night-worldle-frame`),delay:1800};

      await frames(`${name}-cheer`, '#board .cheer');
      await frames(`${name}-puzzle`, '[data-view=tiles]');
      await shot(`${name}-puzzle-board`,true);
      await run('document.querySelector(".mosaic-card").click()');
      await shot(`${name}-player-week`);
      await run('document.querySelector("#score-dialog").close()');
      await run('document.querySelector("[data-group=lunch]").click(); document.querySelector("#games [data-game=wordle]").click();cancelBoardMotion();standingScope="game";statsGame=selectedGame;statsPeriod=7;renderStats();window.scrollTo(0,0)');
      await pause(450);
      await shot(`${name}-group-stats`,true,'.board-shell');


    }
    console.log('Captured desktop/mobile states and interaction frames.');
  }
} finally {
  ws.close();
}
