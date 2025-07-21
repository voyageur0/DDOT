// AI Loader Enhanced avec Mini-Jeux Modernes et Novateurs
class AILoaderEnhanced {
  constructor() {
    this.progressValue = 0;
    this.activeGame = null;
    this.games = {
      snake: new ModernSnakeGame(),
      breakout: new ModernBreakoutGame(),
      spaceshooter: new ModernSpaceShooterGame()
    };
    this.steps = [
      { id: 'geo', title: 'Géolocalisation', desc: 'Recherche de la parcelle', icon: '📍' },
      { id: 'rdppf', title: 'Extraction RDPPF', desc: 'Analyse des données cadastrales', icon: '📋' },
      { id: 'reglements', title: 'Règlements communaux', desc: 'Analyse des contraintes locales', icon: '📚' },
      { id: 'synthesis', title: 'Synthèse IA', desc: 'Génération du rapport', icon: '🤖' }
    ];
    this.currentStep = 0;
    this.estimatedTime = 45;
    this.startTime = Date.now();
  }

  init() {
    this.render();
    this.startProgress();
    this.setupGameEvents();
    this.startBackgroundAnimation();
  }

  render() {
    let resultsDiv = document.getElementById('aiAnalysisResultsNew') || document.getElementById('aiAnalysisResults');
    if (!resultsDiv) {
      console.error('Impossible de trouver le div pour le loader');
      return;
    }
    
    resultsDiv.innerHTML = `
      <div class="ai-loader-main">
        <canvas class="ai-background-canvas" width="1200" height="600" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.3;"></canvas>
        
        <!-- Header avec progression circulaire -->
        <div class="ai-loader-header">
          <div class="ai-progress-container">
            <svg class="ai-progress-svg" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
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
            <p class="ai-loader-subtitle">Traitement avancé de votre parcelle avec intelligence artificielle</p>
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
              <div class="ai-step-icon">${step.icon}</div>
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
            <h3 class="ai-games-title">Détendez-vous pendant l'analyse</h3>
            <p class="ai-games-subtitle">Choisissez un jeu pour patienter</p>
          </div>
          
          <div class="ai-games-grid">
            <div class="ai-game-card" data-game="snake">
              <div class="ai-game-icon">🐍</div>
              <div class="ai-game-name">Cyber Snake</div>
              <div class="ai-game-desc">Version futuriste</div>
            </div>
            <div class="ai-game-card" data-game="breakout">
              <div class="ai-game-icon">💎</div>
              <div class="ai-game-name">Neon Breaker</div>
              <div class="ai-game-desc">Casse-brique néon</div>
            </div>
            <div class="ai-game-card" data-game="spaceshooter">
              <div class="ai-game-icon">🚀</div>
              <div class="ai-game-name">Galaxy Defender</div>
              <div class="ai-game-desc">Combat spatial</div>
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
          ⏱️ Temps restant estimé : <span class="ai-time-value">45s</span>
        </div>
      </div>
    `;
    
    // Charger le CSS moderne
    if (!document.querySelector('link[href*="ai-loader-enhanced-modern.css"]')) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = '/css/ai-loader-enhanced-modern.css';
      document.head.appendChild(cssLink);
    }
  }

  startBackgroundAnimation() {
    const canvas = document.querySelector('.ai-background-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const particles = [];
    
    // Créer des particules
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        color: ['#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 3)]
      });
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Connexions
        particles.forEach(p2 => {
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 100 && dist > 0) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color + '20';
            ctx.stroke();
          }
        });
      });
      
      if (this.progressValue < 100) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
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
    if (this.activeGame) {
      this.activeGame.stop();
    }

    document.querySelectorAll('.ai-game-card').forEach(card => {
      card.classList.remove('active');
    });
    document.querySelector(`[data-game="${gameName}"]`).classList.add('active');

    const wrapper = document.querySelector('.ai-game-canvas-wrapper');
    wrapper.style.display = 'block';

    const canvas = document.querySelector('.ai-game-canvas');
    this.activeGame = this.games[gameName];
    this.activeGame.init(canvas);
    this.activeGame.start();

    const controls = document.querySelector('.ai-game-controls');
    controls.textContent = this.activeGame.getControls();
  }

  onComplete() {
    if (this.activeGame) {
      this.activeGame.stop();
    }
  }
}

