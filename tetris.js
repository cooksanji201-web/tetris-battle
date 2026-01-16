/**
 * Tetris Game Engine
 * Core game logic for Tetris Battle
 */

// Tetromino shapes and rotations
const TETROMINOES = {
    I: {
        shape: [
            [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
            [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
            [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
            [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]
        ],
        color: '#00ffff'
    },
    O: {
        shape: [
            [[1, 1], [1, 1]],
            [[1, 1], [1, 1]],
            [[1, 1], [1, 1]],
            [[1, 1], [1, 1]]
        ],
        color: '#ffff00'
    },
    T: {
        shape: [
            [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
            [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
            [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
            [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
        ],
        color: '#aa00ff'
    },
    S: {
        shape: [
            [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
            [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
            [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
            [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
        ],
        color: '#00ff00'
    },
    Z: {
        shape: [
            [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
            [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
            [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
            [[0, 1, 0], [1, 1, 0], [1, 0, 0]]
        ],
        color: '#ff0000'
    },
    J: {
        shape: [
            [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
            [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
            [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
            [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
        ],
        color: '#0066ff'
    },
    L: {
        shape: [
            [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
            [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
            [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
            [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
        ],
        color: '#ff8800'
    }
};

const PIECE_TYPES = Object.keys(TETROMINOES);
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 20;

class TetrisGame {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;

        // Game state
        this.board = this.createBoard();
        this.currentPiece = null;
        this.currentX = 0;
        this.currentY = 0;
        this.currentRotation = 0;
        this.holdPiece = null;
        this.canHold = true;
        this.nextPieces = [];
        this.bag = [];

        // Stats
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;

        // Game control
        this.gameOver = false;
        this.isPaused = false;
        this.dropInterval = 1000;
        this.lastDrop = 0;
        this.lockDelay = 500;
        this.lockTimer = null;

        // Pending garbage
        this.pendingGarbage = 0;

        // Callbacks
        this.onScoreUpdate = options.onScoreUpdate || (() => { });
        this.onLinesCleared = options.onLinesCleared || (() => { });
        this.onGameOver = options.onGameOver || (() => { });
        this.onAttack = options.onAttack || (() => { });
        this.onBoardUpdate = options.onBoardUpdate || (() => { });

        // Fill next pieces
        this.fillBag();
        for (let i = 0; i < 3; i++) {
            this.nextPieces.push(this.getNextFromBag());
        }
    }

    createBoard() {
        return Array(BOARD_HEIGHT).fill(null).map(() =>
            Array(BOARD_WIDTH).fill(null)
        );
    }

    fillBag() {
        // 7-bag randomizer
        this.bag = [...PIECE_TYPES];
        for (let i = this.bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
    }

    getNextFromBag() {
        if (this.bag.length === 0) {
            this.fillBag();
        }
        return this.bag.pop();
    }

    spawnPiece() {
        // Add pending garbage before spawning
        if (this.pendingGarbage > 0) {
            this.addGarbageLines(this.pendingGarbage);
            this.pendingGarbage = 0;
        }

        const type = this.nextPieces.shift();
        this.nextPieces.push(this.getNextFromBag());

        this.currentPiece = type;
        this.currentRotation = 0;
        this.currentX = Math.floor((BOARD_WIDTH - this.getShape().length) / 2);
        this.currentY = 0;
        this.canHold = true;

        // Check if can spawn (game over check)
        if (this.checkCollision(this.currentX, this.currentY, this.currentRotation)) {
            this.gameOver = true;
            this.onGameOver();
            return false;
        }

        return true;
    }

    getShape(piece = this.currentPiece, rotation = this.currentRotation) {
        return TETROMINOES[piece].shape[rotation];
    }

    getColor(piece = this.currentPiece) {
        return TETROMINOES[piece].color;
    }

    checkCollision(x, y, rotation, piece = this.currentPiece) {
        const shape = TETROMINOES[piece].shape[rotation];

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const newX = x + col;
                    const newY = y + row;

                    // Check boundaries
                    if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
                        return true;
                    }

                    // Check board collision (ignore if above board)
                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    move(dx) {
        const newX = this.currentX + dx;
        if (!this.checkCollision(newX, this.currentY, this.currentRotation)) {
            this.currentX = newX;
            this.resetLockTimer();
            return true;
        }
        return false;
    }

    rotate(direction = 1) {
        const newRotation = (this.currentRotation + direction + 4) % 4;

        // Try basic rotation
        if (!this.checkCollision(this.currentX, this.currentY, newRotation)) {
            this.currentRotation = newRotation;
            this.resetLockTimer();
            return true;
        }

        // Wall kicks
        const kicks = [-1, 1, -2, 2];
        for (const kick of kicks) {
            if (!this.checkCollision(this.currentX + kick, this.currentY, newRotation)) {
                this.currentX += kick;
                this.currentRotation = newRotation;
                this.resetLockTimer();
                return true;
            }
        }

        return false;
    }

    softDrop() {
        if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentRotation)) {
            this.currentY++;
            this.score += 1;
            this.onScoreUpdate(this.score);
            return true;
        }
        return false;
    }

    hardDrop() {
        let dropDistance = 0;
        while (!this.checkCollision(this.currentX, this.currentY + 1, this.currentRotation)) {
            this.currentY++;
            dropDistance++;
        }
        this.score += dropDistance * 2;
        this.onScoreUpdate(this.score);
        this.lockPiece();
    }

    getGhostY() {
        let ghostY = this.currentY;
        while (!this.checkCollision(this.currentX, ghostY + 1, this.currentRotation)) {
            ghostY++;
        }
        return ghostY;
    }

    hold() {
        if (!this.canHold) return false;

        const current = this.currentPiece;

        if (this.holdPiece) {
            this.currentPiece = this.holdPiece;
            this.currentRotation = 0;
            this.currentX = Math.floor((BOARD_WIDTH - this.getShape().length) / 2);
            this.currentY = 0;
        } else {
            this.spawnPiece();
        }

        this.holdPiece = current;
        this.canHold = false;
        return true;
    }

    resetLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
    }

    lockPiece() {
        const shape = this.getShape();
        const color = this.getColor();

        // Place piece on board
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = this.currentY + row;
                    const boardX = this.currentX + col;

                    if (boardY >= 0 && boardY < BOARD_HEIGHT) {
                        this.board[boardY][boardX] = color;
                    }
                }
            }
        }

        // Clear lines
        const linesCleared = this.clearLines();

        // Update stats
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.combo++;

            // Scoring
            const linePoints = [0, 100, 300, 500, 800];
            this.score += linePoints[linesCleared] * this.level;
            this.score += 50 * this.combo * this.level; // Combo bonus

            this.onScoreUpdate(this.score);
            this.onLinesCleared(linesCleared, this.combo);

            // Update level
            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 50);
            }

            // Calculate attack (garbage lines to send)
            const attackLines = this.calculateAttack(linesCleared, this.combo);
            if (attackLines > 0) {
                this.onAttack(attackLines);
            }
        } else {
            this.combo = 0;
        }

        this.onBoardUpdate(this.getBoardState());

        // Spawn next piece
        this.spawnPiece();
    }

    calculateAttack(lines, combo) {
        // Lines: 1 = 0, 2 = 1, 3 = 2, 4 (Tetris) = 4
        const baseAttack = [0, 0, 1, 2, 4][lines] || 0;
        const comboBonus = Math.max(0, combo - 1);
        return baseAttack + comboBonus;
    }

    clearLines() {
        let linesCleared = 0;

        for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== null)) {
                // Remove the line
                this.board.splice(row, 1);
                // Add empty line at top
                this.board.unshift(Array(BOARD_WIDTH).fill(null));
                linesCleared++;
                row++; // Check same row again
            }
        }

        return linesCleared;
    }

    addGarbageLines(count) {
        // Add garbage lines at bottom
        for (let i = 0; i < count; i++) {
            // Remove top row
            this.board.shift();

            // Create garbage line with one random gap
            const garbageLine = Array(BOARD_WIDTH).fill('#666666');
            const gapPosition = Math.floor(Math.random() * BOARD_WIDTH);
            garbageLine[gapPosition] = null;

            // Add to bottom
            this.board.push(garbageLine);
        }
    }

    receiveGarbage(count) {
        this.pendingGarbage += count;
    }

    getBoardState() {
        // Return a copy of the board WITH the current piece for syncing
        const boardCopy = this.board.map(row => [...row]);

        // Add current piece to the board copy
        if (this.currentPiece) {
            const shape = this.getShape();
            const color = this.getColor();
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const boardY = this.currentY + row;
                        const boardX = this.currentX + col;
                        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                            boardCopy[boardY][boardX] = color;
                        }
                    }
                }
            }
        }

        return {
            board: boardCopy,
            score: this.score,
            lines: this.lines,
            level: this.level
        };
    }

    update(timestamp) {
        if (this.gameOver || this.isPaused) return;

        if (!this.currentPiece) {
            this.spawnPiece();
            this.lastDrop = timestamp;
            return;
        }

        // Auto drop
        if (timestamp - this.lastDrop > this.dropInterval) {
            if (!this.softDrop()) {
                // Piece landed
                if (!this.lockTimer) {
                    this.lockTimer = setTimeout(() => {
                        if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentRotation)) {
                            // Piece can still move, don't lock
                            this.lockTimer = null;
                        } else {
                            this.lockPiece();
                            this.lockTimer = null;
                        }
                    }, this.lockDelay);
                }
            }
            this.lastDrop = timestamp;
        }
    }

    draw() {
        const ctx = this.ctx;
        const size = CELL_SIZE;

        // Clear canvas
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= BOARD_WIDTH; x++) {
            ctx.beginPath();
            ctx.moveTo(x * size, 0);
            ctx.lineTo(x * size, BOARD_HEIGHT * size);
            ctx.stroke();
        }
        for (let y = 0; y <= BOARD_HEIGHT; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * size);
            ctx.lineTo(BOARD_WIDTH * size, y * size);
            ctx.stroke();
        }

        // Draw board
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                if (this.board[row][col]) {
                    this.drawCell(col, row, this.board[row][col]);
                }
            }
        }

        // Draw ghost piece
        if (this.currentPiece) {
            const ghostY = this.getGhostY();
            const shape = this.getShape();
            ctx.globalAlpha = 0.3;
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        this.drawCell(this.currentX + col, ghostY + row, this.getColor());
                    }
                }
            }
            ctx.globalAlpha = 1;

            // Draw current piece
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const y = this.currentY + row;
                        if (y >= 0) {
                            this.drawCell(this.currentX + col, y, this.getColor());
                        }
                    }
                }
            }
        }

        // Draw pending garbage indicator
        if (this.pendingGarbage > 0) {
            ctx.fillStyle = '#ff4444';
            const barHeight = Math.min(this.pendingGarbage * size, BOARD_HEIGHT * size);
            ctx.fillRect(
                BOARD_WIDTH * size + 2,
                BOARD_HEIGHT * size - barHeight,
                4,
                barHeight
            );
        }
    }

    drawCell(x, y, color) {
        const ctx = this.ctx;
        const size = CELL_SIZE;

        // Main color
        ctx.fillStyle = color;
        ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x * size + 1, y * size + 1, size - 2, 2);
        ctx.fillRect(x * size + 1, y * size + 1, 2, size - 2);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x * size + 1, y * size + size - 3, size - 2, 2);
        ctx.fillRect(x * size + size - 3, y * size + 1, 2, size - 2);
    }

    drawPiecePreview(canvas, piece) {
        if (!piece) return;

        const ctx = canvas.getContext('2d');
        const shape = TETROMINOES[piece].shape[0];
        const color = TETROMINOES[piece].color;
        const previewSize = 16;

        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const offsetX = (canvas.width - shape[0].length * previewSize) / 2;
        const offsetY = (canvas.height - shape.length * previewSize) / 2;

        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        offsetX + col * previewSize + 1,
                        offsetY + row * previewSize + 1,
                        previewSize - 2,
                        previewSize - 2
                    );
                }
            }
        }
    }

    drawNextPieces(canvas) {
        const ctx = canvas.getContext('2d');
        const previewSize = 14;

        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < Math.min(3, this.nextPieces.length); i++) {
            const piece = this.nextPieces[i];
            const shape = TETROMINOES[piece].shape[0];
            const color = TETROMINOES[piece].color;

            const offsetX = (canvas.width - shape[0].length * previewSize) / 2;
            const offsetY = i * 50 + 10;

            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        ctx.fillStyle = color;
                        ctx.fillRect(
                            offsetX + col * previewSize + 1,
                            offsetY + row * previewSize + 1,
                            previewSize - 2,
                            previewSize - 2
                        );
                    }
                }
            }
        }
    }

    reset() {
        this.board = this.createBoard();
        this.currentPiece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.nextPieces = [];
        this.bag = [];
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.combo = 0;
        this.gameOver = false;
        this.isPaused = false;
        this.dropInterval = 1000;
        this.pendingGarbage = 0;

        this.fillBag();
        for (let i = 0; i < 3; i++) {
            this.nextPieces.push(this.getNextFromBag());
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TetrisGame, TETROMINOES };
}
