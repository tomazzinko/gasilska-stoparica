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

// Add at the top with other variables
const State = {
    READY: 'ready',           // Initial state, can start countdown
    WAITING: 'waiting',       // Waiting for delay before audio
    COUNTDOWN: 'countdown',   // Playing "enota pripravi se"
    RUNNING: 'running',       // Stopwatch is running
    FINISHED: 'finished'      // Run completed, 10s countdown active
};

let currentState = State.READY;

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
    currentState = State.RUNNING;
    startTime = Date.now();
    timerInterval = setInterval(updateDisplay, 10);
    document.getElementById('status').textContent = 'Running';
    document.getElementById('stopwatch').style.color = '#4CAF50';
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
    // Only allow stopping from RUNNING state
    if (currentState !== State.RUNNING) return;

    clearInterval(timerInterval);
    // Get final time before any other operations
    const endTime = Date.now();
    const finalTime = endTime - startTime;

    // Update display one last time with precise final time
    document.getElementById('stopwatch').textContent = formatTime(finalTime);

    currentState = State.FINISHED;
    document.getElementById('stopwatch').style.color = '#000000';
    document.getElementById('status').textContent = 'Gremo v postroj!';

    // Add to attempts with the precise time
    attempts.unshift({
        time: finalTime,
        timestamp: new Date(endTime)
    });

    // Update attempts display
    updateAttemptsList();

    // Send to Google Sheet with the precise time
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
    startTime = null;
    countdownAudio.currentTime = 0;

    // Start the 10 second countdown
    if (roundEndTimer) {
        clearInterval(roundEndTimer);
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '10.00';
    roundEndTimer = setInterval(() => {
        updateRoundEndTimer();
        if (roundEndTimeLeft <= 0) {
            currentState = State.READY;
            document.getElementById('status').textContent = '-';
        }
    }, 10);
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
    // Only allow starting from READY state
    if (currentState !== State.READY) {
        console.log('Ignoring start attempt in state:', currentState);
        return;
    }

    // Reset stopwatch display immediately
    document.getElementById('stopwatch').textContent = '00:00.000';

    // Reset round end timer if it's running
    if (roundEndTimer) {
        clearInterval(roundEndTimer);
        roundEndTimer = null;
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '10.00';
    document.getElementById('stopwatch').style.color = '#000000';

    // Mobile first interaction handling
    if (isFirstStart || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        document.getElementById('status').textContent = 'Klikni tukaj za začetek';

        const startOnClick = () => {
            document.removeEventListener('click', startOnClick);
            isFirstStart = false;
            countdownAudio.play().then(() => {
                countdownAudio.pause();
                countdownAudio.currentTime = 0;
                startWaitingPhase();
            }).catch(() => {
                startWaitingPhase();
            });
        };

        document.addEventListener('click', startOnClick);
        return;
    }

    startWaitingPhase();
}

function startWaitingPhase() {
    currentState = State.WAITING;
    document.getElementById('status').textContent = 'Zamik...';
    document.getElementById('stopwatch').style.color = '#FFA500';

    setTimeout(() => {
        if (currentState === State.WAITING) { // Verify state hasn't changed
            startAudioCountdown();
        }
    }, startDelay * 1000);
}

function startAudioCountdown() {
    currentState = State.COUNTDOWN;
    document.getElementById('status').textContent = 'Pripravi se...';
    countdownAudio.currentTime = 0;

    const playPromise = countdownAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('Playback failed:', error);
            currentState = State.READY; // Reset state on error
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            document.getElementById('status').textContent = isMobile ?
                'Klikni tukaj za začetek' :
                'Klikni kjerkoli na strani za začetek/konec ali uporabi tipko presledek';
            isFirstStart = true;
        });
    }
}

// Update click handler to be more explicit about states
document.addEventListener('click', (event) => {
    if (event.target.closest('button') || event.target.closest('a')) {
        return;
    }

    switch (currentState) {
        case State.RUNNING:
            stopTimer();
            break;
        case State.READY:
            startCountdown();
            break;
        case State.FINISHED:
            console.log('Waiting for siren to finish...');
            break;
        default:
            console.log('Action not allowed in current state:', currentState);
    }
});

// Update keydown handler to match
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        switch (currentState) {
            case State.RUNNING:
                stopTimer();
                break;
            case State.READY:
                startCountdown();
                break;
            case State.FINISHED:
                console.log('Waiting for siren to finish...');
                break;
        }
    }
});

// Initialize
currentState = State.READY;
document.getElementById('stopwatch').textContent = '00:00.000'; 