// Classe de base modernisée pour les jeux
class ModernBaseGame {
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

// Snake moderne avec effets néon
class ModernSnakeGame extends ModernBaseGame {
  init(canvas) {
    super.init(canvas);
    this.gridSize = 20;
    this.tileCount = this.canvas.width / this.gridSize;
    this.snake = [{ x: 10, y: 10 }];
    this.direction = { x: 1, y: 0 };
    this.food = this.generateFood();
    this.frameCount = 0;
    this.trail = [];
  }

  generateFood() {
    return {
      x: Math.floor(Math.random() * this.tileCount),
      y: Math.floor(Math.random() * this.tileCount)
    };
  }

  update() {
    this.frameCount++;
    if (this.frameCount % 5 !== 0) return;

    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Téléportation aux bords
    if (head.x < 0) head.x = this.tileCount - 1;
    if (head.x >= this.tileCount) head.x = 0;
    if (head.y < 0) head.y = this.tileCount - 1;
    if (head.y >= this.tileCount) head.y = 0;

    // Collision avec soi-même
    for (const segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.gameOver();
        return;
      }
    }

    this.snake.unshift(head);

    // Manger la nourriture
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.updateScore();
      this.food = this.generateFood();
      this.createFoodEffect(this.food.x * this.gridSize + this.gridSize/2, this.food.y * this.gridSize + this.gridSize/2);
    } else {
      this.snake.pop();
    }
  }

  createFoodEffect(x, y) {
    for (let i = 0; i < 10; i++) {
      this.trail.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 30,
        color: `hsl(${Math.random() * 60 + 120}, 100%, 50%)`
      });
    }
  }

  draw() {
    // Fond avec effet de grille néon
    this.ctx.fillStyle = '#000814';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grille néon
    this.ctx.strokeStyle = '#0a192f';
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

    // Particules
    this.trail = this.trail.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      
      if (p.life > 0) {
        this.ctx.globalAlpha = p.life / 30;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      
      return p.life > 0;
    });
    this.ctx.globalAlpha = 1;

    // Serpent avec dégradé néon
    this.snake.forEach((segment, index) => {
      const gradient = this.ctx.createRadialGradient(
        segment.x * this.gridSize + this.gridSize/2,
        segment.y * this.gridSize + this.gridSize/2,
        0,
        segment.x * this.gridSize + this.gridSize/2,
        segment.y * this.gridSize + this.gridSize/2,
        this.gridSize
      );
      
      const hue = (index * 10 + this.frameCount) % 360;
      gradient.addColorStop(0, `hsl(${hue}, 100%, 70%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 30%)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(
        segment.x * this.gridSize + 2,
        segment.y * this.gridSize + 2,
        this.gridSize - 4,
        this.gridSize - 4
      );
      
      // Effet de lueur
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
      this.ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        segment.x * this.gridSize + 2,
        segment.y * this.gridSize + 2,
        this.gridSize - 4,
        this.gridSize - 4
      );
      this.ctx.shadowBlur = 0;
    });

    // Nourriture avec animation
    const foodGradient = this.ctx.createRadialGradient(
      this.food.x * this.gridSize + this.gridSize/2,
      this.food.y * this.gridSize + this.gridSize/2,
      0,
      this.food.x * this.gridSize + this.gridSize/2,
      this.food.y * this.gridSize + this.gridSize/2,
      this.gridSize
    );
    
    const pulse = Math.sin(this.frameCount * 0.1) * 0.5 + 0.5;
    foodGradient.addColorStop(0, `rgba(255, 107, 107, ${0.5 + pulse * 0.5})`);
    foodGradient.addColorStop(1, 'rgba(255, 107, 107, 0.1)');
    
    this.ctx.fillStyle = foodGradient;
    this.ctx.beginPath();
    this.ctx.arc(
      this.food.x * this.gridSize + this.gridSize/2,
      this.food.y * this.gridSize + this.gridSize/2,
      this.gridSize/2 - 2,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    
    // Lueur de la nourriture
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#ff6b6b';
    this.ctx.strokeStyle = '#ff6b6b';
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
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
    
    // Effet de fondu
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Message de game over stylé
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.5, '#8b5cf6');
    gradient.addColorStop(1, '#ec4899');
    
    this.ctx.fillStyle = gradient;
    this.ctx.font = 'bold 48px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 50);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  getControls() {
    return '🎮 Utilisez les flèches directionnelles pour contrôler le serpent';
  }
}

// Breakout moderne avec effets de particules
class ModernBreakoutGame extends ModernBaseGame {
  init(canvas) {
    super.init(canvas);
    
    this.paddle = {
      x: this.canvas.width / 2 - 60,
      y: this.canvas.height - 30,
      width: 120,
      height: 15,
      speed: 8
    };
    
    this.ball = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      radius: 8,
      dx: 4,
      dy: -4,
      trail: []
    };
    
    this.bricks = [];
    this.particles = [];
    this.brickRows = 5;
    this.brickCols = 8;
    this.brickWidth = 65;
    this.brickHeight = 25;
    this.brickPadding = 5;
    this.brickOffsetTop = 60;
    this.brickOffsetLeft = 35;
    
    // Couleurs dégradées pour les briques
    this.brickColors = [
      { start: '#3b82f6', end: '#2563eb' },
      { start: '#8b5cf6', end: '#7c3aed' },
      { start: '#ec4899', end: '#db2777' },
      { start: '#f59e0b', end: '#d97706' },
      { start: '#10b981', end: '#059669' }
    ];
    
    for (let r = 0; r < this.brickRows; r++) {
      this.bricks[r] = [];
      for (let c = 0; c < this.brickCols; c++) {
        this.bricks[r][c] = { 
          x: 0, 
          y: 0, 
          status: 1,
          color: this.brickColors[r % this.brickColors.length]
        };
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
    
    // Trail de la balle
    this.ball.trail.push({ x: this.ball.x, y: this.ball.y, life: 10 });
    this.ball.trail = this.ball.trail.filter(t => {
      t.life--;
      return t.life > 0;
    });
    
    // Déplacer la balle
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
    
    // Rebonds sur les murs
    if (this.ball.x + this.ball.radius > this.canvas.width || 
        this.ball.x - this.ball.radius < 0) {
      this.ball.dx = -this.ball.dx;
      this.createWallHitEffect(this.ball.x, this.ball.y);
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.dy = -this.ball.dy;
      this.createWallHitEffect(this.ball.x, this.ball.y);
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
      
      // Effet de collision
      this.createPaddleHitEffect(this.ball.x, this.paddle.y);
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
            
            // Explosion de particules
            this.createBrickExplosion(brickX + this.brickWidth/2, brickY + this.brickHeight/2, brick.color);
            
            // Vérifier la victoire
            if (this.checkWin()) {
              this.victory();
              return;
            }
          }
        }
      }
    }
    
    // Mettre à jour les particules
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3; // Gravité
      p.life--;
      return p.life > 0;
    });
  }

  createWallHitEffect(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 20,
        color: '#ffffff',
        size: Math.random() * 3 + 1
      });
    }
  }

  createPaddleHitEffect(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 5,
        life: 25,
        color: '#3b82f6',
        size: Math.random() * 4 + 2
      });
    }
  }

  createBrickExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 30,
        color: color.start,
        size: Math.random() * 5 + 2
      });
    }
  }

  draw() {
    // Fond avec dégradé
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#1e293b');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Particules
    this.particles.forEach(p => {
      this.ctx.globalAlpha = p.life / 30;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;
    
    // Briques avec effets
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        if (this.bricks[r][c].status === 1) {
          const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
          const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
          
          // Dégradé pour chaque brique
          const gradient = this.ctx.createLinearGradient(brickX, brickY, brickX + this.brickWidth, brickY + this.brickHeight);
          gradient.addColorStop(0, this.bricks[r][c].color.start);
          gradient.addColorStop(1, this.bricks[r][c].color.end);
          
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(brickX, brickY, this.brickWidth, this.brickHeight);
          
          // Bordure brillante
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(brickX, brickY, this.brickWidth, this.brickHeight);
          
          // Reflet
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          this.ctx.fillRect(brickX, brickY, this.brickWidth, 5);
        }
      }
    }
    
    // Raquette avec dégradé et lueur
    const paddleGradient = this.ctx.createLinearGradient(this.paddle.x, this.paddle.y, this.paddle.x, this.paddle.y + this.paddle.height);
    paddleGradient.addColorStop(0, '#3b82f6');
    paddleGradient.addColorStop(1, '#2563eb');
    
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#3b82f6';
    this.ctx.fillStyle = paddleGradient;
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    this.ctx.shadowBlur = 0;
    
    // Trail de la balle
    this.ball.trail.forEach((t, i) => {
      this.ctx.globalAlpha = t.life / 10 * 0.5;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, this.ball.radius * (t.life / 10), 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;
    
    // Balle avec lueur
    const ballGradient = this.ctx.createRadialGradient(this.ball.x, this.ball.y, 0, this.ball.x, this.ball.y, this.ball.radius);
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(1, '#e0e7ff');
    
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = ballGradient;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
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
    
    // Fond de victoire
    const gradient = this.ctx.createRadialGradient(this.canvas.width/2, this.canvas.height/2, 0, this.canvas.width/2, this.canvas.height/2, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#10b981';
    this.ctx.font = 'bold 48px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VICTOIRE!', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 50);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  gameOver() {
    this.isRunning = false;
    
    const gradient = this.ctx.createRadialGradient(this.canvas.width/2, this.canvas.height/2, 0, this.canvas.width/2, this.canvas.height/2, 300);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 48px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px system-ui';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 50);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  getControls() {
    return '🎮 Utilisez ← → pour déplacer la raquette';
  }
}

// Space Shooter moderne avec effets visuels avancés
class ModernSpaceShooterGame extends ModernBaseGame {
  init(canvas) {
    super.init(canvas);
    
    this.player = {
      x: this.canvas.width / 2,
      y: this.canvas.height - 60,
      width: 50,
      height: 50,
      speed: 6
    };
    
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.stars = [];
    this.powerUps = [];
    
    this.leftPressed = false;
    this.rightPressed = false;
    this.spacePressed = false;
    this.lastShot = 0;
    this.shotCooldown = 200;
    
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 60;
    
    // Créer le fond étoilé
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 0.5
      });
    }
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
        height: 15,
        speed: 12,
        trail: []
      });
      this.lastShot = Date.now();
      this.createMuzzleFlash(this.player.x, this.player.y - 20);
    }
    
    // Mettre à jour les étoiles
    this.stars.forEach(star => {
      star.y += star.speed;
      if (star.y > this.canvas.height) {
        star.y = -10;
        star.x = Math.random() * this.canvas.width;
      }
    });
    
    // Mettre à jour les balles
    this.bullets = this.bullets.filter(bullet => {
      bullet.y -= bullet.speed;
      bullet.trail.push({ x: bullet.x, y: bullet.y, life: 10 });
      bullet.trail = bullet.trail.filter(t => {
        t.life--;
        return t.life > 0;
      });
      return bullet.y > -bullet.height;
    });
    
    // Spawn des ennemis
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      const enemyType = Math.random() > 0.7 ? 'elite' : 'normal';
      this.enemies.push({
        x: Math.random() * (this.canvas.width - 40) + 20,
        y: -40,
        width: enemyType === 'elite' ? 40 : 30,
        height: enemyType === 'elite' ? 40 : 30,
        speed: enemyType === 'elite' ? 1.5 : 2 + Math.random() * 2,
        type: enemyType,
        hp: enemyType === 'elite' ? 3 : 1,
        angle: 0
      });
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = Math.max(30, this.enemySpawnInterval - 0.5);
    }
    
    // Mettre à jour les ennemis
    this.enemies = this.enemies.filter(enemy => {
      enemy.y += enemy.speed;
      enemy.angle += 0.05;
      
      // Pattern de mouvement pour les élites
      if (enemy.type === 'elite') {
        enemy.x += Math.sin(enemy.angle) * 2;
      }
      
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
          this.bullets.splice(bulletIndex, 1);
          enemy.hp--;
          
          if (enemy.hp <= 0) {
            this.enemies.splice(enemyIndex, 1);
            this.score += enemy.type === 'elite' ? 50 : 10;
            this.updateScore();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
            
            // Chance de drop de power-up
            if (Math.random() < 0.2) {
              this.powerUps.push({
                x: enemy.x,
                y: enemy.y,
                type: 'rapid',
                speed: 1
              });
            }
          } else {
            this.createHitEffect(enemy.x, enemy.y);
          }
        }
      });
    });
    
    // Mettre à jour les power-ups
    this.powerUps = this.powerUps.filter(powerUp => {
      powerUp.y += powerUp.speed;
      
      if (this.checkCollision(powerUp, this.player)) {
        if (powerUp.type === 'rapid') {
          this.shotCooldown = 100;
          setTimeout(() => this.shotCooldown = 200, 5000);
        }
        return false;
      }
      
      return powerUp.y < this.canvas.height;
    });
    
    // Mettre à jour les particules
    this.particles = this.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      particle.size *= 0.98;
      return particle.life > 0;
    });
  }

  createMuzzleFlash(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3,
        life: 10,
        color: '#fbbf24',
        size: 3
      });
    }
  }

  createHitEffect(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 15,
        color: '#f59e0b',
        size: 4
      });
    }
  }

  createExplosion(x, y, type) {
    const particleCount = type === 'elite' ? 30 : 20;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 30,
        color: ['#ef4444', '#f59e0b', '#fbbf24'][Math.floor(Math.random() * 3)],
        size: Math.random() * 6 + 2
      });
    }
  }

  draw() {
    // Fond spatial
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#000814');
    gradient.addColorStop(0.5, '#001d3d');
    gradient.addColorStop(1, '#003566');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Étoiles
    this.stars.forEach(star => {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + star.size / 4})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    
    // Particules
    this.particles.forEach(particle => {
      this.ctx.globalAlpha = particle.life / 30;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;
    
    // Joueur (vaisseau)
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    
    // Corps du vaisseau
    const shipGradient = this.ctx.createLinearGradient(-20, -20, 20, 20);
    shipGradient.addColorStop(0, '#3b82f6');
    shipGradient.addColorStop(1, '#1e40af');
    
    this.ctx.fillStyle = shipGradient;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -25);
    this.ctx.lineTo(-20, 20);
    this.ctx.lineTo(0, 10);
    this.ctx.lineTo(20, 20);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Cockpit
    this.ctx.fillStyle = '#60a5fa';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Effet de propulsion
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.globalAlpha = 0.8 + Math.random() * 0.2;
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 15);
    this.ctx.lineTo(0, 25 + Math.random() * 10);
    this.ctx.lineTo(10, 15);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
    
    this.ctx.restore();
    
    // Balles avec trail
    this.bullets.forEach(bullet => {
      // Trail
      bullet.trail.forEach((t, i) => {
        this.ctx.globalAlpha = t.life / 10;
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(t.x - 2, t.y, 4, 8);
      });
      this.ctx.globalAlpha = 1;
      
      // Balle
      const bulletGradient = this.ctx.createLinearGradient(bullet.x - 2, bullet.y, bullet.x + 2, bullet.y + bullet.height);
      bulletGradient.addColorStop(0, '#fbbf24');
      bulletGradient.addColorStop(1, '#f59e0b');
      
      this.ctx.fillStyle = bulletGradient;
      this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
      
      // Lueur
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#fbbf24';
      this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
      this.ctx.shadowBlur = 0;
    });
    
    // Ennemis
    this.enemies.forEach(enemy => {
      this.ctx.save();
      this.ctx.translate(enemy.x, enemy.y);
      this.ctx.rotate(enemy.angle);
      
      if (enemy.type === 'elite') {
        // Ennemi élite
        const eliteGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.width/2);
        eliteGradient.addColorStop(0, '#ef4444');
        eliteGradient.addColorStop(1, '#7f1d1d');
        
        this.ctx.fillStyle = eliteGradient;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 / 6) * i;
          const x = Math.cos(angle) * enemy.width/2;
          const y = Math.sin(angle) * enemy.height/2;
          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.closePath();
        this.ctx.fill();
        
        // Bouclier
        if (enemy.hp > 1) {
          this.ctx.strokeStyle = `rgba(239, 68, 68, ${enemy.hp / 3})`;
          this.ctx.lineWidth = 3;
          this.ctx.stroke();
        }
      } else {
        // Ennemi normal
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.width/2);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#064e3b');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(-enemy.width/2, -enemy.height/2, enemy.width, enemy.height);
        
        // Détails
        this.ctx.fillStyle = '#059669';
        this.ctx.fillRect(-enemy.width/4, -enemy.height/4, enemy.width/2, enemy.height/2);
      }
      
      this.ctx.restore();
    });
    
    // Power-ups
    this.powerUps.forEach(powerUp => {
      const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
      
      this.ctx.save();
      this.ctx.translate(powerUp.x, powerUp.y);
      this.ctx.rotate(Date.now() * 0.002);
      
      // Aura
      this.ctx.globalAlpha = 0.5 + pulse * 0.3;
      this.ctx.fillStyle = '#8b5cf6';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Core
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = '#e9d5ff';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Symbole
      this.ctx.fillStyle = '#8b5cf6';
      this.ctx.font = 'bold 16px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('⚡', 0, 0);
      
      this.ctx.restore();
    });
  }

  checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width/2 &&
           obj1.x + obj1.width > obj2.x - obj2.width/2 &&
           obj1.y < obj2.y + obj2.height/2 &&
           obj1.y + obj1.height > obj2.y - obj2.height/2;
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
    
    // Effet d'explosion finale
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 40,
        color: ['#ef4444', '#f59e0b', '#fbbf24', '#3b82f6'][Math.floor(Math.random() * 4)],
        size: Math.random() * 8 + 2
      });
    }
    
    // Animation des particules
    const animateGameOver = () => {
      this.draw();
      
      this.particles = this.particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        particle.size *= 0.96;
        return particle.life > 0;
      });
      
      if (this.particles.length > 0) {
        requestAnimationFrame(animateGameOver);
      } else {
        // Message de game over
        const gradient = this.ctx.createRadialGradient(this.canvas.width/2, this.canvas.height/2, 0, this.canvas.width/2, this.canvas.height/2, 300);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.font = 'bold 48px system-ui';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px system-ui';
        this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 50);
        
        this.canvas.addEventListener('click', () => {
          this.init(this.canvas);
          this.start();
        }, { once: true });
      }
    };
    
    animateGameOver();
  }

  getControls() {
    return '🎮 ← → pour déplacer, Espace pour tirer | ⚡ Power-ups disponibles!';
  }
}

// Exposer la classe globalement
window.AILoaderEnhanced = AILoaderEnhanced;

console.log('✅ ai-loader-enhanced-modern.js chargé - AILoaderEnhanced disponible');