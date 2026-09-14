/* Run against a local HTTP server. No changes to the website's runtime. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.TEST_URL || 'http://127.0.0.1:8765';
const output = path.resolve('_verify/printer');
fs.mkdirSync(output, { recursive: true });
const results = [];
const instrument = () => {
    window.testStats = { states: [], draws: 0, cls: 0, plays: 0, clicks: [] };
    new MutationObserver(records => {
        for (const record of records) if (record.attributeName === 'data-printer-state') {
            window.testStats.states.push(document.body.dataset.printerState);
        }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-printer-state'] });
    new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.testStats.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
    for (const name of ['drawElements', 'drawArrays']) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) { window.testStats.draws++; return original.apply(this, args); };
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { window.testStats.plays++; return play.apply(this, args); };
};

(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true
    });
    async function pageFor(options = {}, setup) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.testErrors = errors;
        await page.addInitScript(instrument);
        if (setup) await setup(page);
        await page.goto(url);
        await page.waitForFunction(() => document.body.dataset.printerState === 'idle');
        return page;
    }
    async function completed(page) {
        await page.waitForFunction(() => document.body.dataset.printerState === 'completed', null, { timeout: 15000 });
        assert.equal(await page.locator('.container').evaluate(e => e.inert), false);
        assert.equal(await page.locator('.container').getAttribute('aria-hidden'), null);
        assert.equal(await page.locator('.left-half').evaluate(e => getComputedStyle(e).animationName), 'none');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
    }
    async function idleDraws(page) {
        const before = await page.evaluate(() => window.testStats.draws);
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => window.testStats.draws), before, 'idle GPU draws');
    }
    try {
        for (const [width, height] of [[320,568],[375,812],[768,1024],[1024,768],[1440,900],[2560,1080]]) {
            const page = await pageFor({ viewport: { width, height } });
            await page.waitForSelector('.has-webgl');
            await page.screenshot({ path: `${output}/${width}-idle.png` });
            assert.equal(await page.evaluate(() => window.testStats.plays), 0);
            await idleDraws(page);
            await page.keyboard.press('Tab');
            assert.equal(await page.locator('#power-button').evaluate(e => e === document.activeElement), true);
            await page.keyboard.press('Enter');
            // Duplicate click/programmatic events must not create another clock.
            await page.locator('#power-button').dispatchEvent('click');
            await page.waitForFunction(() => document.body.dataset.printerState === 'printing');
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${output}/${width}-printing.png` });
            assert.equal(await page.locator('.container').evaluate(e => e.inert), true);
            const firstHeight = await page.locator('.container').evaluate(e => e.clientHeight);
            await page.waitForTimeout(400);
            assert.ok(await page.locator('.container').evaluate(e => e.clientHeight) > firstHeight);
            await completed(page);
            await idleDraws(page);
            const stats = await page.evaluate(() => window.testStats);
            assert.deepEqual(stats.states, ['idle','powering-on','warming-up','printing','completed']);
            assert.ok(stats.cls < .05, `CLS ${stats.cls}`);
            await page.screenshot({ path: `${output}/${width}-complete.png` });
            // Keyboard opens both sheets, Escape closes and restores focus.
            await page.keyboard.press('Tab');
            await page.keyboard.press('Enter');
            await page.waitForSelector('#skills-paper.is-open');
            await page.waitForTimeout(2100);
            assert.equal(await page.locator('#skills-paper .paper-close').evaluate(e => e === document.activeElement), true);
            await page.screenshot({ path: `${output}/${width}-skills.png` });
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('[data-paper="skills-paper"]').evaluate(e => e === document.activeElement), true);
            await page.keyboard.press('Tab');
            await page.keyboard.press('Enter');
            await page.waitForSelector('#about-paper.is-open');
            await page.waitForTimeout(2100);
            await page.screenshot({ path: `${output}/${width}-about.png` });
            await page.keyboard.press('Escape');
            // Exercise pointer hit testing on each existing link, without navigating externally.
            await page.evaluate(() => document.querySelectorAll('main a').forEach(link => link.addEventListener('click', event => {
                event.preventDefault(); window.testStats.clicks.push(link.href);
            })));
            for (const link of await page.locator('main a').all()) await link.click();
            assert.equal(await page.evaluate(() => window.testStats.clicks.length), await page.locator('main a').count());
            assert.equal(await page.locator('h1').evaluate(e => { const range = document.createRange(); range.selectNodeContents(e); getSelection().removeAllRanges(); getSelection().addRange(range); return getSelection().toString(); }), 'Davi Rodrigues');
            assert.deepEqual(page.testErrors, []);
            results.push({ test: `${width}x${height}: full sequence, keyboard, sheets, links, selection, no idle rendering`, cls: stats.cls, pass: true });
            await page.close();
        }
        const faults = [
            ['no-webgl', async p => p.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.includes('webgl') ? null : get.call(this, type, ...args); }; })],
            ['module-failure', async p => p.route('**/printer-scene.js', route => route.abort())],
            ['vendor-failure', async p => p.route('**/vendor/three/*', route => route.abort())],
            ['audio-blocked', async p => p.addInitScript(() => { HTMLMediaElement.prototype.play = function() { return Promise.reject(new DOMException('Blocked', 'NotAllowedError')); }; })],
            ['audio-missing', async p => p.route('**/sounds/*', route => route.abort())]
        ];
        for (const [name, setup] of faults) {
            const page = await pageFor({ viewport: { width: 375, height: 812 } }, setup);
            await page.waitForTimeout(700);
            await page.click('#power-button');
            await completed(page);
            await page.screenshot({ path: `${output}/${name}.png` });
            assert.equal(page.testErrors.filter(e => !/WebGL|Failed to load resource/.test(e)).length, 0, page.testErrors.join('\n'));
            results.push({ test: name, pass: true });
            await page.close();
        }
        for (const phase of ['powering-on', 'warming-up', 'printing']) {
            const page = await pageFor();
            await page.click('#power-button');
            await page.waitForFunction(value => document.body.dataset.printerState === value, phase);
            await page.keyboard.press('Enter'); // Skip already has focus.
            await completed(page);
            await idleDraws(page);
            results.push({ test: `skip during ${phase}`, pass: true });
            await page.close();
        }
        const reduced = await pageFor({ reducedMotion: 'reduce' });
        await reduced.click('#power-button');
        await completed(reduced);
        assert.equal(await reduced.evaluate(() => window.testStats.plays), 0);
        results.push({ test: 'reduced motion: immediate content, no audio', pass: true });
        await reduced.close();

        const orientation = await pageFor({ viewport: { width: 375, height: 812 } });
        await orientation.waitForSelector('.has-webgl');
        await orientation.click('#power-button');
        await orientation.waitForFunction(() => document.body.dataset.printerState === 'printing');
        await orientation.setViewportSize({ width: 812, height: 375 });
        await orientation.waitForTimeout(300);
        await orientation.evaluate(() => { window.hiddenTest = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.hiddenTest }); document.dispatchEvent(new Event('visibilitychange')); });
        const paused = await orientation.locator('.container').evaluate(e => e.style.cssText);
        await orientation.waitForTimeout(800);
        assert.equal(await orientation.locator('.container').evaluate(e => e.style.cssText), paused);
        await idleDraws(orientation);
        await orientation.evaluate(() => { window.hiddenTest = false; document.dispatchEvent(new Event('visibilitychange')); });
        await completed(orientation);
        assert.equal(await orientation.evaluate(() => window.testStats.states.filter(s => s === 'printing').length), 1);
        results.push({ test: 'orientation during feed; simulated visibility pause/resume without duplicate start', pass: true });
        await orientation.close();

        const contextLoss = await pageFor();
        await contextLoss.waitForSelector('.has-webgl');
        await contextLoss.click('#power-button');
        await contextLoss.waitForFunction(() => document.body.dataset.printerState === 'printing');
        await contextLoss.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await completed(contextLoss);
        assert.equal(await contextLoss.locator('canvas').count(), 0);
        results.push({ test: 'GPU context loss during feed', pass: true });
        await contextLoss.close();

        const stalled = await pageFor({}, async p => p.route('**/printer-scene.js', () => {}));
        await stalled.click('#power-button');
        await stalled.click('#skip-animation');
        await completed(stalled);
        results.push({ test: 'stalled 3D request: controls usable immediately', pass: true });
        await stalled.close();
        const noJS = await browser.newPage({ javaScriptEnabled: false });
        await noJS.goto(url);
        assert.equal(await noJS.locator('.boot-screen').isVisible(), false);
        assert.equal(await noJS.locator('main').isVisible(), true);
        results.push({ test: 'JavaScript disabled: HTML available', pass: true });
        await noJS.close();
    } finally {
        await browser.close();
        fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
        console.log(JSON.stringify(results, null, 2));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
