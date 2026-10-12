function stampPrintTime() {
    const el = document.getElementById('printed-at');
    if (!el) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    el.textContent = `${hours}:${minutes}:${seconds}`;
}

function fitHeaderBox() {
    const frame = document.querySelector('.header-frame');
    const header = document.querySelector('.header');
    if (!frame || !header) return;

    header.style.transform = 'none';
    frame.style.height = 'auto';

    const designWidth = header.offsetWidth;
    const designHeight = header.offsetHeight;
    const available = frame.clientWidth;
    if (!designWidth || !available) return;

    const scale = available / designWidth;
    header.style.transform = `scale(${scale})`;
    frame.style.height = `${designHeight * scale}px`;
}

const headerFrame = document.querySelector('.header-frame');
if (headerFrame && 'ResizeObserver' in window) {
    new ResizeObserver(fitHeaderBox).observe(headerFrame);
} else {
    // Sem ResizeObserver o resize é o único gatilho; com ele seria trabalho duplicado
    window.addEventListener('resize', fitHeaderBox);
}

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitHeaderBox);
}
fitHeaderBox();

let typewriterStarted = false;
function startTypewriter() {
    if (typewriterStarted) return;
    typewriterStarted = true;
    const el = document.getElementById('typewriter');
    if (!el) return;

    const words = ['IA', 'Sistemas', 'Criativo', 'Código'];
    const typeMs = 90;
    const deleteMs = 50;
    const pauseMs = 900;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
        el.textContent = words.reduce((longest, word) =>
            word.length > longest.length ? word : longest
        );
        return;
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Enquanto a aba está oculta a animação não avança: economiza CPU e bateria
    const whileVisible = () =>
        document.hidden
            ? new Promise((resolve) => {
                  const onShow = () => {
                      document.removeEventListener('visibilitychange', onShow);
                      resolve();
                  };
                  document.addEventListener('visibilitychange', onShow);
              })
            : Promise.resolve();

    async function typeWord(word) {
        for (let i = 1; i <= word.length; i += 1) {
            await whileVisible();
            el.textContent = word.slice(0, i);
            await wait(typeMs);
        }
    }

    async function deleteWord() {
        while (el.textContent.length > 0) {
            await whileVisible();
            el.textContent = el.textContent.slice(0, -1);
            await wait(deleteMs);
        }
    }

    async function loop() {
        for (let i = 0; i < words.length; i += 1) {
            await whileVisible();
            await typeWord(words[i]);
            await wait(pauseMs);
            await deleteWord();
            await wait(250);
        }
        loop();
    }

    loop();
}

/* ---------- Som de impressora (efeito de recibo gravado) ---------- */
const PRINTER_SOUND_SRC = 'sounds/printer-thermal.mp3';
let printerAudio = null;
let printerStopTimer = null;

function getPrinterAudio() {
    if (printerAudio) return printerAudio;
    printerAudio = new Audio(PRINTER_SOUND_SRC);
    printerAudio.preload = 'none';
    printerAudio.volume = 0.2;
    return printerAudio;
}

function unlockPrinterAudio() {
    try {
        const audio = getPrinterAudio();
        audio.muted = true;
        const play = audio.play();
        if (play) {
            play
                .then(() => {
                    if (audio.muted) {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.muted = false;
                    }
                })
                .catch(() => {
                    audio.muted = false;
                });
        }
    } catch { /* Audio is optional, including synchronous browser failures. */ }
}

function playPrinterSound(ms) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden || ms < 200) return false;
    try {
        const audio = getPrinterAudio();
        if (printerStopTimer) {
            clearTimeout(printerStopTimer);
            printerStopTimer = null;
        }
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        const play = audio.play();
        if (play) play.catch(() => {});
        printerStopTimer = setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
            printerStopTimer = null;
        }, ms);
        return true;
    } catch { return false; }
}

/* ---------- One clock owns the mechanism, HTML feed and audio. ---------- */
const stage = document.querySelector('.container');
const printPapers = document.querySelectorAll('.print-paper');
const MOBILE_SHEET = window.matchMedia('(max-width: 640px)');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const printerHost = document.getElementById('printer-scene');
const powerButton = document.getElementById('power-button');
const skipButton = document.getElementById('skip-animation');
const printerStatus = document.getElementById('printer-status');
const receipt = document.querySelector('.left-half');
const phases = { 'powering-on': 420, 'warming-up': 700, printing: 4340 };
const phaseText = {
    idle: 'Desligada · pronta quando você estiver',
    'powering-on': 'Ligando…',
    'warming-up': 'Aquecendo · alinhando a cabeça de impressão…',
    printing: 'Imprimindo seu portfólio…',
    completed: 'Impressão concluída · boa leitura.'
};
let printerState = 'idle';
let scene3d = null;
let staticMode = false;
let elapsed = 0;
let frameId = 0;
let lastTime = 0;
let receiptHeight = 0;

