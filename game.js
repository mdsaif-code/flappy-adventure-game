const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const stageValue = document.getElementById("stageValue");
const highScoreValue = document.getElementById("highScoreValue");

const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const continueButton = document.getElementById("continueButton");

const STORAGE_KEYS = {
  highScore: "flappyAdventureHighScore",
  lastStage: "flappyAdventureLastStage"
};

const SETTINGS = {
  gravity: 1620,
  flapVelocity: -520,
  birdX: 92,
  birdWidth: 56,
  birdHeight: 42,
  pipeWidth: 92,
  groundHeight: 126,
  topMargin: 70,
  bottomMargin: 80,
  startFloatAmount: 9
};

const STAGES = [
  {
    number: 1,
    name: "Mushroom Meadow",
    backgroundKey: "background1",
    pipeGap: 250,
    pipeSpeed: 152,
    backgroundSpeed: 42,
    pipeSpacingMin: 350,
    pipeSpacingMax: 420,
    coinChance: 0.2,
    enemyEnabled: false,
    enemySpawnMin: 99,
    enemySpawnMax: 99,
    enemySpeed: 210,
    maxEnemies: 0,
    goal: 16
  },
  {
    number: 2,
    name: "Sunset Sands",
    backgroundKey: "background2",
    pipeGap: 232,
    pipeSpeed: 180,
    backgroundSpeed: 58,
    pipeSpacingMin: 330,
    pipeSpacingMax: 398,
    coinChance: 0.28,
    enemyEnabled: false,
    enemySpawnMin: 99,
    enemySpawnMax: 99,
    enemySpeed: 220,
    maxEnemies: 0,
    goal: 18
  },
  {
    number: 3,
    name: "Moonlit Hills",
    backgroundKey: "background3",
    pipeGap: 214,
    pipeSpeed: 212,
    backgroundSpeed: 72,
    pipeSpacingMin: 305,
    pipeSpacingMax: 370,
    coinChance: 0.38,
    enemyEnabled: true,
    enemySpawnMin: 4.7,
    enemySpawnMax: 6.2,
    enemySpeed: 248,
    maxEnemies: 1,
    goal: 22
  },
  {
    number: 4,
    name: "Castle Rush",
    backgroundKey: "background4",
    pipeGap: 198,
    pipeSpeed: 238,
    backgroundSpeed: 88,
    pipeSpacingMin: 290,
    pipeSpacingMax: 345,
    coinChance: 0.5,
    enemyEnabled: true,
    enemySpawnMin: 3.6,
    enemySpawnMax: 4.8,
    enemySpeed: 278,
    maxEnemies: 2,
    goal: 24
  },
  {
    number: 5,
    name: "Rainbow Road",
    backgroundKey: "background5",
    pipeGap: 184,
    pipeSpeed: 272,
    backgroundSpeed: 108,
    pipeSpacingMin: 270,
    pipeSpacingMax: 320,
    coinChance: 0.72,
    enemyEnabled: true,
    enemySpawnMin: 2.7,
    enemySpawnMax: 3.7,
    enemySpeed: 318,
    maxEnemies: 3,
    goal: 28
  }
];

const IMAGE_PATHS = {
  background1: "assets/background1.png",
  background2: "assets/background2.png",
  background3: "assets/background3.png",
  background4: "assets/background4.png",
  background5: "assets/background5.png",
  bird: "assets/bird.png",
  pipe: "assets/pipe.png",
  coin: "assets/coin.png",
  enemy: "assets/enemy.png"
};

const SOUND_PATHS = {
  jump: "assets/jump.wav",
  coin: "assets/coin.wav",
  gameOver: "assets/gameover.wav"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function loadImages(paths) {
  const entries = Object.entries(paths);

  return Promise.all(
    entries.map(([key, path]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.src = path;

      if (image.complete && image.naturalWidth > 0) {
        resolve([key, image]);
        return;
      }

      image.addEventListener("load", () => resolve([key, image]), { once: true });
      image.addEventListener("error", () => reject(new Error(`Could not load ${path}`)), { once: true });
    }))
  ).then((loadedEntries) => Object.fromEntries(loadedEntries));
}

