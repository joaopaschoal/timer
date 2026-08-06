// Offscreen document: listens for play commands and uses WebAudio to play a beep

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === 'playSound') {
        playBeep();
        sendResponse({ok:true});
    }
});

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => {
            o.stop();
            try { ctx.close(); } catch(e) {}
            // close offscreen document when done
            try { if (chrome.offscreen && chrome.offscreen.closeDocument) chrome.offscreen.closeDocument(); } catch(e) {}
        }, 1200);
    } catch(e) {
        console.error('Play beep failed', e);
    }
}
