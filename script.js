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

function startTypewriter() {
    const el = document.getElementById('typewriter');
    if (!el) return;

    const words = ['AI', 'System', 'Creative', 'Tech'];
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
    printerAudio.volume = 0.85;
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
const phases = { 'powering-on': 600, 'warming-up': 1000, printing: 6200 };
const phaseText = {
    idle: 'Offline · ready when you are',
    'powering-on': 'Powering on…',
    'warming-up': 'Warming up · aligning the print head…',
    printing: 'Printing your portfolio…',
    completed: 'Print complete · enjoy the read.'
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
    document.getElementById('portfolio').focus({ preventScroll: true });
}

function feedPaper() {
    if (printerState !== 'printing') return;
    const progress = Math.min(1, elapsed / phases.printing);
    // A slight feed cadence, monotonic even at low frame rates.
    const feed = progress - Math.sin(progress * Math.PI * 24) * .0018;
    stage.style.setProperty('--feed-height', `${Math.ceil(receiptHeight * feed)}px`);
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
    document.getElementById('printer-hint').textContent = 'Static preview · your portfolio is ready to print.';
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

function paperTrigger(id) {
    return document.querySelector(`.paper-scrap[data-paper="${id}"]`);
}

function bringPaperForward(paper) {
    if (!paper) return;
    paperLayer += 1;
    paper.style.zIndex = paperLayer;
}

function openPaper(paper) {
    if (!paper) return;

    if (MOBILE_SHEET.matches) {
        printPapers.forEach((other) => {
            if (other !== paper && other.classList.contains('is-open')) {
                closePaper(other, { restoreFocus: false, quiet: true });
            }
        });
    }

    bringPaperForward(paper);
    paper.classList.add('is-open');
    paper.setAttribute('aria-hidden', 'false');
    paper.inert = false;
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'true');
    playPrinterSound(2000);

    const closeBtn = paper.querySelector('.paper-close');
    requestAnimationFrame(() => closeBtn?.focus());
}

function closePaper(paper, options = {}) {
    if (!paper) return;
    const restoreFocus = options.restoreFocus !== false;
    const quiet = options.quiet === true;

    paper.classList.remove('is-open');
    paper.setAttribute('aria-hidden', 'true');
    paper.inert = true;
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'false');
    if (!quiet) playPrinterSound(1000);
    if (restoreFocus) paperTrigger(paper.id)?.focus();
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
        closePaper(document.getElementById(btn.dataset.close));
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