class StorageManager {
  static loadHighScore() {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEYS.highScore), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  static saveHighScore(score) {
    localStorage.setItem(STORAGE_KEYS.highScore, String(score));
  }

  static loadLastStage() {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEYS.lastStage), 10);
    if (!Number.isFinite(value)) {
      return 1;
    }

    return clamp(value, 1, STAGES.length);
  }

  static saveLastStage(stageNumber) {
    localStorage.setItem(STORAGE_KEYS.lastStage, String(clamp(stageNumber, 1, STAGES.length)));
  }
}

class SoundManager {
  constructor(paths) {
    this.paths = paths;
    this.audioPools = {
      jump: this.createPool(paths.jump, 4, 0.55),
      coin: this.createPool(paths.coin, 3, 0.5),
      gameOver: this.createPool(paths.gameOver, 2, 0.65)
    };
    this.audioIndexes = {
      jump: 0,
      coin: 0,
      gameOver: 0
    };
    this.context = null;
  }

  createPool(src, size, volume) {
    return Array.from({ length: size }, () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = volume;
      return audio;
    });
  }

  unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!this.context && AudioContextClass) {
      this.context = new AudioContextClass();
    }

    if (this.context && this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }
  }

  play(name) {
    const pool = this.audioPools[name];

    if (!pool) {
      return;
    }

    const index = this.audioIndexes[name];
    const audio = pool[index];
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.audioIndexes[name] = (index + 1) % pool.length;
  }

  playStageComplete() {
    if (!this.context) {
      return;
    }

    const notes = [660, 880, 990, 1320];
    const start = this.context.currentTime;

    notes.forEach((note, index) => {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      const noteStart = start + index * 0.14;
      const noteDuration = 0.16;

      oscillator.type = index % 2 === 0 ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(note, noteStart);
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      gainNode.gain.setValueAtTime(0.06, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteDuration);
    });
  }
}

