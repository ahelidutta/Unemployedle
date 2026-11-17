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
async function navigate() {
  await call('Page.navigate', { url: pathToFileURL(path.resolve('index.html')).href });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await run('document.querySelector("#board tbody") !== null')) return;
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
  assert.equal(await run('document.querySelector("#group-stats").open'), true);
  await run('document.querySelector("#stats-games").children[1].click(); document.querySelector(`[data-period="7"]`).click()');
  assert.equal(await run('document.querySelectorAll(".heatmap .day").length'), 21);
  assert.match(await run('document.querySelector("#player-stats").textContent'), /mistakes/);
  await run('document.querySelector(".heatmap").lastElementChild.click()');
  assert.match(await run('document.querySelector("#day-detail").textContent'), /Aheli.*1 mistake/s);
  assert.equal(await run(`statsGame='wordle'; average([{value:2,won:true},{value:4,won:true},{value:7,won:false}])`), '3.0 guesses');
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
  for (const width of [320, 390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 });
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, `overflow at ${width}px`);
  }
  // A normal phone viewport should bring offscreen scores into view after a game tap.
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await run('document.querySelector("#group-stats").open=false; window.scrollTo(0,0)');
  await click('#games [data-game=connections]');
  await pause(900);
  assert.ok(await run('document.querySelector(".board-section").getBoundingClientRect().top < 200'));
  assert.ok(await run('document.querySelector(".groups").getBoundingClientRect().top >= 0'));
  await click('[data-group=night]');
  assert.equal(await run('document.querySelector("#board").dataset.group'), 'night');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS: score accuracy, group/game switching, shared-game retention, fallback, rapid input, keyboard, persistence, stats, saved cheers, score-week dialogs, puzzle view, surprise picks, reduced motion, 320–1440px layouts.');

  if (process.env.CAPTURE_PREVIEWS === '1') {
    fs.mkdirSync('previews', { recursive: true });
    fs.mkdirSync('/private/tmp/unemploydle-capture', { recursive: true });
    async function shot(name, full = false) {
      let clip;
      if (full) {
        const metrics = await call('Page.getLayoutMetrics');
        clip = { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 };
      }
      const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, ...(clip ? {clip} : {}) });
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
      await navigate();
      await run('document.querySelector("[data-group=lunch]").click(); document.querySelector("#games [data-game=wordle]").click(); cancelBoardMotion(); document.querySelector("#group-stats").open=false; window.scrollTo(0,0)');
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

    }
    console.log('Captured desktop/mobile states and interaction frames.');
  }
} finally {
  ws.close();
}