function stopPrinterSound() {
    clearTimeout(printerStopTimer);
    printerStopTimer = null;
    if (printerAudio) {
        printerAudio.pause();
        printerAudio.loop = false;
    }
}

function setPrinterState(next) {
    printerState = next;
    elapsed = 0;
    document.body.dataset.printerState = next;
    printerStatus.textContent = phaseText[next];
    if (next === 'printing' && !document.hidden) {
        playPrinterSound(phases.printing);
    }
}

function completePrint() {
    if (printerState === 'completed' || printerState === 'idle') return;
    cancelAnimationFrame(frameId);
    frameId = 0;
    stopPrinterSound();
    setPrinterState('completed');
    stage.style.removeProperty('--feed-height');
    stage.inert = false;
    stage.removeAttribute('aria-hidden');
    skipButton.hidden = true;
    try { scene3d?.update('completed', 0); } catch { useStaticPrinter(); }
    // No animated translate/scale remains on the receipt; keep its original tilt.
    startTypewriter();
    if (!motionPreference.matches) {
        receipt.animate([{ transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }],
            { duration: 460, easing: 'cubic-bezier(.2,.75,.3,1)' });
    }
    document.getElementById('portfolio').focus({ preventScroll: true });
    // Último enquadramento: fim do recibo, sem uma rolagem contínua após imprimir.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
}

function feedPaper() {
    if (printerState !== 'printing') return;
    const progress = Math.min(1, elapsed / phases.printing);
    // A slight feed cadence, monotonic even at low frame rates.
    const feed = progress - Math.sin(progress * Math.PI * 24) * .0018;
    const printedHeight = Math.ceil(receiptHeight * feed);
    stage.style.setProperty('--feed-height', `${printedHeight}px`);
    // Acompanha a ponta que está saindo e reserva espaço para os controles.
    const paperTop = stage.getBoundingClientRect().top + window.scrollY;
    const target = Math.max(0, paperTop + printedHeight - window.innerHeight + 112);
    window.scrollTo({ top: target, behavior: 'instant' });
}

function tick(now) {
    frameId = 0;
    if (document.hidden || printerState === 'completed' || printerState === 'idle') return;
    elapsed += lastTime ? now - lastTime : 0;
    lastTime = now;
    if (elapsed >= phases[printerState]) {
        if (printerState === 'printing') { completePrint(); return; }
        setPrinterState(printerState === 'powering-on' ? 'warming-up' : 'printing');
    }
    feedPaper();
    // A failed GPU must never interrupt the HTML clock.
    try { scene3d?.update(printerState, elapsed); } catch { useStaticPrinter(); }
    frameId = requestAnimationFrame(tick);
}

function alignOutlet(width, overlap) {
    document.body.style.setProperty('--outlet-width', `${width}px`);
    document.body.style.setProperty('--outlet-overlap', `${overlap}px`);
}

function measureReceipt() {
    receiptHeight = receipt.offsetHeight + 64;
    feedPaper();
}

function resizePrinter() {
    if (scene3d) {
        try { scene3d.resize(); } catch { useStaticPrinter(); }
    } else {
        const slot = printerHost.querySelector('.static-slot').getBoundingClientRect();
        const bounds = printerHost.getBoundingClientRect();
        alignOutlet(slot.width, bounds.bottom - (slot.bottom - 2));
    }
    fitHeaderBox();
    measureReceipt();
}

function useStaticPrinter() {
    scene3d?.dispose();
    scene3d = null;
    staticMode = true;
    printerHost.classList.remove('has-webgl');
    document.getElementById('printer-hint').textContent = 'Prévia estática · seu portfólio está pronto para imprimir.';
    resizePrinter();
}

