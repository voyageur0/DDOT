// AI Loader Enhanced avec Mini-Jeux Rétro
class AILoaderEnhanced {
  constructor() {
    this.progressValue = 0;
    this.activeGame = null;
    this.games = {
      snake: new SnakeGame(),
      breakout: new BreakoutGame(),
      spaceshooter: new SpaceShooterGame()
    };
    this.steps = [
      { id: 'geo', title: 'Géolocalisation', desc: 'Recherche de la parcelle' },
      { id: 'rdppf', title: 'Extraction RDPPF', desc: 'Analyse des données cadastrales' },
      { id: 'reglements', title: 'Règlements communaux', desc: 'Analyse des contraintes locales' },
      { id: 'synthesis', title: 'Synthèse IA', desc: 'Génération du rapport' }
    ];
    this.currentStep = 0;
    this.estimatedTime = 45; // secondes
    this.startTime = Date.now();
  }

  init() {
    this.render();
    this.startProgress();
    this.setupGameEvents();
  }

  render() {
    // Trouver le div existant où afficher le loader
    let resultsDiv = document.getElementById('aiAnalysisResultsNew');
    if (!resultsDiv) {
        resultsDiv = document.getElementById('aiAnalysisResults');
    }
    
    if (!resultsDiv) {
        console.error('Impossible de trouver le div pour le loader');
        return;
    }
    
    // Créer le contenu du loader
    resultsDiv.innerHTML = `
      <div class="ai-loader-main">
        <!-- Header avec progression circulaire -->
        <div class="ai-loader-header">
          <div class="ai-progress-container">
            <svg class="ai-progress-svg" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#5b63f5;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle class="ai-progress-bg" cx="60" cy="60" r="50" />
              <circle class="ai-progress-fill" cx="60" cy="60" r="50" 
                      stroke-dasharray="314" stroke-dashoffset="314" />
            </svg>
            <div class="ai-progress-text">0%</div>
          </div>
          <div class="ai-loader-info">
            <h2 class="ai-loader-title">Analyse en cours...</h2>
            <p class="ai-loader-subtitle">Analyse approfondie de votre parcelle</p>
          </div>
        </div>

        <!-- Barre de progression -->
        <div class="ai-progress-bar">
          <div class="ai-progress-bar-fill" style="width: 0%"></div>
        </div>

        <!-- Étapes -->
        <div class="ai-steps-section">
          ${this.steps.map((step, i) => `
            <div class="ai-step ${i === 0 ? 'active' : ''}" data-step="${i}">
              <div class="ai-step-icon">
                ${this.getStepIcon(step.id)}
              </div>
              <div class="ai-step-content">
                <div class="ai-step-title">${step.title}</div>
                <div class="ai-step-desc">${step.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Section des mini-jeux -->
        <div class="ai-games-section">
          <div class="ai-games-header">
            <h3 class="ai-games-title">En attendant, jouez !</h3>
            <p class="ai-games-subtitle">Choisissez un jeu pour passer le temps</p>
          </div>
          
          <div class="ai-games-grid">
            <div class="ai-game-card" data-game="snake">
              <div class="ai-game-icon">🐍</div>
              <div class="ai-game-name">Snake</div>
              <div class="ai-game-desc">Le classique</div>
            </div>
            <div class="ai-game-card" data-game="breakout">
              <div class="ai-game-icon">🧱</div>
              <div class="ai-game-name">Casse-Brique</div>
              <div class="ai-game-desc">Détruisez les briques</div>
            </div>
            <div class="ai-game-card" data-game="spaceshooter">
              <div class="ai-game-icon">🚀</div>
              <div class="ai-game-name">Space Shooter</div>
              <div class="ai-game-desc">Défendez la galaxie</div>
            </div>
          </div>

          <div class="ai-game-canvas-wrapper">
            <canvas class="ai-game-canvas" width="600" height="400"></canvas>
            <div class="ai-game-score">Score: 0</div>
            <div class="ai-game-controls"></div>
          </div>
        </div>

        <!-- Temps estimé -->
        <div class="ai-time-estimate">
          Temps restant estimé : <span class="ai-time-value">45s</span>
        </div>
      </div>
    `;
    
    // Le contenu a déjà été inséré dans resultsDiv
  }

  getStepIcon(stepId) {
    const icons = {
      geo: '📍',
      rdppf: '📋',
      reglements: '📚',
      synthesis: '🤖'
    };
    return icons[stepId] || '✓';
  }

  startProgress() {
    const interval = setInterval(() => {
      this.progressValue += 2;
      
      if (this.progressValue > 100) {
        this.progressValue = 100;
        clearInterval(interval);
        this.onComplete();
        return;
      }

      this.updateProgress();
      this.updateSteps();
      this.updateTimeRemaining();
    }, 900);
  }

  updateProgress() {
    // Mise à jour du cercle
    const circle = document.querySelector('.ai-progress-fill');
    const text = document.querySelector('.ai-progress-text');
    const bar = document.querySelector('.ai-progress-bar-fill');
    
    if (circle) {
      const offset = 314 - (314 * this.progressValue / 100);
      circle.style.strokeDashoffset = offset;
    }
    
    if (text) {
      text.textContent = `${Math.round(this.progressValue)}%`;
    }
    
    if (bar) {
      bar.style.width = `${this.progressValue}%`;
    }
  }

  updateSteps() {
    const stepProgress = this.progressValue / 25;
    const currentStep = Math.floor(stepProgress);
    
    if (currentStep !== this.currentStep) {
      this.currentStep = currentStep;
      
      document.querySelectorAll('.ai-step').forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i < currentStep) {
          step.classList.add('completed');
        } else if (i === currentStep && currentStep < 4) {
          step.classList.add('active');
        }
      });
    }
  }

  updateTimeRemaining() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const remaining = Math.max(0, this.estimatedTime - elapsed);
    const timeEl = document.querySelector('.ai-time-value');
    
    if (timeEl) {
      timeEl.textContent = `${Math.ceil(remaining)}s`;
    }
  }

  setupGameEvents() {
    document.addEventListener('click', (e) => {
      const gameCard = e.target.closest('.ai-game-card');
      if (gameCard) {
        const gameName = gameCard.dataset.game;
        this.activateGame(gameName);
      }
    });

    // Contrôles clavier pour les jeux
    document.addEventListener('keydown', (e) => {
      if (this.activeGame) {
        this.activeGame.handleKeyDown(e);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (this.activeGame) {
        this.activeGame.handleKeyUp(e);
      }
    });
  }

  activateGame(gameName) {
    // Désactiver le jeu précédent
    if (this.activeGame) {
      this.activeGame.stop();
    }

    // Activer le nouveau jeu
    document.querySelectorAll('.ai-game-card').forEach(card => {
      card.classList.remove('active');
    });
    document.querySelector(`[data-game="${gameName}"]`).classList.add('active');

    // Afficher le canvas
    const wrapper = document.querySelector('.ai-game-canvas-wrapper');
    wrapper.style.display = 'block';

    // Démarrer le jeu
    const canvas = document.querySelector('.ai-game-canvas');
    this.activeGame = this.games[gameName];
    this.activeGame.init(canvas);
    this.activeGame.start();

    // Afficher les contrôles
    const controls = document.querySelector('.ai-game-controls');
    controls.textContent = this.activeGame.getControls();
  }

  onComplete() {
    if (this.activeGame) {
      this.activeGame.stop();
    }
    // L'analyse est terminée
  }
}

// Classe de base pour les jeux
class BaseGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.score = 0;
    this.isRunning = false;
    this.animationId = null;
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.score = 0;
    this.updateScore();
  }

  start() {
    this.isRunning = true;
    this.gameLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  gameLoop() {
    if (!this.isRunning) return;
    
    this.update();
    this.draw();
    
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  updateScore() {
    const scoreEl = document.querySelector('.ai-game-score');
    if (scoreEl) {
      scoreEl.textContent = `Score: ${this.score}`;
    }
  }

  handleKeyDown(e) {}
  handleKeyUp(e) {}
  update() {}
  draw() {}
  getControls() { return ''; }
}

// Snake Game
class SnakeGame extends BaseGame {
  init(canvas) {
    super.init(canvas);
    this.gridSize = 20;
    this.tileCount = this.canvas.width / this.gridSize;
    this.snake = [{ x: 10, y: 10 }];
    this.direction = { x: 1, y: 0 };
    this.food = this.generateFood();
    this.frameCount = 0;
  }

  generateFood() {
    return {
      x: Math.floor(Math.random() * this.tileCount),
      y: Math.floor(Math.random() * this.tileCount)
    };
  }

  update() {
    this.frameCount++;
    if (this.frameCount % 5 !== 0) return; // Ralentir le jeu

    // Déplacer la tête
    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Vérifier les collisions avec les murs
    if (head.x < 0 || head.x >= this.tileCount || 
        head.y < 0 || head.y >= this.tileCount) {
      this.gameOver();
      return;
    }

    // Vérifier les collisions avec soi-même
    for (const segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.gameOver();
        return;
      }
    }

    this.snake.unshift(head);

    // Vérifier si on mange la nourriture
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.updateScore();
      this.food = this.generateFood();
    } else {
      this.snake.pop();
    }
  }

  draw() {
    // Fond
    this.ctx.fillStyle = '#111111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grille
    this.ctx.strokeStyle = '#222222';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.tileCount; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.gridSize, 0);
      this.ctx.lineTo(i * this.gridSize, this.canvas.height);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.gridSize);
      this.ctx.lineTo(this.canvas.width, i * this.gridSize);
      this.ctx.stroke();
    }

    // Serpent
    this.ctx.fillStyle = '#4ade80';
    this.snake.forEach((segment, index) => {
      this.ctx.fillRect(
        segment.x * this.gridSize + 2,
        segment.y * this.gridSize + 2,
        this.gridSize - 4,
        this.gridSize - 4
      );
    });

    // Nourriture
    this.ctx.fillStyle = '#ef4444';
    this.ctx.fillRect(
      this.food.x * this.gridSize + 2,
      this.food.y * this.gridSize + 2,
      this.gridSize - 4,
      this.gridSize - 4
    );
  }

  handleKeyDown(e) {
    switch(e.key) {
      case 'ArrowUp':
        if (this.direction.y === 0) {
          this.direction = { x: 0, y: -1 };
        }
        break;
      case 'ArrowDown':
        if (this.direction.y === 0) {
          this.direction = { x: 0, y: 1 };
        }
        break;
      case 'ArrowLeft':
        if (this.direction.x === 0) {
          this.direction = { x: -1, y: 0 };
        }
        break;
      case 'ArrowRight':
        if (this.direction.x === 0) {
          this.direction = { x: 1, y: 0 };
        }
        break;
    }
  }

  gameOver() {
    this.isRunning = false;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 32px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 40);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  getControls() {
    return 'Utilisez les flèches pour diriger le serpent';
  }
}

// Breakout Game
class BreakoutGame extends BaseGame {
  init(canvas) {
    super.init(canvas);
    
    // Paddle
    this.paddle = {
      x: this.canvas.width / 2 - 50,
      y: this.canvas.height - 30,
      width: 100,
      height: 10,
      speed: 8
    };
    
    // Ball
    this.ball = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      radius: 8,
      dx: 4,
      dy: -4
    };
    
    // Bricks
    this.bricks = [];
    this.brickRows = 5;
    this.brickCols = 8;
    this.brickWidth = 60;
    this.brickHeight = 20;
    this.brickPadding = 10;
    this.brickOffsetTop = 60;
    this.brickOffsetLeft = 35;
    
    for (let r = 0; r < this.brickRows; r++) {
      this.bricks[r] = [];
      for (let c = 0; c < this.brickCols; c++) {
        this.bricks[r][c] = { x: 0, y: 0, status: 1 };
      }
    }
    
    this.leftPressed = false;
    this.rightPressed = false;
  }

  update() {
    // Déplacer la raquette
    if (this.leftPressed && this.paddle.x > 0) {
      this.paddle.x -= this.paddle.speed;
    }
    if (this.rightPressed && this.paddle.x < this.canvas.width - this.paddle.width) {
      this.paddle.x += this.paddle.speed;
    }
    
    // Déplacer la balle
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
    
    // Rebonds sur les murs
    if (this.ball.x + this.ball.radius > this.canvas.width || 
        this.ball.x - this.ball.radius < 0) {
      this.ball.dx = -this.ball.dx;
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.dy = -this.ball.dy;
    }
    
    // Game over si la balle touche le bas
    if (this.ball.y + this.ball.radius > this.canvas.height) {
      this.gameOver();
      return;
    }
    
    // Collision avec la raquette
    if (this.ball.y + this.ball.radius > this.paddle.y &&
        this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height &&
        this.ball.x > this.paddle.x &&
        this.ball.x < this.paddle.x + this.paddle.width) {
      this.ball.dy = -this.ball.dy;
      
      // Ajuster l'angle selon où la balle touche la raquette
      const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
      this.ball.dx = 8 * (hitPos - 0.5);
    }
    
    // Collision avec les briques
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        const brick = this.bricks[r][c];
        if (brick.status === 1) {
          const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
          const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
          
          if (this.ball.x > brickX &&
              this.ball.x < brickX + this.brickWidth &&
              this.ball.y > brickY &&
              this.ball.y < brickY + this.brickHeight) {
            this.ball.dy = -this.ball.dy;
            brick.status = 0;
            this.score += 10;
            this.updateScore();
            
            // Vérifier la victoire
            if (this.checkWin()) {
              this.victory();
              return;
            }
          }
        }
      }
    }
  }

  draw() {
    // Fond
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Briques
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        if (this.bricks[r][c].status === 1) {
          const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
          const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
          
          // Couleur selon la ligne
          const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
          this.ctx.fillStyle = colors[r % colors.length];
          this.ctx.fillRect(brickX, brickY, this.brickWidth, this.brickHeight);
          
          // Effet 3D
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          this.ctx.fillRect(brickX, brickY, this.brickWidth, 2);
          this.ctx.fillRect(brickX, brickY, 2, this.brickHeight);
        }
      }
    }
    
    // Raquette
    this.ctx.fillStyle = '#5b63f5';
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    
    // Balle
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.closePath();
  }

  handleKeyDown(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = true;
    if (e.key === 'ArrowRight') this.rightPressed = true;
  }

  handleKeyUp(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = false;
    if (e.key === 'ArrowRight') this.rightPressed = false;
  }

  checkWin() {
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        if (this.bricks[r][c].status === 1) return false;
      }
    }
    return true;
  }

  victory() {
    this.isRunning = false;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#4ade80';
    this.ctx.font = 'bold 32px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Victoire!', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 40);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  gameOver() {
    this.isRunning = false;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 32px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 40);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  getControls() {
    return 'Utilisez ← → pour déplacer la raquette';
  }
}

// Space Shooter Game
class SpaceShooterGame extends BaseGame {
  init(canvas) {
    super.init(canvas);
    
    this.player = {
      x: this.canvas.width / 2,
      y: this.canvas.height - 50,
      width: 40,
      height: 40,
      speed: 6
    };
    
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    
    this.leftPressed = false;
    this.rightPressed = false;
    this.spacePressed = false;
    this.lastShot = 0;
    this.shotCooldown = 250;
    
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 60;
  }

  update() {
    // Déplacer le joueur
    if (this.leftPressed && this.player.x > this.player.width / 2) {
      this.player.x -= this.player.speed;
    }
    if (this.rightPressed && this.player.x < this.canvas.width - this.player.width / 2) {
      this.player.x += this.player.speed;
    }
    
    // Tirer
    if (this.spacePressed && Date.now() - this.lastShot > this.shotCooldown) {
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - 20,
        width: 4,
        height: 10,
        speed: 10
      });
      this.lastShot = Date.now();
    }
    
    // Mettre à jour les balles
    this.bullets = this.bullets.filter(bullet => {
      bullet.y -= bullet.speed;
      return bullet.y > -bullet.height;
    });
    
    // Spawn des ennemis
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.enemies.push({
        x: Math.random() * (this.canvas.width - 40) + 20,
        y: -40,
        width: 30,
        height: 30,
        speed: 2 + Math.random() * 2,
        type: Math.random() > 0.8 ? 'special' : 'normal'
      });
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = Math.max(30, this.enemySpawnInterval - 0.5);
    }
    
    // Mettre à jour les ennemis
    this.enemies = this.enemies.filter(enemy => {
      enemy.y += enemy.speed;
      
      // Collision avec le joueur
      if (this.checkCollision(enemy, this.player)) {
        this.gameOver();
        return false;
      }
      
      return enemy.y < this.canvas.height + enemy.height;
    });
    
    // Collisions balles/ennemis
    this.bullets.forEach((bullet, bulletIndex) => {
      this.enemies.forEach((enemy, enemyIndex) => {
        if (this.checkCollision(bullet, enemy)) {
          // Supprimer la balle et l'ennemi
          this.bullets.splice(bulletIndex, 1);
          this.enemies.splice(enemyIndex, 1);
          
          // Score
          this.score += enemy.type === 'special' ? 50 : 10;
          this.updateScore();
          
          // Particules d'explosion
          this.createExplosion(enemy.x, enemy.y);
        }
      });
    });
    
    // Mettre à jour les particules
    this.particles = this.particles.filter(particle => {
      particle.x += particle.dx;
      particle.y += particle.dy;
      particle.life--;
      return particle.life > 0;
    });
  }

  draw() {
    // Fond étoilé
    this.ctx.fillStyle = '#000814';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Étoiles
    for (let i = 0; i < 50; i++) {
      const x = (i * 73) % this.canvas.width;
      const y = (i * 37 + Date.now() * 0.02) % this.canvas.height;
      const size = (i % 3) + 1;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.fillRect(x, y, size, size);
    }
    
    // Particules
    this.particles.forEach(particle => {
      this.ctx.fillStyle = particle.color;
      this.ctx.globalAlpha = particle.life / 30;
      this.ctx.fillRect(particle.x, particle.y, 3, 3);
    });
    this.ctx.globalAlpha = 1;
    
    // Joueur (vaisseau)
    this.ctx.fillStyle = '#5b63f5';
    this.ctx.beginPath();
    this.ctx.moveTo(this.player.x, this.player.y - 20);
    this.ctx.lineTo(this.player.x - 15, this.player.y + 20);
    this.ctx.lineTo(this.player.x, this.player.y + 10);
    this.ctx.lineTo(this.player.x + 15, this.player.y + 20);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Cockpit
    this.ctx.fillStyle = '#8b5cf6';
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, 8, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Balles
    this.ctx.fillStyle = '#fbbf24';
    this.bullets.forEach(bullet => {
      this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
    });
    
    // Ennemis
    this.enemies.forEach(enemy => {
      this.ctx.fillStyle = enemy.type === 'special' ? '#ef4444' : '#10b981';
      this.ctx.fillRect(
        enemy.x - enemy.width/2, 
        enemy.y - enemy.height/2, 
        enemy.width, 
        enemy.height
      );
      
      // Détails
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(
        enemy.x - enemy.width/2 + 5, 
        enemy.y - enemy.height/2 + 5, 
        enemy.width - 10, 
        enemy.height - 10
      );
    });
  }

  checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width/2 &&
           obj1.x + obj1.width > obj2.x - obj2.width/2 &&
           obj1.y < obj2.y + obj2.height/2 &&
           obj1.y + obj1.height > obj2.y - obj2.height/2;
  }

  createExplosion(x, y) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: x,
        y: y,
        dx: (Math.random() - 0.5) * 8,
        dy: (Math.random() - 0.5) * 8,
        life: 30,
        color: ['#fbbf24', '#f97316', '#ef4444'][Math.floor(Math.random() * 3)]
      });
    }
  }

  handleKeyDown(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = true;
    if (e.key === 'ArrowRight') this.rightPressed = true;
    if (e.key === ' ') {
      e.preventDefault();
      this.spacePressed = true;
    }
  }

  handleKeyUp(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = false;
    if (e.key === 'ArrowRight') this.rightPressed = false;
    if (e.key === ' ') this.spacePressed = false;
  }

  gameOver() {
    this.isRunning = false;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 32px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 40);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  getControls() {
    return 'Utilisez ← → pour déplacer, Espace pour tirer';
  }
}

// Exposer la classe globalement
window.AILoaderEnhanced = AILoaderEnhanced;

// Initialiser automatiquement si l'élément existe
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.ai-analysis-loading')) {
    const loader = new AILoaderEnhanced();
    loader.init();
  }
});

// Log pour confirmer le chargement
console.log('✅ ai-loader-enhanced.js chargé - AILoaderEnhanced disponible');