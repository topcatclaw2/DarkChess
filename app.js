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

createApp({
  data() {
    return {
      gameMode: "pve",
      difficulty: "normal",
      boardTheme: "classic",
      currentTurn: "human",
      firstPlayer: null,
      playerColors: {},
      board: [],
      selectedPiece: null,
      legalMoves: [],
      gameStatus: "setup",
      message: "選擇模式後開始遊戲。",
      aiThinking: false,
    };
  },
  computed: {
    isBoardDisabled() {
      return this.gameStatus !== "playing" || this.aiThinking || this.currentTurn === "computer";
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
    setMode(mode) {
      this.gameMode = mode;
      this.gameStatus = "setup";
      this.firstPlayer = null;
      this.playerColors = {};
      this.selectedPiece = null;
      this.legalMoves = [];
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
      if (!cell.piece || cell.revealed || this.gameStatus !== "playing") return false;

      cell.revealed = true;
      this.assignColorOnFirstReveal(cell.piece.color);
      this.message = `${ACTOR_NAMES[this.currentTurn]}翻出${COLORS[cell.piece.color]}方「${cell.piece.label}」。`;
      if (!options.skipTurn) this.finishTurn();
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
      if (!source.piece || !source.revealed) return false;

      const actionText = target.piece
        ? `${ACTOR_NAMES[this.currentTurn]}以「${source.piece.label}」吃掉「${target.piece.label}」。`
        : `${ACTOR_NAMES[this.currentTurn]}移動「${source.piece.label}」。`;

      target.piece = source.piece;
      target.revealed = true;
      source.piece = null;
      source.revealed = false;
      this.clearSelection();
      this.message = actionText;

      if (!options.skipTurn) this.finishTurn();
      return true;
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
            score: this.scoreAction(index, to, actor),
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

      if (this.difficulty === "easy") return this.pickRandom(actions);

      const captures = actions.filter((action) => action.type === "move" && this.board[action.to].piece);
      const reveals = actions.filter((action) => action.type === "reveal");
      const moves = actions.filter((action) => action.type === "move" && !this.board[action.to].piece);

      if (this.difficulty === "normal") {
        if (captures.length) return this.pickBest(captures);
        if (reveals.length) return this.pickRandom(reveals);
        return this.pickRandom(moves);
      }

      return this.pickBest(actions.map((action) => ({
        ...action,
        score: action.type === "move" ? this.scoreAction(action.from, action.to, "computer") : 12,
      })));
    },
    scoreAction(from, to, actor) {
      const source = this.board[from];
      const target = this.board[to];
      if (!source?.piece) return 0;

      let score = target?.piece ? target.piece.value + 35 : 8;
      const piece = source.piece;
      const enemyColor = piece.color === "red" ? "black" : "red";

      if (piece.type === "cannon") score += 8;
      if (target?.piece?.type === "general") score += 40;
      if (this.isSquareThreatened(to, enemyColor, from, piece)) score -= piece.value * 0.75;
      if (this.createsCannonLine(to, piece.color, from)) score += 12;
      if (!this.playerColors[actor]) score += 4;

      return score + Math.random() * 3;
    },
    isSquareThreatened(index, byColor, ignoreIndex = null, occupantPiece = null) {
      return this.board.some((cell, sourceIndex) => {
        if (sourceIndex === ignoreIndex || !cell.piece || !cell.revealed || cell.piece.color !== byColor) {
          return false;
        }

        const originalPiece = this.board[index].piece;
        const originalRevealed = this.board[index].revealed;
        const ignoredPiece = ignoreIndex !== null ? this.board[ignoreIndex].piece : null;
        const ignoredRevealed = ignoreIndex !== null ? this.board[ignoreIndex].revealed : false;

        if (ignoreIndex !== null) {
          this.board[ignoreIndex].piece = null;
          this.board[ignoreIndex].revealed = false;
        }
        this.board[index].piece = occupantPiece || originalPiece || {
          color: byColor === "red" ? "black" : "red",
          type: "soldier",
          rank: 1,
        };
        this.board[index].revealed = true;

        const threatened = this.getLegalMovesForIndex(sourceIndex).includes(index);

        this.board[index].piece = originalPiece;
        this.board[index].revealed = originalRevealed;
        if (ignoreIndex !== null) {
          this.board[ignoreIndex].piece = ignoredPiece;
          this.board[ignoreIndex].revealed = ignoredRevealed;
        }

        return threatened;
      });
    },
    createsCannonLine(index, color, ignoreIndex = null) {
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
          if (targetIndex !== ignoreIndex && this.board[targetIndex].piece) {
            screens += 1;
            if (screens === 2) {
              const target = this.board[targetIndex];
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
    cellClasses(cell, index) {
      return {
        empty: !cell.piece,
        selected: this.selectedPiece === index,
        legal: this.legalMoves.includes(index),
        covered: cell.piece && !cell.revealed,
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