function bootSite() {
    if (printerState !== 'idle') return;
    powerButton.disabled = true;
    skipButton.hidden = false;
    document.body.classList.add('is-on');
    stampPrintTime();
    resizePrinter();
    setPrinterState('powering-on');
    if (motionPreference.matches) { completePrint(); return; }
    unlockPrinterAudio();
    skipButton.focus({ preventScroll: true });
    lastTime = 0;
    frameId = requestAnimationFrame(tick);
}

// Enable the gate only after its independent controls have been attached.
powerButton.addEventListener('click', bootSite);
skipButton.addEventListener('click', completePrint);
stage.inert = true;
stage.setAttribute('aria-hidden', 'true');
document.body.classList.add('printer-enabled');
document.body.dataset.printerState = 'idle';
resizePrinter();
window.addEventListener('resize', resizePrinter);
if ('ResizeObserver' in window) new ResizeObserver(measureReceipt).observe(receipt);
document.fonts?.ready.then(resizePrinter);
document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        stopPrinterSound();
    } else if (printerState !== 'idle' && printerState !== 'completed') {
        lastTime = 0;
        if (printerState === 'printing') {
            playPrinterSound(phases.printing - elapsed);
        }
        frameId = requestAnimationFrame(tick);
    }
});
motionPreference.addEventListener('change', event => { if (event.matches) completePrint(); });

// A stalled or missing module cannot hold the start button hostage.
const sceneDeadline = setTimeout(useStaticPrinter, 8000);
import('./printer-scene.js').then(({ createPrinter }) => {
    clearTimeout(sceneDeadline);
    // Don't move the paper's source while it is already feeding.
    if (staticMode || printerState !== 'idle') return;
    try {
        scene3d = createPrinter(printerHost, alignOutlet, useStaticPrinter);
        resizePrinter();
    } catch { useStaticPrinter(); }
}).catch(() => { clearTimeout(sceneDeadline); useStaticPrinter(); });

/* ---------- Papéis impressos (Skills, About me) ---------- */
let paperLayer = 30;
let extraPrint = null;

function stopExtraPrint() {
    if (!extraPrint) return;
    const job = extraPrint;
    extraPrint = null;
    cancelAnimationFrame(job.frame);
    job.animation?.cancel();
    job.paper.classList.remove('is-feeding');
    stopPrinterSound();
    try { scene3d?.update('completed', 0); } catch { useStaticPrinter(); }
}

function paperTrigger(id) {
    return document.querySelector(`.paper-scrap[data-paper="${id}"]`);
}

function bringPaperForward(paper) {
    if (!paper) return;
    paperLayer += 1;
    paper.style.zIndex = paperLayer;
}

function fitExtraPaper(paper) {
    // Exibe a folha completa, inclusive em telas baixas, sem rolagem interna.
    const width = paper.offsetWidth;
    const height = paper.offsetHeight;
    const availableHeight = paper.style.top ? innerHeight - parseFloat(paper.style.top) - 28 : innerHeight - 64;
    const scale = Math.min(1, availableHeight / (height + width * .03),
        (innerWidth - 32) / (width + height * .03));
    paper.style.setProperty('--sheet-scale', Math.max(.1, scale));
}

window.addEventListener('resize', () => printPapers.forEach(paper => {
    if (extraPrint?.paper === paper) stopExtraPrint();
    paper.style.removeProperty('left');
    paper.style.removeProperty('right');
    paper.style.removeProperty('top');
    paper.style.removeProperty('bottom');
    paper.style.removeProperty('width');
    fitExtraPaper(paper);
    placePaper(paper, 0, 0);
}));
document.fonts?.ready.then(() => printPapers.forEach(fitExtraPaper));
document.querySelector('.about-photo img')?.addEventListener('load', () => printPapers.forEach(fitExtraPaper));

