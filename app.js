const { createApp } = Vue;

const COLS = 8;
const ROWS = 4;
const COLORS = {
  red: "紅",
  black: "黑",
};

const PIECES = [
  { color: "red", type: "general", label: "帥", rank: 7, value: 120, count: 1 },
  { color: "red", type: "guard", label: "仕", rank: 6, value: 60, count: 2 },
  { color: "red", type: "elephant", label: "相", rank: 5, value: 50, count: 2 },
  { color: "red", type: "rook", label: "俥", rank: 4, value: 40, count: 2 },
  { color: "red", type: "horse", label: "傌", rank: 3, value: 30, count: 2 },
  { color: "red", type: "cannon", label: "炮", rank: 2, value: 35, count: 2 },
  { color: "red", type: "soldier", label: "兵", rank: 1, value: 20, count: 5 },
  { color: "black", type: "general", label: "將", rank: 7, value: 120, count: 1 },
  { color: "black", type: "guard", label: "士", rank: 6, value: 60, count: 2 },
  { color: "black", type: "elephant", label: "象", rank: 5, value: 50, count: 2 },
  { color: "black", type: "rook", label: "車", rank: 4, value: 40, count: 2 },
  { color: "black", type: "horse", label: "馬", rank: 3, value: 30, count: 2 },
  { color: "black", type: "cannon", label: "砲", rank: 2, value: 35, count: 2 },
  { color: "black", type: "soldier", label: "卒", rank: 1, value: 20, count: 5 },
];

const ACTOR_NAMES = {
  player1: "玩家一",
  player2: "玩家二",
  human: "玩家",
  computer: "電腦",
};

const SCRIPT_BASE_URL = document.currentScript?.src || document.baseURI;
const PIECE_ASSET_BASE = new URL("./assets/pieces/", SCRIPT_BASE_URL).href;
const ACTION_ANIMATION_MS = { reveal: 420, capture: 360 };

