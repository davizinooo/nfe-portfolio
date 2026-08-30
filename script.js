function updateClock() {
    const clockElement = document.getElementById('clock');
    if (!clockElement) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
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

updateClock();
setInterval(updateClock, 1000);

const headerFrame = document.querySelector('.header-frame');
if (headerFrame && 'ResizeObserver' in window) {
    new ResizeObserver(fitHeaderBox).observe(headerFrame);
}

window.addEventListener('resize', fitHeaderBox);
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
            await typeWord(words[i]);
            await wait(pauseMs);
            await deleteWord();
            await wait(250);
        }
        loop();
    }

    loop();
}

startTypewriter();