function openPaper(paper) {
    if (!paper) return;
    if (extraPrint) closePaper(extraPrint.paper, { restoreFocus: false, quiet: true });

    if (MOBILE_SHEET.matches) {
        printPapers.forEach((other) => {
            if (other !== paper && other.classList.contains('is-open')) {
                closePaper(other, { restoreFocus: false, quiet: true });
            }
        });
    }

    bringPaperForward(paper);
    // Traz a saída da mesma impressora ao topo antes de alimentar outra folha.
    const outletDocumentY = stage.getBoundingClientRect().top + scrollY;
    const outletTarget = Math.min(240, innerHeight * .3);
    window.scrollTo({ top: Math.max(0, outletDocumentY - outletTarget), behavior: 'instant' });
    const outletY = stage.getBoundingClientRect().top;
    const width = Math.min(520, innerWidth - 32);
    paper.style.width = `${width}px`;
    paper.style.top = `${Math.max(40, outletY + 56)}px`;
    paper.style.bottom = 'auto';
    paper.style.right = 'auto';
    fitExtraPaper(paper);
    const scale = Number(paper.style.getPropertyValue('--sheet-scale'));
    const direction = paper.id === 'about-paper' ? -1 : 1;
    const side = Math.max(0, Math.min(innerWidth * .18, (innerWidth - width * scale) / 2 - 12));
    paper.style.left = `${innerWidth / 2 + direction * side - width / 2}px`;
    placePaper(paper, 0, 0);
    paper.classList.add('is-open');
    paper.setAttribute('aria-hidden', 'false');
    paper.inert = false;
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'true');
    const closeBtn = paper.querySelector('.paper-close');
    if (motionPreference.matches) {
        closeBtn?.focus({ preventScroll: true });
        return;
    }
    // Primeiro cresce a partir da saída; só depois desliza para baixo e para o lado.
    const finalTransform = getComputedStyle(paper).transform;
    const baseLeft = parseFloat(paper.style.left) + width * (1 - scale) / 2;
    const sourceX = innerWidth / 2 - width * scale / 2 - baseLeft;
    const sourceY = outletY - parseFloat(paper.style.top);
    paper.classList.add('is-feeding');
    const animation = paper.animate([
        { translate: `${sourceX}px ${sourceY}px`, transform: `scale(${scale})`, clipPath: 'inset(0 0 100% 0)', offset: 0 },
        { translate: `${sourceX}px ${sourceY}px`, transform: `scale(${scale})`, clipPath: 'inset(0 0 0% 0)', offset: .68 },
        { translate: '0px 0px', transform: finalTransform, clipPath: 'inset(-12px -50px -50px -50px)', offset: 1 }
    ], { duration: 1800, easing: 'cubic-bezier(.25,.65,.3,1)' });
    const job = { paper, animation, frame: 0 };
    extraPrint = job;
    playPrinterSound(1250);
    const start = performance.now();
    const tickExtra = now => {
        if (extraPrint !== job) return;
        try { scene3d?.update('printing', now - start); } catch { useStaticPrinter(); }
        job.frame = requestAnimationFrame(tickExtra);
    };
    job.frame = requestAnimationFrame(tickExtra);
    animation.finished.then(() => {
        if (extraPrint !== job) return;
        stopExtraPrint();
        closeBtn?.focus({ preventScroll: true });
    }).catch(() => {});
}

function closePaper(paper, options = {}) {
    if (!paper) return;
    if (extraPrint?.paper === paper) stopExtraPrint();
    const restoreFocus = options.restoreFocus !== false;
    const quiet = options.quiet === true;

    paper.classList.remove('is-open');
    paper.setAttribute('aria-hidden', 'true');
    paper.inert = true;
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'false');
    if (!quiet) playPrinterSound(1000);
    if (restoreFocus) paperTrigger(paper.id)?.focus({ preventScroll: true });
}

