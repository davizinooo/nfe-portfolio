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

/* ---------- Som de impressora (efeito de recibo gravado) ---------- */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PRINTER_SOUND_SRC = 'sounds/printer.mp3';
let printerAudio = null;
let printerStopTimer = null;

function getPrinterAudio() {
    if (printerAudio) return printerAudio;
    printerAudio = new Audio(PRINTER_SOUND_SRC);
    printerAudio.preload = 'auto';
    printerAudio.volume = 0.85;
    return printerAudio;
}

function unlockPrinterAudio() {
    const audio = getPrinterAudio();
    audio.muted = true;
    const play = audio.play();
    if (play) {
        play
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
            })
            .catch(() => {
                audio.muted = false;
            });
    }
}

function playPrinterSound(ms) {
    if (REDUCE_MOTION || ms < 200) return false;
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
}

/* ---------- Liga/desliga: o site imprime a partir do clique ---------- */
const PRINT_DELAY_MS = 400; // mesmo atraso da animação do recibo
const PRINT_SOUND_MS = 3600;
let siteIsOn = false;

function bootSite() {
    if (siteIsOn) return;
    siteIsOn = true;

    // O clique é o gesto que libera o áudio no navegador
    unlockPrinterAudio();

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
    paper.classList.add('is-open');
    paper.setAttribute('aria-hidden', 'false');
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'true');
    playPrinterSound(2000);
}

function closePaper(paper) {
    if (!paper) return;
    paper.classList.remove('is-open');
    paper.setAttribute('aria-hidden', 'true');
    paperTrigger(paper.id)?.setAttribute('aria-expanded', 'false');
    playPrinterSound(1000);
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
