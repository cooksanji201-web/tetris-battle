/**
 * Tetris Battle - Main Application
 */

// App State
const state = {
    game: null,
    mode: 'solo', // 'solo' or 'online'
    isOnline: false,
    isPlaying: false,
    animationId: null
};

// DOM Elements
const elements = {
    // Screens
    modeScreen: document.getElementById('modeScreen'),
    waitingScreen: document.getElementById('waitingScreen'),
    joinScreen: document.getElementById('joinScreen'),
    gameScreen: document.getElementById('gameScreen'),

    // Mode buttons
    soloModeBtn: document.getElementById('soloModeBtn'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),

    // Waiting/Join
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    cancelWaitBtn: document.getElementById('cancelWaitBtn'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    joinError: document.getElementById('joinError'),
    backToModeBtn: document.getElementById('backToModeBtn'),
    confirmJoinBtn: document.getElementById('confirmJoinBtn'),

    // Game
    myBoard: document.getElementById('myBoard'),
    opponentBoard: document.getElementById('opponentBoard'),
    holdCanvas: document.getElementById('holdCanvas'),
    nextCanvas: document.getElementById('nextCanvas'),
    myScore: document.getElementById('myScore'),
    opponentScore: document.getElementById('opponentScore'),
    linesCleared: document.getElementById('linesCleared'),
    currentLevel: document.getElementById('currentLevel'),
    backBtn: document.getElementById('backBtn'),
    onlineBadge: document.getElementById('onlineBadge'),
    roomCodeBadge: document.getElementById('roomCodeBadge'),
    opponentSection: document.getElementById('opponentSection'),
    waitingOverlay: document.getElementById('waitingOverlay'),
    arrowRight: document.getElementById('arrowRight'),
    arrowLeft: document.getElementById('arrowLeft'),

    // Mobile controls
    btnLeft: document.getElementById('btnLeft'),
    btnRight: document.getElementById('btnRight'),
    btnDown: document.getElementById('btnDown'),
    btnRotate: document.getElementById('btnRotate'),
    btnDrop: document.getElementById('btnDrop'),
    btnHold: document.getElementById('btnHold'),

    // Modals
    gameOverModal: document.getElementById('gameOverModal'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    exitGameBtn: document.getElementById('exitGameBtn'),
    playAgainBtn: document.getElementById('playAgainBtn'),

    // Countdown
    countdownOverlay: document.getElementById('countdownOverlay'),
    countdownNumber: document.getElementById('countdownNumber')
};

// Audio
let audioContext = null;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { }
}

function playSound(type) {
    if (!audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    gain.gain.value = 0.1;

    switch (type) {
        case 'move':
            osc.frequency.value = 200;
            osc.start();
            osc.stop(audioContext.currentTime + 0.03);
            break;
        case 'rotate':
            osc.frequency.value = 400;
            osc.start();
            osc.stop(audioContext.currentTime + 0.05);
            break;
        case 'drop':
            osc.frequency.value = 150;
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
            break;
        case 'clear':
            osc.frequency.value = 600;
            osc.type = 'triangle';
            osc.start();
            setTimeout(() => osc.frequency.value = 800, 50);
            osc.stop(audioContext.currentTime + 0.15);
            break;
        case 'tetris':
            osc.frequency.value = 523;
            osc.type = 'square';
            gain.gain.value = 0.08;
            osc.start();
            setTimeout(() => osc.frequency.value = 659, 100);
            setTimeout(() => osc.frequency.value = 784, 200);
            osc.stop(audioContext.currentTime + 0.35);
            break;
    }
}

// Screen Navigation
function showScreen(screenId) {
    [elements.modeScreen, elements.waitingScreen, elements.joinScreen, elements.gameScreen]
        .forEach(s => s && s.classList.add('hidden'));

    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');
}

// Mode handlers
function startSoloMode() {
    state.mode = 'solo';
    state.isOnline = false;

    elements.opponentSection.style.display = 'none';
    elements.onlineBadge.classList.add('hidden');

    showScreen('gameScreen');
    initGame();
    startCountdown();
}

async function createRoom() {
    try {
        await onlineClient.connect();
        const result = await onlineClient.createRoom();

        elements.roomCodeDisplay.textContent = result.code;
        showScreen('waitingScreen');

        onlineClient.onPlayerJoined = () => {
            startOnlineGame();
        };
    } catch (error) {
        alert('Không thể kết nối server. Vui lòng thử lại.');
    }
}

function showJoinScreen() {
    elements.roomCodeInput.value = '';
    elements.joinError.classList.add('hidden');
    showScreen('joinScreen');
}

async function joinRoom() {
    const code = elements.roomCodeInput.value.trim().toUpperCase();

    if (code.length !== 6) {
        elements.joinError.textContent = 'Mã phòng phải có 6 ký tự';
        elements.joinError.classList.remove('hidden');
        return;
    }

    try {
        await onlineClient.connect();
        await onlineClient.joinRoom(code);
        startOnlineGame();
    } catch (error) {
        elements.joinError.textContent = error.message || 'Không thể vào phòng';
        elements.joinError.classList.remove('hidden');
    }
}

function startOnlineGame() {
    state.mode = 'online';
    state.isOnline = true;

    elements.opponentSection.style.display = 'flex';
    elements.onlineBadge.classList.remove('hidden');
    elements.roomCodeBadge.textContent = onlineClient.roomCode;
    elements.waitingOverlay.style.display = 'none';

    showScreen('gameScreen');
    initGame();
    setupOnlineHandlers();
    startCountdown();
}

function setupOnlineHandlers() {
    onlineClient.onOpponentUpdate = (data) => {
        drawOpponentBoard(data.board);
        elements.opponentScore.textContent = data.score;
    };

    onlineClient.onGarbageReceived = (data) => {
        state.game.receiveGarbage(data.lines);
        flashArrow('left');
    };

    onlineClient.onOpponentGameOver = () => {
        handleWin();
    };

    onlineClient.onOpponentLeft = () => {
        if (state.isPlaying) {
            handleWin();
        } else {
            alert('Đối thủ đã rời phòng');
            exitGame();
        }
    };

    onlineClient.onGameReset = () => {
        state.game.reset();
        startCountdown();
    };
}

function flashArrow(direction) {
    const arrow = direction === 'right' ? elements.arrowRight : elements.arrowLeft;
    arrow.classList.add('active');
    setTimeout(() => arrow.classList.remove('active'), 300);
}

// Countdown
function startCountdown() {
    elements.countdownOverlay.classList.remove('hidden');
    let count = 3;
    elements.countdownNumber.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
        } else {
            elements.countdownNumber.textContent = 'GO!';
            setTimeout(() => {
                elements.countdownOverlay.classList.add('hidden');
                state.isPlaying = true;
                startGameLoop();
            }, 500);
            clearInterval(interval);
        }
    }, 1000);
}