function shredPaper(paper) {
    if (!paper || !paper.classList.contains('is-open')) return;
    if (extraPrint?.paper === paper) stopExtraPrint();
    if (motionPreference.matches) {
        closePaper(paper, { quiet: true });
        return;
    }
    const bounds = paper.getBoundingClientRect();
    const originalWidth = paper.offsetWidth;
    const originalHeight = paper.offsetHeight;
    const template = paper.cloneNode(true);
    template.removeAttribute('id');
    template.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    template.querySelector('.paper-close')?.remove();
    template.classList.remove('is-open', 'is-feeding', 'is-dragging');
    template.classList.add('shred-copy');
    template.setAttribute('aria-hidden', 'true');
    template.inert = true;
    template.style.cssText = `width:${originalWidth}px;height:${originalHeight}px;top:0;right:auto;bottom:auto;left:0;transform:scale(${bounds.width / originalWidth},${bounds.height / originalHeight})`;
    const layer = document.createElement('div');
    layer.className = 'paper-shred-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const fragment = (left, top, width, height, cropX = 0) => {
        const strip = document.createElement('div');
        strip.className = 'paper-shred-piece';
        Object.assign(strip.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        const copy = template.cloneNode(true);
        copy.style.left = `${-cropX}px`;
        strip.append(copy);
        layer.append(strip);
        return strip;
    };
    const whole = fragment(bounds.left, bounds.top, bounds.width, bounds.height);
    // Fecha o papel real imediatamente; a cópia visual faz a passagem pelo picotador.
    closePaper(paper, { quiet: true });
    const exit = whole.animate([
        { transform: 'translateX(0) rotate(0deg)' },
        { transform: `translateX(${innerWidth - bounds.left + 80}px) rotate(7deg)` }
    ], { duration: 240, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
    exit.finished.then(async () => {
        whole.remove();
        const count = 16;
        const stripWidth = bounds.width / count;
        const motions = [];
        for (let i = 0; i < count; i++) {
            const x = bounds.left + i * stripWidth;
            const piece = fragment(x, bounds.top, Math.ceil(stripWidth - 2), bounds.height, i * stripWidth);
            const flutter = Math.sin(i * 2.4) * 75;
            const turn = Math.sin(i * 1.7) * 38;
            const animation = piece.animate([
                { transform: `translate(${innerWidth - x + 40}px, ${-50 + i * 5}px) rotate(8deg)`, opacity: 1, offset: 0 },
                { transform: `translate(${flutter}px, ${45 + i * 4}px) rotate(${turn}deg)`, opacity: 1, offset: .55 },
                { transform: `translate(${flutter - 65}px, ${innerHeight - bounds.top + 100}px) rotate(${turn * 2}deg)`, opacity: 0, offset: 1 }
            ], { duration: 1000 + (i % 5) * 55, delay: i * 14, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'both' });
            motions.push(animation.finished);
        }
        await Promise.allSettled(motions);
        layer.remove();
    }).catch(() => layer.remove());
}

function topOpenPaper() {
    const open = [...document.querySelectorAll('.print-paper.is-open')];
    if (!open.length) return null;
    open.sort((a, b) => {
        const za = Number(a.style.zIndex || window.getComputedStyle(a).zIndex) || 0;
        const zb = Number(b.style.zIndex || window.getComputedStyle(b).zIndex) || 0;
        return zb - za;
    });
    return open[0];
}

document.querySelectorAll('.paper-scrap[data-paper]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const paper = document.getElementById(btn.dataset.paper);
        if (!paper) return;
        if (paper.classList.contains('is-open')) {
            closePaper(paper);
        } else {
            openPaper(paper);
        }
    });
});

document.querySelectorAll('.paper-close[data-close]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        shredPaper(document.getElementById(btn.dataset.close));
    });
});

