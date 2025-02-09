let startTime;
let timerInterval;
let isRunning = false;
let attempts = [];

// Get the audio element
const countdownAudio = document.getElementById('countdown');
let isFirstStart = false;

// Set up the audio end handler once
countdownAudio.addEventListener('ended', () => {
    startTimer();
    // Just reset the position
    countdownAudio.currentTime = 0;
    countdownAudio.pause(); // Ensure audio is fully stopped
});

// Add at the top with other variables
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4GAkct4RODUcammqmTvRcGMglzS8QxZjkA4kZg3gdzgGjYKA8EYU27X7rgZe5kqvH/exec'; // Put your web app URL here

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function updateDisplay() {
    if (!startTime) return;
    const currentTime = Date.now() - startTime;
    document.getElementById('stopwatch').textContent = formatTime(currentTime);
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateDisplay, 10);
    isRunning = true;
    document.getElementById('status').textContent = 'Running';
}

function stopTimer() {
    if (!isRunning) return;

    clearInterval(timerInterval);
    const finalTime = Date.now() - startTime;
    isRunning = false;

    // Add to attempts
    attempts.unshift({
        time: finalTime,
        timestamp: new Date()
    });

    // Update attempts display
    updateAttemptsList();

    // Send to Google Sheet
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            time: finalTime,
            formattedTime: formatTime(finalTime)
        })
    }).catch(error => console.error('Error saving to sheet:', error));

    // Reset display and audio position
    document.getElementById('status').textContent = 'Ready';
    startTime = null;
    countdownAudio.currentTime = 0;
}

function updateAttemptsList() {
    const attemptsList = document.getElementById('attempts');
    attemptsList.innerHTML = attempts
        .map((attempt, index) => `
            <li>
                ${formatTime(attempt.time)}
                <small>(${attempt.timestamp.toLocaleTimeString()})</small>
            </li>
        `)
        .join('');
}

function startCountdown() {
    if (isRunning) return;

    // Always require first interaction on mobile
    if (isFirstStart || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        document.getElementById('status').textContent = 'Klikni tukaj za začetek';

        const startOnClick = () => {
            document.removeEventListener('click', startOnClick);
            isFirstStart = false;
            // Try to unlock audio on mobile
            countdownAudio.play().then(() => {
                countdownAudio.pause();
                countdownAudio.currentTime = 0;
                playCountdownAndStart();
            }).catch(() => {
                // If play fails, try anyway
                playCountdownAndStart();
            });
        };

        document.addEventListener('click', startOnClick);
        return;
    }

    // For desktop, try playing directly
    playCountdownAndStart();
}

function playCountdownAndStart() {
    document.getElementById('status').textContent = 'Pripravi se...';
    countdownAudio.currentTime = 0;

    const playPromise = countdownAudio.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('Playback failed:', error);
            // Show clearer message on mobile
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            document.getElementById('status').textContent = isMobile ?
                'Klikni tukaj za začetek' :
                'Klikni kjerkoli na strani za začetek/konec ali uporabi tipko presledek';
            isFirstStart = true; // Reset to try again
        });
    }
}

// Update keyboard and mouse controls
document.addEventListener('click', (event) => {
    if (isRunning) {
        stopTimer();
    } else {
        startCountdown();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault(); // Prevent page scroll
        if (isRunning) {
            stopTimer();
        } else {
            startCountdown();
        }
    }
});

// Initialize
document.getElementById('stopwatch').textContent = '00:00.000'; 