// Game initialization
function initGame() {
    state.game = new TetrisGame(elements.myBoard, {
        onScoreUpdate: (score) => {
            elements.myScore.textContent = score;
        },
        onLinesCleared: (lines, combo) => {
            elements.linesCleared.textContent = state.game.lines;
            elements.currentLevel.textContent = state.game.level;

            if (lines === 4) {
                playSound('tetris');
            } else if (lines > 0) {
                playSound('clear');
            }
        },
        onGameOver: () => {
            handleGameOver();
        },
        onAttack: (lines) => {
            if (state.isOnline) {
                onlineClient.sendAttack(lines);
                flashArrow('right');
            }
        },
        onBoardUpdate: (boardState) => {
            if (state.isOnline) {
                onlineClient.sendBoardUpdate(boardState);
            }
        }
    });

    // Clear opponent board
    const oppCtx = elements.opponentBoard.getContext('2d');
    oppCtx.fillStyle = '#0a0a1a';
    oppCtx.fillRect(0, 0, elements.opponentBoard.width, elements.opponentBoard.height);
}

// Game loop
let lastSyncTime = 0;
const SYNC_INTERVAL = 100; // Sync every 100ms for smooth updates

function startGameLoop() {
    function gameLoop(timestamp) {
        if (!state.isPlaying) return;

        state.game.update(timestamp);
        state.game.draw();
        state.game.drawPiecePreview(elements.holdCanvas, state.game.holdPiece);
        state.game.drawNextPieces(elements.nextCanvas);

        // Real-time sync for online mode (throttled)
        if (state.isOnline && timestamp - lastSyncTime > SYNC_INTERVAL) {
            onlineClient.sendBoardUpdate(state.game.getBoardState());
            lastSyncTime = timestamp;
        }

        state.animationId = requestAnimationFrame(gameLoop);
    }

    state.animationId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
    state.isPlaying = false;
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }
}

// Draw opponent board
function drawOpponentBoard(board) {
    const canvas = elements.opponentBoard;
    const ctx = canvas.getContext('2d');

    // Calculate cell size based on canvas dimensions
    const cellWidth = canvas.width / 10;  // 10 columns
    const cellHeight = canvas.height / 20; // 20 rows
    const cellSize = Math.min(cellWidth, cellHeight);

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 10; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, 20 * cellSize);
        ctx.stroke();
    }
    for (let y = 0; y <= 20; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(10 * cellSize, y * cellSize);
        ctx.stroke();
    }

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col]) {
                // Main cell
                ctx.fillStyle = board[row][col];
                ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2);

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, 2);
            }
        }
    }
}