// Clicar no papel só traz ele para frente; fechar é pelo botão ou pelo X
document.querySelectorAll('.print-paper').forEach((paper) => {
    paper.addEventListener('click', () => {
        if (!paper.classList.contains('is-open')) return;
        if (Number(paper.style.zIndex) === paperLayer) return;
        bringPaperForward(paper);
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const paper = topOpenPaper();
    if (!paper) return;
    closePaper(paper);
});

/* O movimento atua na folha inteira, sem transformar o conteúdo interno. */
const paperPositions = new Map();
let paperDrag = null;
let returningPaper = false;
let suppressPaperClickUntil = 0;

function placePaper(paper, x, y) {
    paperPositions.set(paper, { x, y });
    paper.style.setProperty('--drag-x', `${x}px`);
    paper.style.setProperty('--drag-y', `${y}px`);
}

function resetPrintedPortfolio() {
    stopPrinterSound();
    printPapers.forEach(paper => closePaper(paper, { restoreFocus: false, quiet: true }));
    [receipt, ...printPapers].forEach(paper => placePaper(paper, 0, 0));
    document.body.classList.remove('is-on', 'paper-returning');
    stage.style.removeProperty('--feed-height');
    stage.inert = true;
    stage.setAttribute('aria-hidden', 'true');
    powerButton.disabled = false;
    skipButton.hidden = true;
    returningPaper = false;
    lastTime = 0;
    setPrinterState('idle');
    try { scene3d?.update('idle', 0); } catch { useStaticPrinter(); }
    resizePrinter();
    window.scrollTo({ top: 0, behavior: 'instant' });
    powerButton.focus({ preventScroll: true });
}

function throwPrintedPaper(position, vx, vy) {
    returningPaper = true;
    document.body.classList.add('paper-returning');
    printerStatus.textContent = 'Retornando à impressora…';
    printPapers.forEach(paper => closePaper(paper, { restoreFocus: false, quiet: true }));
    const duration = motionPreference.matches ? 0 : 480;
    const distance = Math.max(window.innerWidth, window.innerHeight) * 1.4;
    const speed = Math.hypot(vx, vy);
    const animation = receipt.animate([
        { translate: `${position.x}px ${position.y}px`, opacity: 1 },
        { translate: `${position.x + vx / speed * distance}px ${position.y + vy / speed * distance}px`, opacity: 0 }
    ], { duration, easing: 'cubic-bezier(.2,.65,.4,1)', fill: 'forwards' });
    animation.finished.then(() => {
        resetPrintedPortfolio();
        animation.cancel();
    });
}

[receipt, ...printPapers].forEach(paper => {
    paper.addEventListener('dragstart', event => { if (paperDrag) event.preventDefault(); });
    paper.addEventListener('pointerdown', event => {
        if ((paper === receipt && event.pointerType !== 'mouse') || event.button !== 0 || returningPaper ||
            printerState !== 'completed' || paper.classList.contains('is-feeding') || (paper !== receipt && !paper.classList.contains('is-open'))) return;
        // Nas folhas extras, qualquer área não interativa é uma alça de arraste.
        const excluded = paper === receipt
            ? 'a, button, input, textarea, select, p, h1, h2, li, .header-links, .scrap-stack'
            : 'a, button, input, textarea, select';
        if (event.target.closest(excluded)) return;
        if (paper !== receipt) event.preventDefault();
        const position = paperPositions.get(paper) || { x: 0, y: 0 };
        paperDrag = { paper, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            origin: position, x: position.x, y: position.y, moved: false,
            samples: [{ x: event.clientX, y: event.clientY, time: performance.now() }] };
        paper.setPointerCapture(event.pointerId);
        if (paper !== receipt) bringPaperForward(paper);
    });
    paper.addEventListener('pointermove', event => {
        const drag = paperDrag;
        if (!drag || drag.paper !== paper || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        paper.classList.add('is-dragging');
        drag.x = drag.origin.x + dx;
        drag.y = drag.origin.y + dy;
        placePaper(paper, drag.x, drag.y);
        const time = performance.now();
        drag.samples.push({ x: event.clientX, y: event.clientY, time });
        drag.samples = drag.samples.filter(sample => time - sample.time < 100);
    });
    const release = event => {
        const drag = paperDrag;
        if (!drag || drag.paper !== paper || drag.pointerId !== event.pointerId) return;
        paperDrag = null;
        paper.classList.remove('is-dragging');
        if (paper.hasPointerCapture(event.pointerId)) paper.releasePointerCapture(event.pointerId);
        if (!drag.moved) return;
        suppressPaperClickUntil = performance.now() + 250;
        const first = drag.samples[0];
        const dt = Math.max(1, performance.now() - first.time);
        const vx = (event.clientX - first.x) / dt;
        const vy = (event.clientY - first.y) / dt;
        const travel = Math.hypot(drag.x - drag.origin.x, drag.y - drag.origin.y);
        if (event.type === 'pointerup' && paper === receipt && travel > 120 && Math.hypot(vx, vy) > 1.2) {
            throwPrintedPaper(drag, vx, vy);
        } else {
            // Uma soltura comum ou cancelamento devolve a folha ao alcance.
            if (event.type !== 'pointerup') {
                placePaper(paper, drag.origin.x, drag.origin.y);
            } else if (paper !== receipt) {
                const bounds = paper.getBoundingClientRect();
                const dx = Math.max(12 - bounds.left, Math.min(0, innerWidth - 12 - bounds.right));
                const dy = Math.max(12 - bounds.top, Math.min(0, innerHeight - 12 - bounds.bottom));
                placePaper(paper, drag.x + dx, drag.y + dy);
            } else {
                const xLimit = Math.min(window.innerWidth * .3, paper.offsetWidth * .4);
                placePaper(paper, Math.max(-xLimit, Math.min(xLimit, drag.x)), Math.max(-100, Math.min(160, drag.y)));
            }
        }
    };
    paper.addEventListener('pointerup', release);
    paper.addEventListener('pointercancel', release);
    paper.addEventListener('lostpointercapture', release);
    paper.addEventListener('click', event => {
        if (performance.now() < suppressPaperClickUntil) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !returningPaper) {
        [receipt, ...printPapers].forEach(paper => placePaper(paper, 0, 0));
    }
});