const Game = {
  assets: {},
  sound: new SoundManager(SOUND_PATHS),
  state: null,
  animationId: null,

  createBird() {
    const baseY = canvas.height * 0.38;

    return {
      x: SETTINGS.birdX,
      y: baseY,
      baseY,
      width: SETTINGS.birdWidth,
      height: SETTINGS.birdHeight,
      velocity: 0,
      rotation: -0.12
    };
  },

  createState() {
    const highScore = StorageManager.loadHighScore();
    const lastStage = StorageManager.loadLastStage();

    return {
      status: "loading",
      score: 0,
      stageScore: 0,
      highScore,
      unlockedStage: lastStage,
      stageNumber: 1,
      pipes: [],
      coins: [],
      enemies: [],
      bird: Game.createBird(),
      distanceUntilPipe: 0,
      enemyTimer: Infinity,
      backgroundX: 0,
      bannerText: "",
      bannerTimer: 0,
      transitionTimer: 0,
      lastFrameTime: 0
    };
  },

  init() {
    Game.showOverlay({
      kicker: "Loading",
      title: "Preparing the adventure...",
      text: "Generating stages, sounds, and save data.",
      buttons: { start: false, restart: false, continue: false }
    });

    loadImages(IMAGE_PATHS)
      .then((assets) => {
        Game.assets = assets;
        Game.state = Game.createState();
        Game.prepareStage(1, { resetScore: true, showMenu: true });
        Game.animationId = requestAnimationFrame(Game.gameLoop.bind(Game));
      })
      .catch((error) => {
        console.error(error);
        Game.showOverlay({
          kicker: "Asset Error",
          title: "The adventure could not load",
          text: "One or more images could not be loaded. Please check the assets folder.",
          buttons: { start: false, restart: false, continue: false }
        });
      });
  },

  getCurrentStage() {
    return STAGES[Game.state.stageNumber - 1];
  },

  updateHud() {
    scoreValue.textContent = String(Game.state.score);
    stageValue.textContent = String(Game.state.stageNumber);
    highScoreValue.textContent = String(Game.state.highScore);
  },

  showOverlay({ kicker, title, text, buttons }) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startButton.hidden = !buttons.start;
    restartButton.hidden = !buttons.restart;
    continueButton.hidden = !buttons.continue;
    continueButton.textContent = `Continue From Stage ${Game.state ? Game.state.unlockedStage : 1}`;
    overlay.classList.add("visible");
  },

  hideOverlay() {
    overlay.classList.remove("visible");
  },

  saveLastStage(stageNumber) {
    if (stageNumber > Game.state.unlockedStage) {
      Game.state.unlockedStage = stageNumber;
      StorageManager.saveLastStage(stageNumber);
    }

    continueButton.textContent = `Continue From Stage ${Game.state.unlockedStage}`;
  },

  updateHighScore() {
    if (Game.state.score > Game.state.highScore) {
      Game.state.highScore = Game.state.score;
      StorageManager.saveHighScore(Game.state.highScore);
    }
  },

  resetEntitiesForStage() {
    Game.state.pipes = [];
    Game.state.coins = [];
    Game.state.enemies = [];
    Game.state.bird = Game.createBird();
  },

  prepareStage(stageNumber, options = {}) {
    const { resetScore = false, showMenu = false, autoStart = false } = options;
    const state = Game.state;
    const stage = STAGES[stageNumber - 1];

    state.stageNumber = stage.number;
    state.stageScore = 0;

    if (resetScore) {
      state.score = 0;
    }

    Game.resetEntitiesForStage();
    state.distanceUntilPipe = randomBetween(stage.pipeSpacingMin - 40, stage.pipeSpacingMin + 20);
    state.enemyTimer = stage.enemyEnabled ? randomFloat(stage.enemySpawnMin, stage.enemySpawnMax) : Infinity;
    state.backgroundX = 0;
    state.bannerText = `Stage ${stage.number}: ${stage.name}`;
    state.bannerTimer = autoStart ? 2.0 : 0;
    state.transitionTimer = 0;
    state.lastFrameTime = 0;

    Game.saveLastStage(stage.number);
    Game.updateHud();

    if (showMenu) {
      state.status = "menu";
      Game.showOverlay({
        kicker: "Adventure Ready",
        title: "Press Space or Start",
        text: "Large pipe gaps, five Mario-style stages, coins, enemies, and saved progress are all ready.",
        buttons: {
          start: true,
          restart: false,
          continue: state.unlockedStage > 1
        }
      });
      return;
    }

    if (autoStart) {
      state.status = "running";
      Game.hideOverlay();
      return;
    }

    state.status = "menu";
  },

  startAdventure(stageNumber) {
    Game.sound.unlock();
    Game.state.score = 0;
    Game.prepareStage(stageNumber, { resetScore: true, autoStart: true });
    Game.flap();
  },

  continueFromLastStage() {
    Game.startAdventure(Game.state.unlockedStage);
  },

  addScore(points) {
    Game.state.score += points;
    Game.state.stageScore += points;
    Game.updateHighScore();
    Game.updateHud();
  },

  flap() {
    if (Game.state.status !== "running") {
      return;
    }

    Game.state.bird.velocity = SETTINGS.flapVelocity;
    Game.sound.play("jump");
  },

  handlePrimaryInput() {
    if (!Game.state || Game.state.status === "loading" || Game.state.status === "stageComplete") {
      return;
    }

    Game.sound.unlock();

    if (Game.state.status === "running") {
      Game.flap();
      return;
    }

    if (Game.state.status === "menu") {
      Game.startAdventure(1);
      return;
    }

    if (Game.state.status === "gameOver") {
      Game.continueFromLastStage();
      return;
    }

    if (Game.state.status === "victory") {
      Game.startAdventure(1);
    }
  },

  spawnPipe() {
    const stage = Game.getCurrentStage();
    const groundY = canvas.height - SETTINGS.groundHeight;
    const maxTopHeight = groundY - stage.pipeGap - SETTINGS.bottomMargin;
    const minTopHeight = SETTINGS.topMargin;
    const topHeight = randomBetween(minTopHeight, maxTopHeight);

    const pipe = {
      x: canvas.width + 40,
      topHeight,
      bottomY: topHeight + stage.pipeGap,
      passed: false
    };

    Game.state.pipes.push(pipe);

    if (Math.random() < stage.coinChance) {
      Game.spawnCoin(pipe);
    }
  },

  spawnCoin(pipe) {
    const size = 34;
    const minY = pipe.topHeight + 24;
    const maxY = pipe.bottomY - size - 24;

    if (maxY <= minY) {
      return;
    }

    Game.state.coins.push({
      x: pipe.x + SETTINGS.pipeWidth * 0.5 - size / 2 + randomBetween(-18, 18),
      y: randomBetween(minY, maxY),
      width: size,
      height: size,
      pulse: Math.random() * Math.PI * 2,
      collected: false
    });
  },

  spawnEnemy() {
    const stage = Game.getCurrentStage();

    if (!stage.enemyEnabled || Game.state.enemies.length >= stage.maxEnemies) {
      return;
    }

    const minY = 90;
    const maxY = canvas.height - SETTINGS.groundHeight - 100;
    const baseY = randomBetween(minY, maxY);

    Game.state.enemies.push({
      x: canvas.width + 70,
      y: baseY,
      baseY,
      width: 50,
      height: 40,
      speed: stage.enemySpeed,
      phase: Math.random() * Math.PI * 2,
      amplitude: randomBetween(8, 16)
    });
  },

  getBirdHitbox() {
    const bird = Game.state.bird;

    return {
      x: bird.x + 8,
      y: bird.y + 6,
      width: bird.width - 16,
      height: bird.height - 12
    };
  },

  collectCoins() {
    const birdHitbox = Game.getBirdHitbox();

    for (const coin of Game.state.coins) {
      if (coin.collected) {
        continue;
      }

      if (rectanglesOverlap(birdHitbox, coin)) {
        coin.collected = true;
        Game.addScore(5);
        Game.sound.play("coin");
      }
    }
  },

  checkPipeCollisions() {
    const birdHitbox = Game.getBirdHitbox();
    const groundY = canvas.height - SETTINGS.groundHeight;

    for (const pipe of Game.state.pipes) {
      const topBox = {
        x: pipe.x,
        y: 0,
        width: SETTINGS.pipeWidth,
        height: pipe.topHeight
      };

      const bottomBox = {
        x: pipe.x,
        y: pipe.bottomY,
        width: SETTINGS.pipeWidth,
        height: groundY - pipe.bottomY
      };

      if (rectanglesOverlap(birdHitbox, topBox) || rectanglesOverlap(birdHitbox, bottomBox)) {
        Game.triggerGameOver();
        return;
      }
    }
  },

  checkEnemyCollisions() {
    const birdHitbox = Game.getBirdHitbox();

    for (const enemy of Game.state.enemies) {
      const enemyBox = {
        x: enemy.x + 6,
        y: enemy.y + 6,
        width: enemy.width - 12,
        height: enemy.height - 12
      };

      if (rectanglesOverlap(birdHitbox, enemyBox)) {
        Game.triggerGameOver();
        return;
      }
    }
  },

  triggerGameOver() {
    if (Game.state.status === "gameOver") {
      return;
    }

    Game.state.status = "gameOver";
    Game.sound.play("gameOver");
    Game.showOverlay({
      kicker: `Stage ${Game.state.stageNumber}`,
      title: "Game Over",
      text: `Score ${Game.state.score}. Restart from the beginning, or continue from Stage ${Game.state.unlockedStage}.`,
      buttons: { start: false, restart: true, continue: true }
    });
  },

  completeStage() {
    const stage = Game.getCurrentStage();

    if (Game.state.stageNumber >= STAGES.length) {
      Game.state.status = "victory";
      Game.sound.playStageComplete();
      Game.showOverlay({
        kicker: "Adventure Clear",
        title: "You cleared all 5 stages!",
        text: `Final score ${Game.state.score}. Restart the full adventure or replay from Stage ${Game.state.unlockedStage}.`,
        buttons: { start: false, restart: true, continue: true }
      });
      return;
    }

    const nextStage = STAGES[Game.state.stageNumber];
    Game.saveLastStage(nextStage.number);
    Game.state.status = "stageComplete";
    Game.state.transitionTimer = 2.2;
    Game.sound.playStageComplete();
    Game.showOverlay({
      kicker: `Stage ${stage.number} Complete`,
      title: `${stage.name} cleared!`,
      text: `Loading Stage ${nextStage.number}: ${nextStage.name}...`,
      buttons: { start: false, restart: false, continue: false }
    });
  },

  updateMenuBird(timeStamp) {
    const bird = Game.state.bird;
    bird.y = bird.baseY + Math.sin(timeStamp * 0.0045) * SETTINGS.startFloatAmount;
    bird.rotation = -0.12 + Math.sin(timeStamp * 0.0045) * 0.05;
  },

  updateRunning(dt) {
    const state = Game.state;
    const stage = Game.getCurrentStage();
    const groundY = canvas.height - SETTINGS.groundHeight;
    const bird = state.bird;

    bird.velocity += SETTINGS.gravity * dt;
    bird.y += bird.velocity * dt;
    bird.rotation = clamp(bird.velocity / 760, -0.45, 1.0);

    if (bird.y < 0) {
      bird.y = 0;
      bird.velocity = 0;
    }

    if (bird.y + bird.height >= groundY) {
      bird.y = groundY - bird.height;
      Game.triggerGameOver();
      return;
    }

    // Pipe spacing is tracked in pixels so wide gaps stay comfortable across stages.
    state.distanceUntilPipe -= stage.pipeSpeed * dt;
    if (state.distanceUntilPipe <= 0) {
      Game.spawnPipe();
      state.distanceUntilPipe = randomBetween(stage.pipeSpacingMin, stage.pipeSpacingMax);
    }

    if (stage.enemyEnabled) {
      state.enemyTimer -= dt;
      if (state.enemyTimer <= 0) {
        Game.spawnEnemy();
        state.enemyTimer = randomFloat(stage.enemySpawnMin, stage.enemySpawnMax);
      }
    }

    for (const pipe of state.pipes) {
      pipe.x -= stage.pipeSpeed * dt;

      if (!pipe.passed && pipe.x + SETTINGS.pipeWidth < bird.x) {
        pipe.passed = true;
        Game.addScore(1);
      }
    }

    for (const coin of state.coins) {
      coin.x -= stage.pipeSpeed * dt;
      coin.pulse += dt * 8;
    }

    for (const enemy of state.enemies) {
      enemy.x -= enemy.speed * dt;
      enemy.phase += dt * 5;
      enemy.y = enemy.baseY + Math.sin(enemy.phase) * enemy.amplitude;
    }

    state.pipes = state.pipes.filter((pipe) => pipe.x + SETTINGS.pipeWidth > -40);
    state.coins = state.coins.filter((coin) => !coin.collected && coin.x + coin.width > -40);
    state.enemies = state.enemies.filter((enemy) => enemy.x + enemy.width > -50);

    Game.collectCoins();
    Game.checkPipeCollisions();
    if (state.status !== "running") {
      return;
    }

    Game.checkEnemyCollisions();
    if (state.status !== "running") {
      return;
    }

    if (state.stageScore >= stage.goal) {
      Game.completeStage();
    }
  },

  update(dt, timeStamp) {
    if (!Game.state) {
      return;
    }

    const state = Game.state;
    const stage = Game.getCurrentStage();
    const background = Game.assets[stage.backgroundKey];
    const backgroundWidth = background ? background.width : canvas.width;
    const scrollSpeed = stage.backgroundSpeed;

    if (state.status === "running") {
      state.backgroundX = (state.backgroundX + scrollSpeed * dt) % backgroundWidth;
    } else {
      state.backgroundX = (state.backgroundX + scrollSpeed * dt * 0.15) % backgroundWidth;
    }

    if (state.bannerTimer > 0) {
      state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    }

    if (state.status === "menu" || state.status === "gameOver" || state.status === "victory") {
      Game.updateMenuBird(timeStamp);
      return;
    }

    if (state.status === "stageComplete") {
      state.transitionTimer -= dt;
      if (state.transitionTimer <= 0) {
        Game.prepareStage(state.stageNumber + 1, { autoStart: true });
      }
      return;
    }

    if (state.status === "running") {
      Game.updateRunning(dt);
    }
  },

  drawBackground() {
    const stage = Game.getCurrentStage();
    const background = Game.assets[stage.backgroundKey];
    const width = background.width || canvas.width;
    const offsetX = Game.state.backgroundX % width;

    ctx.drawImage(background, -offsetX, 0, width, canvas.height);
    ctx.drawImage(background, width - offsetX, 0, width, canvas.height);
  },

  drawGroundLine() {
    const groundY = canvas.height - SETTINGS.groundHeight;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(0, groundY - 4, canvas.width, 4);
    ctx.restore();
  },

  drawPipes() {
    for (const pipe of Game.state.pipes) {
      const groundY = canvas.height - SETTINGS.groundHeight;
      const bottomHeight = groundY - pipe.bottomY;

      ctx.drawImage(Game.assets.pipe, pipe.x, pipe.bottomY, SETTINGS.pipeWidth, bottomHeight);

      // Flip the top pipe so both openings face the center gap.
      ctx.save();
      ctx.translate(pipe.x, pipe.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(Game.assets.pipe, 0, 0, SETTINGS.pipeWidth, pipe.topHeight);
      ctx.restore();
    }
  },

  drawCoins() {
    for (const coin of Game.state.coins) {
      const scale = 1 + Math.sin(coin.pulse) * 0.08;
      const drawWidth = coin.width * scale;
      const drawHeight = coin.height * scale;
      const drawX = coin.x - (drawWidth - coin.width) / 2;
      const drawY = coin.y - (drawHeight - coin.height) / 2;
      ctx.drawImage(Game.assets.coin, drawX, drawY, drawWidth, drawHeight);
    }
  },

  drawEnemies() {
    for (const enemy of Game.state.enemies) {
      ctx.save();
      ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
      ctx.rotate(Math.sin(enemy.phase) * 0.08);
      ctx.drawImage(Game.assets.enemy, -enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
      ctx.restore();
    }
  },

  drawBird() {
    const bird = Game.state.bird;

    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation);
    ctx.drawImage(
      Game.assets.bird,
      -bird.width / 2,
      -bird.height / 2,
      bird.width,
      bird.height
    );
    ctx.restore();
  },

  drawStageGoal() {
    const stage = Game.getCurrentStage();
    ctx.save();
    ctx.fillStyle = "rgba(10, 39, 63, 0.58)";
    ctx.fillRect(16, canvas.height - 54, 188, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillText(`Stage Goal: ${Game.state.stageScore}/${stage.goal}`, 28, canvas.height - 31);
    ctx.restore();
  },

  drawBanner() {
    if (Game.state.bannerTimer <= 0) {
      return;
    }

    const alpha = Math.min(1, Game.state.bannerTimer);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(195, 56, 43, 0.88)";
    ctx.fillRect(58, 24, canvas.width - 116, 42);
    ctx.strokeStyle = "rgba(255, 238, 174, 0.95)";
    ctx.lineWidth = 3;
    ctx.strokeRect(58, 24, canvas.width - 116, 42);
    ctx.fillStyle = "#fff5cf";
    ctx.textAlign = "center";
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText(Game.state.bannerText, canvas.width / 2, 51);
    ctx.restore();
  },

  draw() {
    if (!Game.state) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Game.drawBackground();
    Game.drawPipes();
    Game.drawCoins();
    Game.drawEnemies();
    Game.drawBird();
    Game.drawGroundLine();
    Game.drawStageGoal();
    Game.drawBanner();
  },

  gameLoop(timeStamp) {
    if (!Game.state) {
      return;
    }

    if (!Game.state.lastFrameTime) {
      Game.state.lastFrameTime = timeStamp;
    }

    // Clamp delta time to keep the game stable after tab switches.
    const dt = Math.min(0.032, (timeStamp - Game.state.lastFrameTime) / 1000);
    Game.state.lastFrameTime = timeStamp;

    Game.update(dt, timeStamp);
    Game.draw();
    Game.animationId = requestAnimationFrame(Game.gameLoop.bind(Game));
  }
};

startButton.addEventListener("click", () => {
  Game.startAdventure(1);
});

restartButton.addEventListener("click", () => {
  Game.startAdventure(1);
});

continueButton.addEventListener("click", () => {
  Game.continueFromLastStage();
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  Game.handlePrimaryInput();
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") {
    return;
  }

  event.preventDefault();
  Game.handlePrimaryInput();
});

Game.init();