// Game end handlers
function handleGameOver() {
    stopGameLoop();

    if (state.isOnline) {
        onlineClient.sendGameOver();
        elements.modalIcon.textContent = '😢';
        elements.modalTitle.textContent = 'Thua cuộc!';
        elements.modalMessage.textContent = `Điểm: ${state.game.score}`;
    } else {
        elements.modalIcon.textContent = '🎮';
        elements.modalTitle.textContent = 'Game Over!';
        elements.modalMessage.textContent = `Điểm: ${state.game.score} | Lines: ${state.game.lines}`;
    }

    elements.gameOverModal.classList.add('active');
}

function handleWin() {
    stopGameLoop();

    elements.modalIcon.textContent = '🎉';
    elements.modalTitle.textContent = 'Chiến thắng!';
    elements.modalMessage.textContent = `Điểm: ${state.game.score}`;

    elements.gameOverModal.classList.add('active');
}

function exitGame() {
    stopGameLoop();
    elements.gameOverModal.classList.remove('active');

    if (state.isOnline) {
        onlineClient.leave();
        state.isOnline = false;
    }

    showScreen('modeScreen');
}

function playAgain() {
    elements.gameOverModal.classList.remove('active');

    if (state.isOnline) {
        onlineClient.requestNewGame();
    } else {
        state.game.reset();
        startCountdown();
    }
}

// Keyboard controls
function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (!state.isPlaying || !state.game) return;

        if (!audioContext) initAudio();

        switch (e.code) {
            case 'ArrowLeft':
                e.preventDefault();
                if (state.game.move(-1)) playSound('move');
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (state.game.move(1)) playSound('move');
                break;
            case 'ArrowDown':
                e.preventDefault();
                state.game.softDrop();
                break;
            case 'ArrowUp':
            case 'KeyX':
                e.preventDefault();
                if (state.game.rotate(1)) playSound('rotate');
                break;
            case 'KeyZ':
                e.preventDefault();
                if (state.game.rotate(-1)) playSound('rotate');
                break;
            case 'Space':
                e.preventDefault();
                state.game.hardDrop();
                playSound('drop');
                break;
            case 'KeyC':
            case 'ShiftLeft':
                e.preventDefault();
                state.game.hold();
                break;
        }
    });
}

// Mobile controls
function setupMobileControls() {
    const handleTouch = (btn, action) => {
        btn?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!audioContext) initAudio();
            action();
        });
        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!audioContext) initAudio();
            action();
        });
    };

    handleTouch(elements.btnLeft, () => {
        if (state.game?.move(-1)) playSound('move');
    });

    handleTouch(elements.btnRight, () => {
        if (state.game?.move(1)) playSound('move');
    });

    handleTouch(elements.btnDown, () => {
        state.game?.softDrop();
    });

    handleTouch(elements.btnRotate, () => {
        if (state.game?.rotate(1)) playSound('rotate');
    });

    handleTouch(elements.btnDrop, () => {
        state.game?.hardDrop();
        playSound('drop');
    });

    handleTouch(elements.btnHold, () => {
        state.game?.hold();
    });
}

// Event Listeners
function setupEventListeners() {
    // Mode selection
    elements.soloModeBtn?.addEventListener('click', startSoloMode);
    elements.createRoomBtn?.addEventListener('click', createRoom);
    elements.joinRoomBtn?.addEventListener('click', showJoinScreen);

    // Waiting/Join
    elements.copyCodeBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(onlineClient.roomCode);
        elements.copyCodeBtn.textContent = '✓';
        setTimeout(() => elements.copyCodeBtn.textContent = '📋', 2000);
    });
    elements.cancelWaitBtn?.addEventListener('click', () => {
        onlineClient.leave();
        showScreen('modeScreen');
    });
    elements.backToModeBtn?.addEventListener('click', () => showScreen('modeScreen'));
    elements.confirmJoinBtn?.addEventListener('click', joinRoom);
    elements.roomCodeInput?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') joinRoom();
    });

    // Game
    elements.backBtn?.addEventListener('click', exitGame);
    elements.exitGameBtn?.addEventListener('click', exitGame);
    elements.playAgainBtn?.addEventListener('click', playAgain);
}

// Initialize
function init() {
    setupEventListeners();
    setupKeyboardControls();
    setupMobileControls();
    showScreen('modeScreen');
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
