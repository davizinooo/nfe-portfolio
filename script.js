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
        el.textContent = words.join(', ');
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
            el.textContent = word.slice(0, i);
            await wait(typeMs);
        }
    }

    async function deleteWord() {
        while (el.textContent.length > 0) {
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

/* ---------- Som de impressora (sintetizado com Web Audio) ---------- */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let audioCtx = null;

function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
}

let noiseBuffer = null;

// Ruído branco filtrado: o "chiado" da cabeça térmica. Gerado uma vez e reaproveitado.
function getNoiseBuffer(ctx) {
    if (noiseBuffer) return noiseBuffer;
    const bufferSize = Math.ceil(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
        data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function buildPrinterNoise(ctx, seconds) {
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2100;
    band.Q.value = 0.7;

    // Pulso rápido no ganho: linhas sendo impressas
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(noiseGain.gain);

    // Zumbido grave do motor de arrasto
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.value = 85;
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 320;
    const motorGain = ctx.createGain();
    motorGain.gain.value = 0.025;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(1, now + 0.08);
    master.gain.setValueAtTime(1, now + Math.max(0.1, seconds - 0.18));
    master.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(master);
    motor.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(master);
    master.connect(ctx.destination);

    const stopAt = now + seconds + 0.05;
    noise.start(now);
    lfo.start(now);
    motor.start(now);
    noise.stop(stopAt);
    lfo.stop(stopAt);
    motor.stop(stopAt);
}

function playPrinterSound(ms) {
    if (REDUCE_MOTION || ms < 200) return false;
    const ctx = getAudioCtx();
    if (!ctx) return false;

    const deadline = performance.now() + ms;
    const schedule = () => {
        const remaining = deadline - performance.now();
        if (ctx.state !== 'running' || remaining < 200) return;
        buildPrinterNoise(ctx, remaining / 1000);
    };

    if (ctx.state === 'running') {
        schedule();
        return true;
    }

    ctx.resume().then(schedule).catch(() => {});
    return ctx.state === 'running';
}

/* ---------- Liga/desliga: o site imprime a partir do clique ---------- */
const PRINT_DELAY_MS = 400; // mesmo atraso da animação do recibo
const PRINT_SOUND_MS = 2800;
let siteIsOn = false;

function bootSite() {
    if (siteIsOn) return;
    siteIsOn = true;

    // O clique é o gesto que libera o áudio no navegador
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});

    document.body.classList.add('is-on');
    stampPrintTime();
    fitHeaderBox();
    startTypewriter();
    setTimeout(() => playPrinterSound(PRINT_SOUND_MS), PRINT_DELAY_MS);

    const bootScreen = document.getElementById('boot-screen');
    if (!bootScreen) return;
    bootScreen.classList.add('is-off');
    bootScreen.addEventListener('transitionend', () => bootScreen.remove(), { once: true });
    setTimeout(() => bootScreen.remove(), 900);
}

document.getElementById('power-button')?.addEventListener('click', bootSite);

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
    bringPaperForward(paper);
    paper.classList.remove('is-peek');
    paper.classList.add('is-open');
    paper.setAttribute('aria-hidden', 'false');
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'true');
    playPrinterSound(2000);
}

function peekPaper(paper) {
    if (!paper) return;
    paper.classList.remove('is-open');
    paper.classList.add('is-peek');
    paper.setAttribute('aria-hidden', 'true');
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'false');
    playPrinterSound(1000);
}

document.querySelectorAll('.paper-scrap[data-paper]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const paper = document.getElementById(btn.dataset.paper);
        if (!paper) return;
        if (paper.classList.contains('is-open')) {
            peekPaper(paper);
        } else {
            openPaper(paper);
        }
    });
});

document.querySelectorAll('.paper-close[data-close]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        peekPaper(document.getElementById(btn.dataset.close));
    });
});

document.querySelectorAll('.print-paper').forEach((paper) => {
    paper.addEventListener('click', () => {
        if (paper.classList.contains('is-peek')) {
            openPaper(paper);
            return;
        }
        if (!paper.classList.contains('is-open')) return;

        const isFront = Number(paper.style.zIndex) === paperLayer;
        if (isFront) {
            peekPaper(paper);
        } else {
            bringPaperForward(paper);
        }
    });
});
