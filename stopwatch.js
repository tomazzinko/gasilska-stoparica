let startTime;
let timerInterval;
let isRunning = false;
let attempts = [];

const countdownAudio = document.getElementById('countdown');
const hornAudio = document.getElementById('horn');

countdownAudio.addEventListener('ended', () => {
    startTimer();
    countdownAudio.currentTime = 0;
    countdownAudio.pause();
});

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby57PSmffSP6dl2VaKjXUV7VQ5XZ3Y8becfaM2uql5KATUhqvISci2ps9i38UZ28fVe/exec'

let roundEndTimer = null;
let roundEndTimeLeft = 10;
let startDelay = 10;
let isCountingDown = false;

const State = {
    READY: 'ready',
    WAITING: 'waiting',
    COUNTDOWN: 'countdown',
    RUNNING: 'running',
    FINISHED: 'finished'
};

let currentState = State.READY;

const sessionId = new Date().toISOString().split('T')[0] + '_' + Math.random().toString(36).substring(2, 8);
const sessionStartTime = new Date().toISOString();

const DELETE_TIME_WINDOW = 5 * 60 * 1000;

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
    document.getElementById('startStopButton').textContent = 'Konec';
    document.getElementById('startStopButton').classList.remove('delay');
    document.getElementById('startStopButton').classList.add('stop');
    document.getElementById('startStopButton').disabled = false;
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
    if (currentState !== State.RUNNING) return;

    clearInterval(timerInterval);
    const endTime = Date.now();
    const finalTime = endTime - startTime;

    document.getElementById('stopwatch').textContent = formatTime(finalTime);

    currentState = State.FINISHED;
    document.getElementById('stopwatch').style.color = '#000000';
    document.getElementById('startStopButton').textContent = 'Postroj!';
    document.getElementById('startStopButton').classList.remove('stop');
    document.getElementById('startStopButton').classList.add('start');
    document.getElementById('startStopButton').disabled = true;

    attempts.unshift({
        time: finalTime,
        timestamp: new Date(endTime)
    });

    updateAttemptsList();

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            time: finalTime,
            formattedTime: formatTime(finalTime),
            sessionId: sessionId,
            sessionStart: sessionStartTime,
            attemptNumber: attempts.length
        })
    }).catch(error => console.error('Error saving to sheet:', error));

    startTime = null;
    countdownAudio.currentTime = 0;

    if (roundEndTimer) {
        clearInterval(roundEndTimer);
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '10.00';
    roundEndTimer = setInterval(() => {
        updateRoundEndTimer();
        if (roundEndTimeLeft <= 0) {
            currentState = State.READY;
            document.getElementById('startStopButton').textContent = 'Začni';
            document.getElementById('startStopButton').classList.add('start');
            document.getElementById('startStopButton').disabled = false;
            hornAudio.play().catch(error => console.error('Horn playback failed:', error));
        }
    }, 10);
}

function updateAttemptsList() {
    const attemptsList = document.getElementById('attempts');
    const now = Date.now();

    attemptsList.innerHTML = attempts
        .map((attempt, index) => {
            const timeSinceAttempt = now - attempt.timestamp.getTime();

            return `
                <li>
                    ${formatTime(attempt.time)}
                    <small>(${attempt.timestamp.toLocaleTimeString()})</small>
                    <button onclick="confirmRemoveAttempt(${index})" 
                        style="margin-left: 10px; padding: 2px 8px; cursor: pointer; 
                        background: none; color: red; border: none; font-size: 16px;">
                        &#10006;
                    </button>
                </li>
            `;
        })
        .join('');
}

function confirmRemoveAttempt(index) {
    const attempt = attempts[index];
    const timeSinceAttempt = Date.now() - attempt.timestamp.getTime();

    if (timeSinceAttempt > DELETE_TIME_WINDOW) {
        alert('Poskusa ni več mogoče izbrisati (časovna omejitev 5 minut).');
        return;
    }

    if (confirm(`Ali res želite izbrisati poskus ${formatTime(attempt.time)}?`)) {
        attempts.splice(index, 1);
        updateAttemptsList();
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete',
                sessionId: sessionId,
                timestamp: attempt.timestamp.toISOString(),
                time: attempt.time
            })
        }).catch(error => console.error('Error deleting from sheet:', error));
    }
}

function adjustDelay(change) {
    startDelay = Math.max(0, Math.max(0, startDelay + change));
    document.getElementById('delayDisplay').textContent = startDelay;
}

function startCountdown() {
    if (currentState !== State.READY) {
        console.log('Ignoring start attempt in state:', currentState);
        return;
    }

    document.getElementById('stopwatch').textContent = '00:00.000';

    if (roundEndTimer) {
        clearInterval(roundEndTimer);
        roundEndTimer = null;
    }
    roundEndTimeLeft = 10.0;
    document.getElementById('round-end-countdown').textContent = '-';
    document.getElementById('stopwatch').style.color = '#000000';

    startWaitingPhase();
}

function startWaitingPhase() {
    currentState = State.WAITING;
    document.getElementById('startStopButton').textContent = 'Zamik...';
    document.getElementById('startStopButton').classList.remove('start');
    document.getElementById('startStopButton').classList.add('delay');
    document.getElementById('startStopButton').disabled = true;
    document.getElementById('stopwatch').style.color = '#FFA500';

    setTimeout(() => {
        if (currentState === State.WAITING) {
            startAudioCountdown();
        }
    }, startDelay * 1000);
}

function startAudioCountdown() {
    currentState = State.COUNTDOWN;
    document.getElementById('startStopButton').textContent = 'Pripravi se...';
    document.getElementById('startStopButton').classList.remove('delay');
    document.getElementById('startStopButton').classList.add('stop');
    countdownAudio.currentTime = 0;

    const playPromise = countdownAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('Playback failed:', error);
            currentState = State.READY;
        });
    }
}

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

document.getElementById('startStopButton').addEventListener('click', () => {
    const unlockAudioContext = () => {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YQAAAAA=');
        silentAudio.play().then(() => {
            console.log('Audio context unlocked');
        }).catch(error => {
            console.error('Silent audio playback failed:', error);
        });
        document.removeEventListener('click', unlockAudioContext);
    };
    document.addEventListener('click', unlockAudioContext);

    if (currentState === State.RUNNING) {
        stopTimer();
        document.getElementById('startStopButton').textContent = 'Začni';
    } else if (currentState === State.READY) {
        startCountdown();
        document.getElementById('startStopButton').textContent = 'Konec';
    }
});

currentState = State.READY;
document.getElementById('stopwatch').textContent = '00:00.000';
document.getElementById('startStopButton').textContent = 'Začni';
document.getElementById('startStopButton').classList.add('start');