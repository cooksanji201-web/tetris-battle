/**
 * Tetris Battle - Online Client
 * Socket.io client for multiplayer
 */

class OnlineClient {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.isHost = false;
        this.isConnected = false;

        // Callbacks
        this.onPlayerJoined = null;
        this.onGameStart = null;
        this.onOpponentUpdate = null;
        this.onGarbageReceived = null;
        this.onOpponentGameOver = null;
        this.onOpponentLeft = null;
        this.onGameReset = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket = io({
                timeout: 30000,
                reconnectionAttempts: 3,
                reconnectionDelay: 2000
            });

            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.socket.disconnect();
                    reject(new Error('Kết nối timeout'));
                }
            }, 35000);

            this.socket.on('connect', () => {
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                resolve();
            });

            this.socket.on('connect_error', () => {
                this.isConnected = false;
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
            });

            // Game events
            this.socket.on('playerJoined', (data) => {
                if (this.onPlayerJoined) this.onPlayerJoined(data);
            });

            this.socket.on('gameStart', (data) => {
                if (this.onGameStart) this.onGameStart(data);
            });

            this.socket.on('opponentUpdate', (data) => {
                if (this.onOpponentUpdate) this.onOpponentUpdate(data);
            });

            this.socket.on('garbageReceived', (data) => {
                if (this.onGarbageReceived) this.onGarbageReceived(data);
            });

            this.socket.on('opponentGameOver', () => {
                if (this.onOpponentGameOver) this.onOpponentGameOver();
            });

            this.socket.on('opponentLeft', () => {
                if (this.onOpponentLeft) this.onOpponentLeft();
            });

            this.socket.on('gameReset', () => {
                if (this.onGameReset) this.onGameReset();
            });
        });
    }

    createRoom() {
        return new Promise((resolve, reject) => {
            this.socket.emit('createRoom', {}, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.roomCode = response.code;
                this.isHost = true;
                resolve(response);
            });
        });
    }

    joinRoom(code) {
        return new Promise((resolve, reject) => {
            this.socket.emit('joinRoom', code, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.roomCode = code.toUpperCase();
                this.isHost = false;
                resolve(response);
            });
        });
    }

    sendBoardUpdate(boardState) {
        if (this.socket && this.roomCode) {
            this.socket.emit('boardUpdate', {
                roomCode: this.roomCode,
                ...boardState
            });
        }
    }

    sendAttack(lines) {
        if (this.socket && this.roomCode) {
            this.socket.emit('attack', {
                roomCode: this.roomCode,
                lines
            });
        }
    }

    sendGameOver() {
        if (this.socket && this.roomCode) {
            this.socket.emit('gameOver', { roomCode: this.roomCode });
        }
    }

    requestNewGame() {
        if (this.socket && this.roomCode) {
            this.socket.emit('requestNewGame', { roomCode: this.roomCode });
        }
    }

    leave() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.roomCode = null;
        this.isHost = false;
    }
}

const onlineClient = new OnlineClient();
