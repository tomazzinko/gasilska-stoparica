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

// Add these variables at the top with other declarations
let roundEndTimer = null;
let roundEndTimeLeft = 10;
const hornAudio = document.getElementById('horn');
let startDelay = 10; // Default 3 second delay
let isCountingDown = false;

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
    isCountingDown = false; // Reset countdown flag when timer starts
    document.getElementById('status').textContent = 'Running';
    document.getElementById('stopwatch').style.color = '#4CAF50'; // Green when running
}

function updateRoundEndTimer() {
    roundEndTimeLeft = Math.max(0, roundEndTimeLeft - 0.01);
    const seconds = Math.floor(roundEndTimeLeft);
    const centiseconds = Math.floor((roundEndTimeLeft * 100) % 100);
    document.getElementById('round-end-countdown').textContent =
        `${seconds}.${String(centiseconds).padStart(2, '0')}`;

    if (roundEndTimeLeft <= 0) {
        clearInterval(roundEndTimer);
        hornAudio.play().catch(error => console.error('Horn playback failed:', error));
    }
}

function stopTimer() {
    if (!isRunning) return;

    clearInterval(timerInterval);
    const finalTime = Date.now() - startTime;
    isRunning = false;

    // Reset display color to black
    document.getElementById('stopwatch').style.color = '#000000';

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

    // Start the 10 second countdown
    if (roundEndTimer) {
        clearInterval(roundEndTimer);
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '10.00';
    roundEndTimer = setInterval(updateRoundEndTimer, 10); // Update every 10ms for smoother countdown
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

function adjustDelay(change) {
    startDelay = Math.max(0, Math.max(0, startDelay + change));
    document.getElementById('delayDisplay').textContent = startDelay;
}

function startCountdown() {
    if (isRunning || isCountingDown) return; // Don't start if already running or counting down

    // Reset round end timer if it's running
    if (roundEndTimer) {
        clearInterval(roundEndTimer);
        roundEndTimer = null;
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '10.00';

    // Reset stopwatch color to black when starting new run
    document.getElementById('stopwatch').style.color = '#000000';

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
    isCountingDown = true;
    document.getElementById('status').textContent = 'Čakam...';
    document.getElementById('stopwatch').style.color = '#FFA500'; // Yellow during waiting period

    // First wait for the configured delay
    setTimeout(() => {
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
                isCountingDown = false; // Reset countdown flag on error
            });
        }
    }, startDelay * 1000);
}

// Replace the click event listener with this updated version
document.addEventListener('click', (event) => {
    // Ignore clicks on buttons, links, and their children
    if (event.target.closest('button') || event.target.closest('a')) {
        return;
    }

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