createApp({
  data() {
    return {
      gameMode: "pve",
      difficulty: "normal",
      boardTheme: "classic",
      pieceTheme: "cat",
      currentTurn: "human",
      firstPlayer: null,
      playerColors: {},
      board: [],
      selectedPiece: null,
      legalMoves: [],
      gameStatus: "setup",
      message: "選擇模式後開始遊戲。",
      aiThinking: false,
      animation: {
        type: null,
        token: 0,
        index: null,
        from: null,
        to: null,
        attacker: null,
        captured: null,
        actionText: "",
        skipTurn: false,
        overlayStyle: null,
      },
      animationTimer: null,
    };
  },
  computed: {
    isBoardDisabled() {
      return this.gameStatus !== "playing" || this.aiThinking || this.isAnimating || this.currentTurn === "computer";
    },
    isAnimating() {
      return Boolean(this.animation.type);
    },
    pieceBackPath() {
      return new URL("cat/back.png", PIECE_ASSET_BASE).href;
    },
    statusText() {
      if (this.gameStatus === "setup") return "尚未開始";
      if (this.gameStatus === "ended") return "已結束";
      return this.aiThinking ? "電腦思考中" : "進行中";
    },
    turnText() {
      if (this.gameStatus === "setup") return "尚未決定";
      return ACTOR_NAMES[this.currentTurn] || "尚未決定";
    },
    firstPlayerText() {
      if (this.gameMode !== "pve") return "不適用";
      if (!this.firstPlayer) return "尚未抽籤";
      return `${ACTOR_NAMES[this.firstPlayer]}先手`;
    },
    colorAssignmentText() {
      const entries = Object.entries(this.playerColors);
      if (!entries.length) return "首翻後決定";
      return entries
        .map(([actor, color]) => `${ACTOR_NAMES[actor]}:${COLORS[color]}`)
        .join(" / ");
    },
    remainingCount() {
      return this.board.reduce(
        (counts, cell) => {
          if (cell.piece) counts[cell.piece.color] += 1;
          return counts;
        },
        { red: 0, black: 0 }
      );
    },
  },
  mounted() {
    this.resetBoard();
  },
  methods: {
    setBoardTheme(theme) {
      this.boardTheme = theme;
    },
    setPieceTheme(theme) {
      this.pieceTheme = theme;
    },
    setMode(mode) {
      this.gameMode = mode;
      this.gameStatus = "setup";
      this.firstPlayer = null;
      this.playerColors = {};
      this.selectedPiece = null;
      this.legalMoves = [];
      this.clearAnimation();
      this.currentTurn = mode === "pve" ? "human" : "player1";
      this.message = "選擇模式後開始遊戲。";
      this.resetBoard();
    },
    startGame() {
      this.resetBoard();
      this.playerColors = {};
      this.selectedPiece = null;
      this.legalMoves = [];
      this.gameStatus = "playing";
      this.aiThinking = false;
      this.clearAnimation();

      if (this.gameMode === "pve") {
        this.firstPlayer = Math.random() < 0.5 ? "human" : "computer";
        this.currentTurn = this.firstPlayer;
        this.message = `${ACTOR_NAMES[this.firstPlayer]}抽中先手，請翻開第一顆棋。`;
        if (this.currentTurn === "computer") this.queueComputerMove();
      } else {
        this.firstPlayer = null;
        this.currentTurn = "player1";
        this.message = "玩家一先手，請翻開第一顆棋。";
      }
    },
    resetBoard() {
      const deck = [];
      PIECES.forEach((piece) => {
        for (let i = 0; i < piece.count; i += 1) {
          deck.push({
            color: piece.color,
            type: piece.type,
            label: piece.label,
            rank: piece.rank,
            value: piece.value,
          });
        }
      });

      this.shuffle(deck);
      this.board = deck.map((piece, index) => ({
        id: `${Date.now()}-${index}-${piece.color}-${piece.label}`,
        piece,
        revealed: false,
        revealing: false,
      }));
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    },
    handleCellClick(index) {
      if (this.isBoardDisabled) return;
      const cell = this.board[index];

      if (this.selectedPiece !== null && this.legalMoves.includes(index)) {
        this.performMove(this.selectedPiece, index);
        return;
      }

      if (cell.piece && !cell.revealed) {
        this.revealPiece(index);
        return;
      }

      if (this.canSelectPiece(index)) {
        this.selectPiece(index);
        return;
      }

      this.clearSelection();
    },
    revealPiece(index, options = {}) {
      const cell = this.board[index];
      if (!cell.piece || cell.revealed || cell.revealing || this.gameStatus !== "playing" || this.isAnimating) return false;

      cell.revealing = true;
      const token = this.beginAnimation({
        type: "reveal",
        index,
        skipTurn: Boolean(options.skipTurn),
      });
      this.message = `${ACTOR_NAMES[this.currentTurn]}正在翻開棋子...`;
      this.scheduleAnimationCompletion(token, ACTION_ANIMATION_MS.reveal);
      return true;
    },
    assignColorOnFirstReveal(color) {
      if (Object.keys(this.playerColors).length) return;
      const opponentColor = color === "red" ? "black" : "red";

      if (this.gameMode === "pve") {
        if (this.currentTurn === "human") {
          this.playerColors = { human: color, computer: opponentColor };
        } else {
          this.playerColors = { computer: color, human: opponentColor };
        }
      } else if (this.currentTurn === "player1") {
        this.playerColors = { player1: color, player2: opponentColor };
      } else {
        this.playerColors = { player2: color, player1: opponentColor };
      }
    },
    canSelectPiece(index) {
      const cell = this.board[index];
      const color = this.playerColors[this.currentTurn];
      return Boolean(
        cell.piece &&
        cell.revealed &&
        color &&
        cell.piece.color === color &&
        this.getLegalMovesForIndex(index).length
      );
    },
    selectPiece(index) {
      this.selectedPiece = index;
      this.legalMoves = this.getLegalMovesForIndex(index);
      this.message = `已選取「${this.board[index].piece.label}」，請選擇可行動位置。`;
    },
    clearSelection() {
      this.selectedPiece = null;
      this.legalMoves = [];
    },
    performMove(from, to, options = {}) {
      const source = this.board[from];
      const target = this.board[to];
      if (!source.piece || !source.revealed || this.isAnimating) return false;

      const actionText = target.piece
        ? `${ACTOR_NAMES[this.currentTurn]}以「${source.piece.label}」吃掉「${target.piece.label}」。`
        : `${ACTOR_NAMES[this.currentTurn]}移動「${source.piece.label}」。`;

      if (target.piece) {
        const token = this.beginAnimation({
          type: "capture",
          from,
          to,
          attacker: { ...source.piece },
          captured: { ...target.piece },
          actionText,
          skipTurn: Boolean(options.skipTurn),
        });
        this.clearSelection();
        this.message = `${ACTOR_NAMES[this.currentTurn]}正在吃棋...`;
        this.$nextTick(() => this.positionCaptureOverlay(from, to, token));
        this.scheduleAnimationCompletion(token, ACTION_ANIMATION_MS.capture);
        return true;
      }

      target.piece = source.piece;
      target.revealed = true;
      source.piece = null;
      source.revealed = false;
      this.clearSelection();
      this.message = actionText;

      if (!options.skipTurn) this.finishTurn();
      return true;
    },
    beginAnimation(animation) {
      this.cancelAnimationTimer();
      const token = this.animation.token + 1;
      this.animation = {
        ...this.animation,
        ...animation,
        token,
      };
      return token;
    },
    scheduleAnimationCompletion(token, duration) {
      this.cancelAnimationTimer();
      this.animationTimer = window.setTimeout(() => this.completeAnimation(token), duration + 100);
    },
    completeAnimation(token) {
      if (this.animation.token !== token || !this.animation.type) return;
      this.cancelAnimationTimer();

      if (this.animation.type === "reveal") {
        const cell = this.board[this.animation.index];
        if (!cell?.piece) return this.clearAnimation();
        cell.revealing = false;
        cell.revealed = true;
        this.assignColorOnFirstReveal(cell.piece.color);
        this.message = `${ACTOR_NAMES[this.currentTurn]}翻出${COLORS[cell.piece.color]}方「${cell.piece.label}」。`;
        const skipTurn = this.animation.skipTurn;
        this.clearAnimation();
        if (!skipTurn) this.finishTurn();
        return;
      }

      const source = this.board[this.animation.from];
      const target = this.board[this.animation.to];
      if (!source?.piece || !target) return this.clearAnimation();
      target.piece = source.piece;
      target.revealed = true;
      source.piece = null;
      source.revealed = false;
      this.message = this.animation.actionText;
      const skipTurn = this.animation.skipTurn;
      this.clearAnimation();
      if (!skipTurn) this.finishTurn();
    },
    handleAnimationEnd(type) {
      if (this.animation.type === type) this.completeAnimation(this.animation.token);
    },
    positionCaptureOverlay(from, to, token) {
      if (this.animation.token !== token || this.animation.type !== "capture") return;
      const boardWrap = this.$refs.boardWrap;
      const sourceEl = boardWrap?.querySelector(`[data-cell-index="${from}"]`);
      const targetEl = boardWrap?.querySelector(`[data-cell-index="${to}"]`);
      if (!boardWrap || !sourceEl || !targetEl) return;

      const boardRect = boardWrap.getBoundingClientRect();
      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const sourceCenter = {
        x: sourceRect.left - boardRect.left + sourceRect.width / 2,
        y: sourceRect.top - boardRect.top + sourceRect.height / 2,
      };
      const targetCenter = {
        x: targetRect.left - boardRect.left + targetRect.width / 2,
        y: targetRect.top - boardRect.top + targetRect.height / 2,
      };
      this.animation.overlayStyle = {
        left: `${sourceCenter.x}px`,
        top: `${sourceCenter.y}px`,
        width: `${sourceRect.width * 0.84}px`,
        height: `${sourceRect.height * 0.84}px`,
        "--capture-dx": `${targetCenter.x - sourceCenter.x}px`,
        "--capture-dy": `${targetCenter.y - sourceCenter.y}px`,
      };
    },
    cancelAnimationTimer() {
      if (this.animationTimer !== null) {
        window.clearTimeout(this.animationTimer);
        this.animationTimer = null;
      }
    },
    clearAnimation() {
      this.cancelAnimationTimer();
      this.animation = {
        type: null,
        token: this.animation.token,
        index: null,
        from: null,
        to: null,
        attacker: null,
        captured: null,
        actionText: "",
        skipTurn: false,
        overlayStyle: null,
      };
    },
    finishTurn() {
      const winner = this.getWinner();
      if (winner) {
        this.gameStatus = "ended";
        this.message = `${this.getActorByColor(winner)}獲勝！`;
        this.clearSelection();
        return;
      }

      this.currentTurn = this.getNextTurn();
      const actions = this.getAllLegalActions(this.currentTurn);
      if (!actions.length) {
        const winnerActor = this.getNextTurn();
        this.gameStatus = "ended";
        this.message = `${ACTOR_NAMES[this.currentTurn]}沒有合法動作，${ACTOR_NAMES[winnerActor]}獲勝！`;
        return;
      }

      if (this.currentTurn === "computer") {
        this.queueComputerMove();
      }
    },
    getNextTurn() {
      if (this.gameMode === "pve") return this.currentTurn === "human" ? "computer" : "human";
      return this.currentTurn === "player1" ? "player2" : "player1";
    },
    getWinner() {
      if (!Object.keys(this.playerColors).length) return null;
      if (this.remainingCount.red === 0) return "black";
      if (this.remainingCount.black === 0) return "red";
      return null;
    },
    getActorByColor(color) {
      const match = Object.entries(this.playerColors).find(([, actorColor]) => actorColor === color);
      return match ? ACTOR_NAMES[match[0]] : `${COLORS[color]}方`;
    },
    getLegalMovesForIndex(index) {
      const cell = this.board[index];
      if (!cell.piece || !cell.revealed) return [];

      if (cell.piece.type === "cannon") {
        return this.getCannonMoves(index);
      }

      return this.getAdjacentIndexes(index).filter((targetIndex) => {
        const target = this.board[targetIndex];
        if (!target.piece) return true;
        return target.revealed && this.canCapture(cell.piece, target.piece);
      });
    },
    getAdjacentIndexes(index) {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const positions = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];

      return positions
        .filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
        .map(([r, c]) => r * COLS + c);
    },
    getCannonMoves(index) {
      const moves = [];
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      this.getAdjacentIndexes(index).forEach((targetIndex) => {
        if (!this.board[targetIndex].piece) moves.push(targetIndex);
      });

      directions.forEach(([dr, dc]) => {
        let r = row + dr;
        let c = col + dc;
        let screens = 0;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const targetIndex = r * COLS + c;
          const target = this.board[targetIndex];
          if (target.piece) {
            screens += 1;
            if (screens === 2) {
              if (target.revealed && target.piece.color !== this.board[index].piece.color) {
                moves.push(targetIndex);
              }
              break;
            }
          }
          r += dr;
          c += dc;
        }
      });

      return moves;
    },
    canCapture(attacker, defender) {
      if (!defender || attacker.color === defender.color) return false;
      if (attacker.type === "cannon") return false;
      if (attacker.type === "soldier" && defender.type === "general") return true;
      if (attacker.type === "general" && defender.type === "soldier") return false;
      return attacker.rank >= defender.rank;
    },
    getAllLegalActions(actor) {
      if (this.gameStatus !== "playing") return [];
      const color = this.playerColors[actor];
      const actions = [];

      this.board.forEach((cell, index) => {
        if (cell.piece && !cell.revealed) {
          actions.push({ type: "reveal", index, score: 0 });
        }
      });

      if (!color) return actions;

      this.board.forEach((cell, index) => {
        if (!cell.piece || !cell.revealed || cell.piece.color !== color) return;
        this.getLegalMovesForIndex(index).forEach((to) => {
          actions.push({
            type: "move",
            from: index,
            to,
            score: 0,
          });
        });
      });

      return actions;
    },
    queueComputerMove() {
      if (this.gameStatus !== "playing") return;
      this.aiThinking = true;
      this.message = "電腦思考中...";
      window.setTimeout(() => {
        this.takeComputerTurn();
      }, 650);
    },
    takeComputerTurn() {
      if (this.gameStatus !== "playing" || this.currentTurn !== "computer") {
        this.aiThinking = false;
        return;
      }

      const action = this.chooseComputerAction();
      this.aiThinking = false;

      if (!action) {
        this.gameStatus = "ended";
        this.message = "電腦沒有合法動作，玩家獲勝！";
        return;
      }

      if (action.type === "reveal") {
        this.revealPiece(action.index);
      } else {
        this.performMove(action.from, action.to);
      }
    },
    chooseComputerAction() {
      const actions = this.getAllLegalActions("computer");
      if (!actions.length) return null;

      const scoredActions = actions.map((action) => this.scoreComputerAction(action, this.difficulty));
      const captures = scoredActions.filter((action) => action.type === "move" && this.board[action.to].piece);
      const reveals = scoredActions.filter((action) => action.type === "reveal");
      const moves = scoredActions.filter((action) => action.type === "move" && !this.board[action.to].piece);

      if (this.difficulty === "easy") {
        const safeEnough = scoredActions.filter((action) => action.score > -45);
        return this.pickRandom(safeEnough.length ? safeEnough : scoredActions);
      }

      if (this.difficulty === "normal") {
        const safeCaptures = captures.filter((action) => action.score >= 20);
        if (safeCaptures.length) return this.pickBest(safeCaptures);
        const usefulMoves = moves.filter((action) => action.score >= 12);
        if (usefulMoves.length && (!reveals.length || this.pickBest(usefulMoves).score >= this.pickBest(reveals).score)) {
          return this.pickBest(usefulMoves);
        }
        if (reveals.length) return this.pickWeighted(reveals);
        return this.pickBest(scoredActions);
      }

      return this.pickBest(scoredActions);
    },
    scoreComputerAction(action, difficulty = "normal") {
      if (action.type === "reveal") {
        return {
          ...action,
          score: this.scoreRevealAction(action.index, difficulty) + Math.random() * 4,
        };
      }

      const simulatedBoard = this.simulateAction(action);
      const source = this.board[action.from];
      const target = this.board[action.to];
      const piece = source?.piece;
      if (!piece) return { ...action, score: -Infinity };

      const enemyColor = piece.color === "red" ? "black" : "red";
      const wasThreatened = this.isSquareThreatenedOnBoard(action.from, enemyColor, this.board);
      const isThreatened = this.isSquareThreatenedOnBoard(action.to, enemyColor, simulatedBoard);
      const mobility = this.getLegalMovesForIndexOnBoard(action.to, simulatedBoard).length;
      const captureValue = target?.piece ? target.piece.value : 0;

      let score = target?.piece ? captureValue + 32 : 8;
      if (target?.piece?.type === "general") score += 45;
      if (target?.piece) score += (captureValue - piece.value) * 0.35;
      if (piece.type === "cannon") score += target?.piece ? 12 : 3;
      if (wasThreatened && !isThreatened) score += 18 + piece.value * 0.18;
      if (isThreatened) score -= piece.value * (target?.piece ? 0.85 : 0.95);
      if (this.createsCannonLineOnBoard(action.to, piece.color, simulatedBoard, action.from)) score += 14;
      score += Math.min(mobility, 4) * 1.5;

      if (difficulty === "hard") {
        score += this.evaluateMaterial(simulatedBoard, "computer") * 0.08;
        score -= this.getBestReplyScore("human", simulatedBoard) * 0.85;
      }

      return { ...action, score: score + Math.random() * 3 };
    },
    scoreRevealAction(index, difficulty = "normal") {
      const color = this.playerColors.computer;
      if (!color) return 18 + this.centerBias(index);

      const enemyColor = color === "red" ? "black" : "red";
      const adjacent = this.getAdjacentIndexes(index);
      const nearEnemy = adjacent.some((targetIndex) => {
        const target = this.board[targetIndex];
        return target.piece && target.revealed && target.piece.color === enemyColor;
      });
      const nearOwn = adjacent.some((targetIndex) => {
        const target = this.board[targetIndex];
        return target.piece && target.revealed && target.piece.color === color;
      });

      let score = difficulty === "hard" ? 11 : 14;
      score += this.centerBias(index);
      if (nearEnemy) score -= difficulty === "hard" ? 8 : 4;
      if (nearOwn) score += 3;
      return score;
    },
    centerBias(index) {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      return 3 - Math.abs(row - 1.5) - Math.abs(col - 3.5) * 0.35;
    },
    cloneBoard(board = this.board) {
      return board.map((cell) => ({
        id: cell.id,
        revealed: cell.revealed,
        piece: cell.piece ? { ...cell.piece } : null,
      }));
    },
    simulateAction(action, board = this.board) {
      const nextBoard = this.cloneBoard(board);
      if (action.type === "reveal") {
        if (nextBoard[action.index]?.piece) nextBoard[action.index].revealed = true;
        return nextBoard;
      }

      const source = nextBoard[action.from];
      const target = nextBoard[action.to];
      if (!source?.piece || !target) return nextBoard;

      target.piece = source.piece;
      target.revealed = true;
      source.piece = null;
      source.revealed = false;
      return nextBoard;
    },
    getBestReplyScore(actor, board) {
      const replies = this.getAllLegalActionsOnBoard(actor, board).filter((action) => action.type === "move");
      if (!replies.length) return 0;
      return Math.max(...replies.map((action) => this.scoreReplyAction(action, board)));
    },
    scoreReplyAction(action, board) {
      const source = board[action.from];
      const target = board[action.to];
      if (!source?.piece) return 0;

      let score = target?.piece ? target.piece.value + 28 : 4;
      if (target?.piece?.type === "general") score += 45;
      if (target?.piece) score += (target.piece.value - source.piece.value) * 0.25;
      return score;
    },
    evaluateMaterial(board, actor) {
      const color = this.playerColors[actor];
      if (!color) return 0;
      return board.reduce((total, cell) => {
        if (!cell.piece) return total;
        return total + (cell.piece.color === color ? cell.piece.value : -cell.piece.value);
      }, 0);
    },
    getAllLegalActionsOnBoard(actor, board) {
      const color = this.playerColors[actor];
      const actions = [];

      board.forEach((cell, index) => {
        if (cell.piece && !cell.revealed) actions.push({ type: "reveal", index, score: 0 });
      });

      if (!color) return actions;

      board.forEach((cell, index) => {
        if (!cell.piece || !cell.revealed || cell.piece.color !== color) return;
        this.getLegalMovesForIndexOnBoard(index, board).forEach((to) => {
          actions.push({ type: "move", from: index, to, score: 0 });
        });
      });

      return actions;
    },
    getLegalMovesForIndexOnBoard(index, board) {
      const cell = board[index];
      if (!cell?.piece || !cell.revealed) return [];

      if (cell.piece.type === "cannon") return this.getCannonMovesOnBoard(index, board);

      return this.getAdjacentIndexes(index).filter((targetIndex) => {
        const target = board[targetIndex];
        if (!target.piece) return true;
        return target.revealed && this.canCapture(cell.piece, target.piece);
      });
    },
    getCannonMovesOnBoard(index, board) {
      const moves = [];
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      this.getAdjacentIndexes(index).forEach((targetIndex) => {
        if (!board[targetIndex].piece) moves.push(targetIndex);
      });

      directions.forEach(([dr, dc]) => {
        let r = row + dr;
        let c = col + dc;
        let screens = 0;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const targetIndex = r * COLS + c;
          const target = board[targetIndex];
          if (target.piece) {
            screens += 1;
            if (screens === 2) {
              if (target.revealed && target.piece.color !== board[index].piece.color) moves.push(targetIndex);
              break;
            }
          }
          r += dr;
          c += dc;
        }
      });

      return moves;
    },
    isSquareThreatenedOnBoard(index, byColor, board) {
      return board.some((cell, sourceIndex) => (
        cell.piece &&
        cell.revealed &&
        cell.piece.color === byColor &&
        this.getLegalMovesForIndexOnBoard(sourceIndex, board).includes(index)
      ));
    },
    createsCannonLineOnBoard(index, color, board, ignoreIndex = null) {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      return directions.some(([dr, dc]) => {
        let r = row + dr;
        let c = col + dc;
        let screens = 0;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const targetIndex = r * COLS + c;
          if (targetIndex !== ignoreIndex && board[targetIndex].piece) {
            screens += 1;
            if (screens === 2) {
              const target = board[targetIndex];
              return target.revealed && target.piece.color !== color;
            }
          }
          r += dr;
          c += dc;
        }
        return false;
      });
    },
    pickRandom(items) {
      return items[Math.floor(Math.random() * items.length)];
    },
    pickBest(items) {
      return items.reduce((best, item) => (item.score > best.score ? item : best), items[0]);
    },
    pickWeighted(items) {
      const sorted = [...items].sort((a, b) => b.score - a.score);
      const top = sorted.slice(0, Math.min(3, sorted.length));
      return this.pickRandom(top);
    },
    pieceAssetPath(piece) {
      return new URL(`cat/${piece.color}-${piece.type}.png`, PIECE_ASSET_BASE).href;
    },
    pieceAltText(piece) {
      return `${COLORS[piece.color]}方${piece.label}貓咪棋子`;
    },
    cellClasses(cell, index) {
      return {
        empty: !cell.piece,
        selected: this.selectedPiece === index,
        legal: this.legalMoves.includes(index),
        covered: cell.piece && !cell.revealed,
        "capture-source": this.animation.type === "capture" && this.animation.from === index,
        "capture-target": this.animation.type === "capture" && this.animation.to === index,
      };
    },
    cellAriaLabel(cell, index) {
      const row = Math.floor(index / COLS) + 1;
      const col = (index % COLS) + 1;
      if (!cell.piece) return `第${row}列第${col}欄，空格`;
      if (!cell.revealed) return `第${row}列第${col}欄，蓋牌`;
      return `第${row}列第${col}欄，${COLORS[cell.piece.color]}方${cell.piece.label}`;
    },
  },
}).mount("#app");
