// Jeux Ultra-Modernes avec UI/UX et fonctionnalités améliorées

// Classe de base améliorée
class UltraModernBaseGame {
  constructor() {
    this.score = 0;
    this.highScore = 0;
    this.combo = 0;
    this.multiplier = 1;
    this.powerUps = [];
    this.particles = [];
    this.shakeAmount = 0;
    this.isPaused = false;
    this.soundEnabled = true;
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isRunning = false;
    this.score = 0;
    this.combo = 0;
    this.multiplier = 1;
    
    // Récupérer le high score
    this.highScore = parseInt(localStorage.getItem(`highScore_${this.constructor.name}`) || '0');
    
    // Effets de post-processing
    this.bloom = {
      intensity: 1,
      canvas: document.createElement('canvas'),
      ctx: null
    };
    this.bloom.canvas.width = canvas.width;
    this.bloom.canvas.height = canvas.height;
    this.bloom.ctx = this.bloom.canvas.getContext('2d');
  }

  updateScore(points = 10) {
    this.combo++;
    this.multiplier = Math.min(Math.floor(this.combo / 5) + 1, 10);
    this.score += points * this.multiplier;
    
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(`highScore_${this.constructor.name}`, this.highScore.toString());
    }
  }

  shake(amount = 5) {
    this.shakeAmount = amount;
  }

  createExplosion(x, y, color = '#ffffff', count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = Math.random() * 5 + 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60,
        color,
        size: Math.random() * 4 + 2,
        type: 'explosion'
      });
    }
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      
      // Gravité pour certaines particules
      if (p.type === 'explosion') {
        p.vy += 0.2;
        p.vx *= 0.98;
      }
      
      return p.life > 0;
    });
  }

  drawParticles() {
    this.particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      this.ctx.globalAlpha = alpha;
      
      // Lueur
      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(1, 'transparent');
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
      
      // Particule centrale
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    });
    this.ctx.globalAlpha = 1;
  }

  applyPostProcessing() {
    if (this.shakeAmount > 0) {
      this.ctx.save();
      this.ctx.translate(
        (Math.random() - 0.5) * this.shakeAmount,
        (Math.random() - 0.5) * this.shakeAmount
      );
      this.shakeAmount *= 0.9;
    }
  }

  drawUI() {
    // Score avec effet néon
    const scoreGradient = this.ctx.createLinearGradient(20, 20, 200, 20);
    scoreGradient.addColorStop(0, '#3b82f6');
    scoreGradient.addColorStop(1, '#8b5cf6');
    
    this.ctx.fillStyle = scoreGradient;
    this.ctx.font = 'bold 24px "Orbitron", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // High Score
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.font = '16px "Orbitron", monospace';
    this.ctx.fillText(`Best: ${this.highScore}`, 20, 65);
    
    // Multiplier
    if (this.multiplier > 1) {
      this.ctx.fillStyle = '#10b981';
      this.ctx.font = 'bold 20px "Orbitron", monospace';
      this.ctx.fillText(`×${this.multiplier}`, 20, 90);
    }
    
    // Combo
    if (this.combo > 5) {
      const comboX = this.canvas.width - 100;
      this.ctx.textAlign = 'right';
      
      // Animation du combo
      const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 1;
      this.ctx.save();
      this.ctx.translate(comboX, 40);
      this.ctx.scale(pulse, pulse);
      
      this.ctx.fillStyle = '#ec4899';
      this.ctx.font = 'bold 28px "Orbitron", monospace';
      this.ctx.fillText(`${this.combo}!`, 0, 0);
      this.ctx.restore();
    }
  }
}

// Snake Ultra-Moderne
class UltraModernSnakeGame extends UltraModernBaseGame {
  init(canvas) {
    super.init(canvas);
    this.gridSize = 20;
    this.tileCount = Math.floor(this.canvas.width / this.gridSize);
    this.snake = [{ x: 10, y: 10 }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.food = this.generateFood();
    this.specialFood = null;
    this.frameCount = 0;
    this.speed = 5;
    this.ghostMode = false;
    this.speedBoost = false;
    
    // Power-ups
    this.powerUpTypes = [
      { type: 'ghost', color: '#a855f7', duration: 300, chance: 0.1 },
      { type: 'speed', color: '#3b82f6', duration: 200, chance: 0.15 },
      { type: 'points', color: '#fbbf24', instant: true, chance: 0.2 }
    ];
    
    // Effet de trail amélioré
    this.snakeTrail = [];
  }

  generateFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * this.tileCount),
        y: Math.floor(Math.random() * this.tileCount)
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    
    return pos;
  }

  generateSpecialFood() {
    if (Math.random() < 0.02 && !this.specialFood) {
      const type = this.powerUpTypes[Math.floor(Math.random() * this.powerUpTypes.length)];
      this.specialFood = {
        ...this.generateFood(),
        ...type,
        timer: 150
      };
    }
  }

  update() {
    if (this.isPaused) return;
    
    this.frameCount++;
    const moveSpeed = this.speedBoost ? 3 : this.speed;
    
    if (this.frameCount % moveSpeed !== 0) return;

    // Appliquer la prochaine direction
    this.direction = { ...this.nextDirection };

    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Téléportation aux bords
    if (head.x < 0) head.x = this.tileCount - 1;
    if (head.x >= this.tileCount) head.x = 0;
    if (head.y < 0) head.y = this.tileCount - 1;
    if (head.y >= this.tileCount) head.y = 0;

    // Collision avec soi-même (sauf en mode ghost)
    if (!this.ghostMode) {
      for (let i = 1; i < this.snake.length; i++) {
        if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
          this.gameOver();
          return;
        }
      }
    }

    // Ajouter au trail
    this.snakeTrail.push({
      x: head.x * this.gridSize + this.gridSize/2,
      y: head.y * this.gridSize + this.gridSize/2,
      life: 20
    });

    this.snake.unshift(head);

    // Manger la nourriture normale
    if (head.x === this.food.x && head.y === this.food.y) {
      this.eatFood();
    } else {
      this.snake.pop();
    }
    
    // Manger la nourriture spéciale
    if (this.specialFood && head.x === this.specialFood.x && head.y === this.specialFood.y) {
      this.eatSpecialFood();
    }
    
    // Générer nourriture spéciale
    this.generateSpecialFood();
    
    // Mise à jour du trail
    this.snakeTrail = this.snakeTrail.filter(t => {
      t.life--;
      return t.life > 0;
    });
    
    // Mise à jour power-ups
    this.updatePowerUps();
  }

  eatFood() {
    this.updateScore(10);
    this.food = this.generateFood();
    this.createExplosion(
      this.food.x * this.gridSize + this.gridSize/2,
      this.food.y * this.gridSize + this.gridSize/2,
      '#10b981'
    );
    this.shake(3);
    
    // Augmenter la vitesse progressivement
    if (this.snake.length % 5 === 0 && this.speed > 2) {
      this.speed--;
    }
  }

  eatSpecialFood() {
    const food = this.specialFood;
    
    if (food.instant) {
      this.updateScore(50);
      this.createExplosion(
        food.x * this.gridSize + this.gridSize/2,
        food.y * this.gridSize + this.gridSize/2,
        food.color,
        50
      );
    } else {
      this.powerUps.push({
        type: food.type,
        duration: food.duration,
        color: food.color
      });
      
      if (food.type === 'ghost') {
        this.ghostMode = true;
      } else if (food.type === 'speed') {
        this.speedBoost = true;
      }
    }
    
    this.shake(5);
    this.specialFood = null;
  }

  updatePowerUps() {
    this.powerUps = this.powerUps.filter(p => {
      p.duration--;
      
      if (p.duration <= 0) {
        if (p.type === 'ghost') this.ghostMode = false;
        if (p.type === 'speed') this.speedBoost = false;
        return false;
      }
      
      return true;
    });
  }

  draw() {
    // Fond avec effet de profondeur
    const bgGradient = this.ctx.createRadialGradient(
      this.canvas.width/2, this.canvas.height/2, 0,
      this.canvas.width/2, this.canvas.height/2, this.canvas.width
    );
    bgGradient.addColorStop(0, '#0a0e27');
    bgGradient.addColorStop(1, '#000814');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grille animée
    this.drawAnimatedGrid();
    
    // Trail du serpent
    this.snakeTrail.forEach(t => {
      const alpha = t.life / 20;
      this.ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.3})`;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, this.gridSize * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Nourriture normale avec animation
    const foodPulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;
    this.ctx.save();
    this.ctx.translate(
      this.food.x * this.gridSize + this.gridSize/2,
      this.food.y * this.gridSize + this.gridSize/2
    );
    this.ctx.scale(foodPulse, foodPulse);
    
    // Lueur de la nourriture
    const foodGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.gridSize);
    foodGlow.addColorStop(0, '#10b981');
    foodGlow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = foodGlow;
    this.ctx.fillRect(-this.gridSize, -this.gridSize, this.gridSize * 2, this.gridSize * 2);
    
    this.ctx.fillStyle = '#10b981';
    this.ctx.fillRect(-this.gridSize/3, -this.gridSize/3, this.gridSize/1.5, this.gridSize/1.5);
    this.ctx.restore();
    
    // Nourriture spéciale
    if (this.specialFood) {
      this.specialFood.timer--;
      if (this.specialFood.timer <= 0) {
        this.specialFood = null;
      } else {
        const specialPulse = Math.sin(Date.now() * 0.01) * 0.3 + 1;
        this.ctx.save();
        this.ctx.translate(
          this.specialFood.x * this.gridSize + this.gridSize/2,
          this.specialFood.y * this.gridSize + this.gridSize/2
        );
        this.ctx.scale(specialPulse, specialPulse);
        this.ctx.rotate(Date.now() * 0.002);
        
        // Étoile pour power-up
        this.ctx.fillStyle = this.specialFood.color;
        this.drawStar(0, 0, 5, this.gridSize/2, this.gridSize/4);
        this.ctx.restore();
      }
    }

    // Serpent avec effets
    this.snake.forEach((segment, index) => {
      const x = segment.x * this.gridSize;
      const y = segment.y * this.gridSize;
      
      // Couleur dégradée selon la position
      const hue = 200 + (index / this.snake.length) * 60;
      const lightness = this.ghostMode ? 70 : 50;
      const alpha = this.ghostMode ? 0.6 : 1;
      
      // Bordure brillante
      this.ctx.fillStyle = `hsla(${hue}, 100%, ${lightness + 20}%, ${alpha})`;
      this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
      
      // Centre
      this.ctx.fillStyle = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
      this.ctx.fillRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
      
      // Yeux pour la tête
      if (index === 0) {
        this.ctx.fillStyle = '#ffffff';
        const eyeSize = 3;
        if (this.direction.x !== 0) {
          this.ctx.fillRect(x + this.gridSize/2 - eyeSize/2, y + 5, eyeSize, eyeSize);
          this.ctx.fillRect(x + this.gridSize/2 - eyeSize/2, y + this.gridSize - 8, eyeSize, eyeSize);
        } else {
          this.ctx.fillRect(x + 5, y + this.gridSize/2 - eyeSize/2, eyeSize, eyeSize);
          this.ctx.fillRect(x + this.gridSize - 8, y + this.gridSize/2 - eyeSize/2, eyeSize, eyeSize);
        }
      }
    });

    // Particules
    this.updateParticles();
    this.drawParticles();
    
    // UI
    this.drawUI();
    this.drawPowerUpIndicators();
    
    // Post-processing
    this.applyPostProcessing();
  }

  drawAnimatedGrid() {
    const time = Date.now() * 0.001;
    this.ctx.strokeStyle = 'rgba(10, 25, 47, 0.5)';
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i <= this.tileCount; i++) {
      // Lignes verticales avec ondulation
      this.ctx.beginPath();
      for (let j = 0; j <= this.tileCount; j++) {
        const offset = Math.sin(time + j * 0.1) * 2;
        if (j === 0) {
          this.ctx.moveTo(i * this.gridSize + offset, j * this.gridSize);
        } else {
          this.ctx.lineTo(i * this.gridSize + offset, j * this.gridSize);
        }
      }
      this.ctx.stroke();
      
      // Lignes horizontales avec ondulation
      this.ctx.beginPath();
      for (let j = 0; j <= this.tileCount; j++) {
        const offset = Math.cos(time + j * 0.1) * 2;
        if (j === 0) {
          this.ctx.moveTo(j * this.gridSize, i * this.gridSize + offset);
        } else {
          this.ctx.lineTo(j * this.gridSize, i * this.gridSize + offset);
        }
      }
      this.ctx.stroke();
    }
  }

  drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    
    this.ctx.lineTo(cx, cy - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawPowerUpIndicators() {
    let y = 120;
    this.powerUps.forEach(p => {
      const width = 150;
      const height = 20;
      const x = 20;
      
      // Fond
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(x, y, width, height);
      
      // Barre de progression
      const progress = p.duration / (p.type === 'ghost' ? 300 : 200);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(x, y, width * progress, height);
      
      // Texte
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '12px "Orbitron", monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(p.type.toUpperCase(), x + 5, y + 14);
      
      y += 25;
    });
  }

  handleKeyDown(e) {
    // Empêcher les demi-tours
    if (e.key === 'ArrowLeft' && this.direction.x === 0) {
      this.nextDirection = { x: -1, y: 0 };
    } else if (e.key === 'ArrowRight' && this.direction.x === 0) {
      this.nextDirection = { x: 1, y: 0 };
    } else if (e.key === 'ArrowUp' && this.direction.y === 0) {
      this.nextDirection = { x: 0, y: -1 };
    } else if (e.key === 'ArrowDown' && this.direction.y === 0) {
      this.nextDirection = { x: 0, y: 1 };
    } else if (e.key === ' ') {
      this.isPaused = !this.isPaused;
    }
  }

  gameOver() {
    this.isRunning = false;
    this.combo = 0;
    
    // Effet d'explosion pour chaque segment
    this.snake.forEach((segment, i) => {
      setTimeout(() => {
        this.createExplosion(
          segment.x * this.gridSize + this.gridSize/2,
          segment.y * this.gridSize + this.gridSize/2,
          '#ef4444'
        );
      }, i * 50);
    });
    
    setTimeout(() => {
      this.drawGameOverScreen();
    }, this.snake.length * 50 + 500);
  }

  drawGameOverScreen() {
    // Fond semi-transparent
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Game Over
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 48px "Orbitron", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
    
    // Score final
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px "Orbitron", monospace';
    this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
    
    // High Score
    if (this.score === this.highScore) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fillText('NEW HIGH SCORE!', this.canvas.width / 2, this.canvas.height / 2 + 35);
    }
    
    // Instructions
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Orbitron", monospace';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 80);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }
}

// Breakout Ultra-Moderne
class UltraModernBreakoutGame extends UltraModernBaseGame {
  init(canvas) {
    super.init(canvas);
    
    // Configuration améliorée
    this.paddle = {
      x: canvas.width / 2 - 50,
      y: canvas.height - 30,
      width: 100,
      height: 15,
      speed: 3,  // Réduit à 3 pour un contrôle encore plus précis
      targetX: canvas.width / 2 - 50
    };
    
    this.ball = {
      x: canvas.width / 2,
      y: canvas.height - 50,
      dx: 1,    // Réduit à 1 pour un jeu très lent
      dy: -1,   // Réduit à -1 pour un jeu très lent
      radius: 12,  // Augmenté à 12 pour encore meilleure visibilité
      speed: 1,    // Réduit à 1 pour un jeu vraiment accessible
      trail: [],
      stuck: true
    };
    
    // Briques améliorées avec meilleur espacement
    this.brickRows = 5;    // Réduit de 6 à 5 pour moins de difficulté
    this.brickCols = 8;    // Réduit de 10 à 8 pour un jeu plus aéré
    this.brickWidth = 65;  // Augmenté de 55 à 65 pour des briques plus grandes
    this.brickHeight = 25; // Augmenté de 20 à 25 pour meilleure visibilité
    this.brickPadding = 8; // Augmenté de 5 à 8 pour plus d'espace
    this.brickOffsetTop = 80;  // Augmenté de 60 à 80 pour plus d'espace en haut
    this.brickOffsetLeft = 40; // Ajusté pour centrer
    
    // Types de briques avec couleurs plus vibrantes et gradients
    this.brickTypes = [
      { health: 1, color: '#60a5fa', gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)', points: 10, powerUpChance: 0.15 },
      { health: 2, color: '#a78bfa', gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)', points: 20, powerUpChance: 0.20 },
      { health: 3, color: '#f472b6', gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)', points: 30, powerUpChance: 0.25 },
      { health: -1, color: '#9ca3af', gradient: 'linear-gradient(135deg, #e5e7eb 0%, #6b7280 100%)', points: 50, powerUpChance: 0 } // Indestructible
    ];
    
    this.bricks = [];
    this.initBricks();
    
    // Power-ups
    this.activePowerUps = [];
    this.fallingPowerUps = [];
    this.powerUpTypes = [
      { type: 'expand', icon: '🔷', color: '#3b82f6', duration: 800 },  // Augmenté de 500 à 800
      { type: 'multi', icon: '⚡', color: '#fbbf24', instant: true },
      { type: 'slow', icon: '🐌', color: '#10b981', duration: 600 },   // Augmenté de 300 à 600
      { type: 'laser', icon: '🔫', color: '#ef4444', duration: 700 },  // Augmenté de 400 à 700
      { type: 'magnet', icon: '🧲', color: '#8b5cf6', duration: 600 }  // Augmenté de 350 à 600
    ];
    
    // Effets
    this.lasers = [];
    this.magnetActive = false;
    
    // Contrôles
    this.leftPressed = false;
    this.rightPressed = false;
    this.mouseX = canvas.width / 2;
  }

  initBricks() {
    for (let r = 0; r < this.brickRows; r++) {
      this.bricks[r] = [];
      for (let c = 0; c < this.brickCols; c++) {
        // Pattern de difficulté
        let typeIndex = 0;
        if (r < 2) typeIndex = 2; // Lignes difficiles en haut
        else if (r < 4) typeIndex = 1;
        else typeIndex = 0;
        
        // Quelques briques indestructibles (moins fréquentes)
        if (Math.random() < 0.02 && r < 2) typeIndex = 3;  // Réduit de 0.05 à 0.02
        
        const type = this.brickTypes[typeIndex];
        this.bricks[r][c] = {
          x: c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft,
          y: r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop,
          ...type,
          currentHealth: type.health,
          hit: false
        };
      }
    }
  }

  update() {
    if (this.isPaused) return;
    
    // Mise à jour paddle (smooth)
    if (this.leftPressed) this.paddle.targetX -= this.paddle.speed;
    if (this.rightPressed) this.paddle.targetX += this.paddle.speed;
    
    // Suivre la souris
    if (Math.abs(this.mouseX - this.paddle.x - this.paddle.width/2) > 5) {
      this.paddle.targetX = this.mouseX - this.paddle.width/2;
    }
    
    // Limites paddle
    this.paddle.targetX = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.targetX));
    
    // Mouvement smooth encore plus lent
    this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.1;  // Réduit à 0.1 pour plus de précision
    
    // Balle collée à la raquette
    if (this.ball.stuck) {
      this.ball.x = this.paddle.x + this.paddle.width / 2;
      return;
    }
    
    // Mise à jour balle avec vitesse encore plus lente
    const speed = this.activePowerUps.some(p => p.type === 'slow') ? this.ball.speed * 0.3 : this.ball.speed;
    this.ball.x += this.ball.dx * speed;
    this.ball.y += this.ball.dy * speed;
    
    // Trail de la balle
    this.ball.trail.push({
      x: this.ball.x,
      y: this.ball.y,
      life: 15
    });
    this.ball.trail = this.ball.trail.filter(t => {
      t.life--;
      return t.life > 0;
    });
    
    // Collision murs
    if (this.ball.x + this.ball.radius > this.canvas.width || this.ball.x - this.ball.radius < 0) {
      this.ball.dx = -this.ball.dx;
      this.createExplosion(this.ball.x, this.ball.y, '#3b82f6', 10);
    }
    
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.dy = -this.ball.dy;
      this.createExplosion(this.ball.x, this.ball.y, '#3b82f6', 10);
    }
    
    // Game over
    if (this.ball.y - this.ball.radius > this.canvas.height) {
      this.lives--;
      if (this.lives <= 0) {
        this.gameOver();
      } else {
        this.resetBall();
      }
      return;
    }
    
    // Collision paddle avec effet magnétique
    if (this.ball.dy > 0 &&
        this.ball.x > this.paddle.x - this.ball.radius &&
        this.ball.x < this.paddle.x + this.paddle.width + this.ball.radius &&
        this.ball.y + this.ball.radius > this.paddle.y &&
        this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height) {
      
      // Calcul de l'angle de rebond
      const hitPos = (this.ball.x - this.paddle.x) / this.paddle.width;
      const angle = (hitPos - 0.5) * Math.PI * 0.6; // Réduit à -54° à +54° pour moins d'angles extrêmes
      
      // Limiter la vitesse pour éviter l'accélération
      const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
      const maxSpeed = 1.5; // Vitesse maximale limitée
      const speed = Math.min(currentSpeed, maxSpeed);
      this.ball.dx = speed * Math.sin(angle);
      this.ball.dy = -speed * Math.cos(angle);
      
      // Effet magnétique
      if (this.magnetActive) {
        this.ball.stuck = true;
      }
      
      this.createExplosion(this.ball.x, this.ball.y, '#10b981', 15);
      this.shake(2);
    }
    
    // Collision briques
    this.checkBrickCollisions();
    
    // Mise à jour power-ups
    this.updatePowerUps();
    
    // Mise à jour lasers
    this.updateLasers();
    
    // Particules
    this.updateParticles();
  }

  checkBrickCollisions() {
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        const brick = this.bricks[r][c];
        if (brick.currentHealth > 0) {
          if (this.ball.x + this.ball.radius > brick.x &&
              this.ball.x - this.ball.radius < brick.x + this.brickWidth &&
              this.ball.y + this.ball.radius > brick.y &&
              this.ball.y - this.ball.radius < brick.y + this.brickHeight) {
            
            // Direction du rebond
            const ballCenterX = this.ball.x;
            const ballCenterY = this.ball.y;
            const brickCenterX = brick.x + this.brickWidth / 2;
            const brickCenterY = brick.y + this.brickHeight / 2;
            
            const dx = ballCenterX - brickCenterX;
            const dy = ballCenterY - brickCenterY;
            
            if (Math.abs(dx) > Math.abs(dy)) {
              this.ball.dx = -this.ball.dx;
            } else {
              this.ball.dy = -this.ball.dy;
            }
            
            this.hitBrick(brick, r, c);
          }
        }
      }
    }
  }

  hitBrick(brick, row, col) {
    if (brick.health === -1) {
      // Brique indestructible
      this.createExplosion(brick.x + this.brickWidth/2, brick.y + this.brickHeight/2, '#6b7280', 20);
      this.shake(5);
      return;
    }
    
    brick.currentHealth--;
    brick.hit = true;
    
    if (brick.currentHealth <= 0) {
      this.updateScore(brick.points);
      this.createExplosion(
        brick.x + this.brickWidth/2, 
        brick.y + this.brickHeight/2, 
        brick.color,
        30
      );
      
      // Chance de power-up
      if (Math.random() < brick.powerUpChance) {
        this.spawnPowerUp(brick.x + this.brickWidth/2, brick.y + this.brickHeight/2);
      }
      
      // Vérifier la victoire
      if (this.checkWin()) {
        this.victory();
      }
    } else {
      // Brique endommagée
      this.createExplosion(
        brick.x + this.brickWidth/2, 
        brick.y + this.brickHeight/2, 
        brick.color,
        15
      );
    }
    
    this.shake(3);
  }

  spawnPowerUp(x, y) {
    const type = this.powerUpTypes[Math.floor(Math.random() * this.powerUpTypes.length)];
    this.fallingPowerUps.push({
      x, y,
      vy: 0.8,  // Ralenti de 2 à 0.8 pour une chute plus lente
      ...type
    });
  }

  updatePowerUps() {
    // Power-ups qui tombent
    this.fallingPowerUps = this.fallingPowerUps.filter(p => {
      p.y += p.vy;
      
      // Collision avec paddle
      if (p.x > this.paddle.x &&
          p.x < this.paddle.x + this.paddle.width &&
          p.y > this.paddle.y &&
          p.y < this.paddle.y + this.paddle.height) {
        
        this.activatePowerUp(p);
        return false;
      }
      
      return p.y < this.canvas.height;
    });
    
    // Power-ups actifs
    this.activePowerUps = this.activePowerUps.filter(p => {
      if (p.duration !== undefined) {
        p.duration--;
        
        if (p.duration <= 0) {
          this.deactivatePowerUp(p);
          return false;
        }
      }
      
      return true;
    });
  }

  activatePowerUp(powerUp) {
    this.createExplosion(powerUp.x, powerUp.y, powerUp.color, 40);
    this.shake(5);
    
    switch (powerUp.type) {
      case 'expand':
        this.paddle.width = 150;
        break;
      case 'multi':
        this.multiplyBalls();
        break;
      case 'slow':
        // Géré dans update
        break;
      case 'laser':
        // Active les lasers
        break;
      case 'magnet':
        this.magnetActive = true;
        break;
    }
    
    if (!powerUp.instant) {
      this.activePowerUps.push({ ...powerUp });
    }
  }

  deactivatePowerUp(powerUp) {
    switch (powerUp.type) {
      case 'expand':
        this.paddle.width = 100;
        break;
      case 'magnet':
        this.magnetActive = false;
        if (this.ball.stuck) {
          this.ball.stuck = false;
        }
        break;
    }
  }

  updateLasers() {
    // Tirer des lasers si power-up actif
    if (this.activePowerUps.some(p => p.type === 'laser') && this.frameCount % 10 === 0) {
      this.lasers.push(
        { x: this.paddle.x + 10, y: this.paddle.y, vy: -10 },
        { x: this.paddle.x + this.paddle.width - 10, y: this.paddle.y, vy: -10 }
      );
    }
    
    // Mise à jour lasers
    this.lasers = this.lasers.filter(laser => {
      laser.y += laser.vy;
      
      // Collision avec briques
      for (let r = 0; r < this.brickRows; r++) {
        for (let c = 0; c < this.brickCols; c++) {
          const brick = this.bricks[r][c];
          if (brick.currentHealth > 0 && brick.health !== -1) {
            if (laser.x > brick.x &&
                laser.x < brick.x + this.brickWidth &&
                laser.y > brick.y &&
                laser.y < brick.y + this.brickHeight) {
              
              this.hitBrick(brick, r, c);
              return false;
            }
          }
        }
      }
      
      return laser.y > 0;
    });
  }

  draw() {
    // Fond avec effet de profondeur amélioré
    const bgGradient = this.ctx.createRadialGradient(
      this.canvas.width/2, 0, 0,
      this.canvas.width/2, this.canvas.height, this.canvas.height * 1.2
    );
    bgGradient.addColorStop(0, '#1a1f2e');
    bgGradient.addColorStop(0.5, '#111827');
    bgGradient.addColorStop(1, '#030712');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Effet de vignette pour plus de profondeur
    const vignette = this.ctx.createRadialGradient(
      this.canvas.width/2, this.canvas.height/2, this.canvas.width * 0.3,
      this.canvas.width/2, this.canvas.height/2, this.canvas.width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Grille de fond animée
    this.drawBackgroundGrid();
    
    // Briques avec effets
    this.drawBricks();
    
    // Paddle avec effets
    this.drawPaddle();
    
    // Balle avec trail
    this.drawBall();
    
    // Power-ups
    this.drawPowerUps();
    
    // Lasers
    this.drawLasers();
    
    // Particules
    this.drawParticles();
    
    // UI
    this.drawUI();
    this.drawPowerUpStatus();
    
    // Instructions au démarrage
    if (this.ball.stuck && this.frameCount < 300) {
      this.ctx.save();
      // Fond semi-transparent pour le message
      const msgWidth = 400;
      const msgHeight = 120;
      const msgX = (this.canvas.width - msgWidth) / 2;
      const msgY = this.canvas.height / 2 - 100;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillRect(msgX, msgY, msgWidth, msgHeight);
      
      // Bordure lumineuse
      this.ctx.strokeStyle = '#3b82f6';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(msgX, msgY, msgWidth, msgHeight);
      
      // Titre
      this.ctx.fillStyle = '#60a5fa';
      this.ctx.font = 'bold 20px "Orbitron", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('BREAKOUT ULTRA', this.canvas.width / 2, msgY + 30);
      
      // Instructions
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = '14px "Orbitron", monospace';
      this.ctx.fillText('Utilisez la SOURIS ou les FLÈCHES pour déplacer', this.canvas.width / 2, msgY + 60);
      this.ctx.fillText('Cliquez ou appuyez sur ESPACE pour lancer', this.canvas.width / 2, msgY + 85);
      
      // Animation de pulsation
      const pulse = Math.sin(this.frameCount * 0.05) * 0.5 + 0.5;
      this.ctx.fillStyle = `rgba(59, 130, 246, ${pulse})`;
      this.ctx.fillText('Prêt ?', this.canvas.width / 2, msgY + 110);
      
      this.ctx.restore();
    }
    
    // Post-processing
    this.applyPostProcessing();
  }

  drawBackgroundGrid() {
    const time = Date.now() * 0.0005;
    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    this.ctx.lineWidth = 1;
    
    const gridSize = 50;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      for (let y = 0; y < this.canvas.height; y += gridSize) {
        const offset = Math.sin(time + x * 0.01 + y * 0.01) * 5;
        this.ctx.strokeRect(x + offset, y + offset, gridSize, gridSize);
      }
    }
  }

  drawBricks() {
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        const brick = this.bricks[r][c];
        if (brick.currentHealth > 0) {
          const brickX = brick.x;
          const brickY = brick.y;
          
          // Animation de hit
          let offsetY = 0;
          if (brick.hit) {
            offsetY = Math.sin(Date.now() * 0.1) * 2;
            if (Math.abs(offsetY) < 0.1) brick.hit = false;
          }
          
          // Ombre
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          this.ctx.fillRect(brickX + 2, brickY + offsetY + 2, this.brickWidth, this.brickHeight);
          
          // Brique principale
          if (brick.health === -1) {
            // Brique indestructible avec pattern
            const pattern = this.ctx.createLinearGradient(brickX, brickY, brickX + this.brickWidth, brickY + this.brickHeight);
            pattern.addColorStop(0, '#374151');
            pattern.addColorStop(0.5, '#6b7280');
            pattern.addColorStop(1, '#374151');
            this.ctx.fillStyle = pattern;
          } else {
            // Couleur selon la santé
            const healthRatio = brick.currentHealth / brick.health;
            const color = this.adjustColorBrightness(brick.color, healthRatio);
            this.ctx.fillStyle = color;
          }
          
          // Coins arrondis pour les briques
          const radius = 4;
          this.ctx.beginPath();
          this.ctx.moveTo(brickX + radius, brickY + offsetY);
          this.ctx.lineTo(brickX + this.brickWidth - radius, brickY + offsetY);
          this.ctx.quadraticCurveTo(brickX + this.brickWidth, brickY + offsetY, brickX + this.brickWidth, brickY + offsetY + radius);
          this.ctx.lineTo(brickX + this.brickWidth, brickY + offsetY + this.brickHeight - radius);
          this.ctx.quadraticCurveTo(brickX + this.brickWidth, brickY + offsetY + this.brickHeight, brickX + this.brickWidth - radius, brickY + offsetY + this.brickHeight);
          this.ctx.lineTo(brickX + radius, brickY + offsetY + this.brickHeight);
          this.ctx.quadraticCurveTo(brickX, brickY + offsetY + this.brickHeight, brickX, brickY + offsetY + this.brickHeight - radius);
          this.ctx.lineTo(brickX, brickY + offsetY + radius);
          this.ctx.quadraticCurveTo(brickX, brickY + offsetY, brickX + radius, brickY + offsetY);
          this.ctx.closePath();
          this.ctx.fill();
          
          // Réinitialiser les ombres
          this.ctx.shadowBlur = 0;
          this.ctx.shadowOffsetX = 0;
          this.ctx.shadowOffsetY = 0;
          
          // Reflet
          const gradient = this.ctx.createLinearGradient(brickX, brickY + offsetY, brickX, brickY + offsetY + this.brickHeight);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(brickX, brickY + offsetY, this.brickWidth, this.brickHeight);
          
          // Bordure
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(brickX, brickY + offsetY, this.brickWidth, this.brickHeight);
          
          // Indicateur de santé pour briques multi-hit
          if (brick.health > 1 && brick.currentHealth > 0) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px "Orbitron", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(brick.currentHealth.toString(), brickX + this.brickWidth/2, brickY + offsetY + this.brickHeight/2 + 4);
          }
        }
      }
    }
  }

  drawPaddle() {
    // Ombre
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(this.paddle.x + 2, this.paddle.y + 2, this.paddle.width, this.paddle.height);
    
    // Paddle avec dégradé
    const paddleGradient = this.ctx.createLinearGradient(
      this.paddle.x, this.paddle.y,
      this.paddle.x + this.paddle.width, this.paddle.y
    );
    
    if (this.magnetActive) {
      paddleGradient.addColorStop(0, '#8b5cf6');
      paddleGradient.addColorStop(0.5, '#a78bfa');
      paddleGradient.addColorStop(1, '#8b5cf6');
    } else {
      paddleGradient.addColorStop(0, '#3b82f6');
      paddleGradient.addColorStop(0.5, '#60a5fa');
      paddleGradient.addColorStop(1, '#3b82f6');
    }
    
    this.ctx.fillStyle = paddleGradient;
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
    
    // Reflet
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, 3);
    
    // Effet de lueur
    if (this.activePowerUps.length > 0) {
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = this.activePowerUps[0].color;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      this.ctx.fillRect(this.paddle.x - 5, this.paddle.y - 5, this.paddle.width + 10, this.paddle.height + 10);
      this.ctx.shadowBlur = 0;
    }
  }

  drawBall() {
    // Trail
    this.ball.trail.forEach((t, i) => {
      const alpha = t.life / 15;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, this.ball.radius * (t.life / 15), 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // Balle principale avec lueur
    const ballGradient = this.ctx.createRadialGradient(
      this.ball.x - 3, this.ball.y - 3, 0,
      this.ball.x, this.ball.y, this.ball.radius
    );
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(1, '#60a5fa');
    
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#3b82f6';
    this.ctx.fillStyle = ballGradient;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  drawPowerUps() {
    // Power-ups qui tombent
    this.fallingPowerUps.forEach(p => {
      // Animation de rotation
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(Date.now() * 0.003);
      
      // Lueur
      const glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      glow.addColorStop(0, p.color);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(-25, -25, 50, 50);
      
      // Icône
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(p.icon, 0, 0);
      
      this.ctx.restore();
    });
  }

  drawLasers() {
    this.lasers.forEach(laser => {
      // Laser avec lueur
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#ef4444';
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fillRect(laser.x - 2, laser.y, 4, 20);
      this.ctx.shadowBlur = 0;
    });
  }

  drawPowerUpStatus() {
    let y = 120;
    this.activePowerUps.forEach(p => {
      if (p.duration !== undefined) {
        const width = 150;
        const height = 20;
        const x = this.canvas.width - width - 20;
        
        // Fond
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(x, y, width, height);
        
        // Barre de progression
        const progress = p.duration / (p.type === 'expand' ? 500 : p.type === 'slow' ? 300 : 400);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(x, y, width * progress, height);
        
        // Icône et texte
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px "Orbitron", monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(p.icon + ' ' + p.type.toUpperCase(), x + width - 5, y + 14);
        
        y += 25;
      }
    });
  }

  adjustColorBrightness(color, factor) {
    const num = parseInt(color.slice(1), 16);
    const r = Math.floor((num >> 16) * factor);
    const g = Math.floor(((num >> 8) & 0x00FF) * factor);
    const b = Math.floor((num & 0x0000FF) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  resetBall() {
    this.ball.x = this.paddle.x + this.paddle.width / 2;
    this.ball.y = this.paddle.y - 20;
    this.ball.dx = 1 * (Math.random() > 0.5 ? 1 : -1);  // Ralenti de 4 à 1
    this.ball.dy = -1;  // Ralenti de -4 à -1
    this.ball.stuck = true;
  }

  checkWin() {
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.brickCols; c++) {
        if (this.bricks[r][c].currentHealth > 0 && this.bricks[r][c].health !== -1) {
          return false;
        }
      }
    }
    return true;
  }

  victory() {
    this.isRunning = false;
    
    // Feux d'artifice
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height / 2;
        this.createExplosion(x, y, `hsl(${Math.random() * 360}, 100%, 50%)`, 50);
      }, i * 200);
    }
    
    setTimeout(() => {
      this.drawVictoryScreen();
    }, 1500);
  }

  drawVictoryScreen() {
    // Fond avec effet
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width/2, this.canvas.height/2, 0,
      this.canvas.width/2, this.canvas.height/2, 300
    );
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Victoire
    this.ctx.fillStyle = '#10b981';
    this.ctx.font = 'bold 48px "Orbitron", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VICTOIRE!', this.canvas.width / 2, this.canvas.height / 2 - 50);
    
    // Score
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px "Orbitron", monospace';
    this.ctx.fillText(`Score Final: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
    
    // High Score
    if (this.score === this.highScore) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fillText('NOUVEAU RECORD!', this.canvas.width / 2, this.canvas.height / 2 + 35);
    }
    
    // Instructions
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Orbitron", monospace';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 80);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }

  handleKeyDown(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = true;
    if (e.key === 'ArrowRight') this.rightPressed = true;
    if (e.key === ' ') {
      if (this.ball.stuck) {
        this.ball.stuck = false;
      } else {
        this.isPaused = !this.isPaused;
      }
    }
  }

  handleKeyUp(e) {
    if (e.key === 'ArrowLeft') this.leftPressed = false;
    if (e.key === 'ArrowRight') this.rightPressed = false;
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
  }

  gameOver() {
    this.isRunning = false;
    this.combo = 0;
    
    // Explosion de la balle
    this.createExplosion(this.ball.x, this.ball.y, '#ef4444', 50);
    this.shake(10);
    
    setTimeout(() => {
      this.drawGameOverScreen();
    }, 1000);
  }

  drawGameOverScreen() {
    // Fond
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Game Over
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 48px "Orbitron", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
    
    // Score
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px "Orbitron", monospace';
    this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
    
    // Instructions
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Orbitron", monospace';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 50);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }
}

// Space Shooter Ultra-Moderne
class UltraModernSpaceShooterGame extends UltraModernBaseGame {
  init(canvas) {
    super.init(canvas);
    
    this.player = {
      x: canvas.width / 2,
      y: canvas.height - 100,
      width: 60,
      height: 40,
      speed: 6,
      health: 100,
      maxHealth: 100,
      shield: 0,
      weapons: ['laser']
    };
    
    this.bullets = [];
    this.enemies = [];
    this.stars = [];
    this.explosions = [];
    
    // Configuration des ennemis
    this.enemyTypes = [
      { 
        type: 'basic',
        width: 40,
        height: 30,
        health: 1,
        speed: 2,
        color: '#ef4444',
        points: 10,
        shootChance: 0.005
      },
      {
        type: 'tank',
        width: 50,
        height: 40,
        health: 3,
        speed: 1,
        color: '#8b5cf6',
        points: 30,
        shootChance: 0.01
      },
      {
        type: 'fast',
        width: 30,
        height: 25,
        health: 1,
        speed: 4,
        color: '#fbbf24',
        points: 20,
        shootChance: 0.003
      }
    ];
    
    // Armes et améliorations
    this.weaponTypes = {
      laser: { damage: 1, speed: 10, rate: 5, color: '#3b82f6' },
      plasma: { damage: 2, speed: 8, rate: 7, color: '#8b5cf6' },
      missile: { damage: 5, speed: 6, rate: 15, color: '#ef4444' }
    };
    
    this.currentWeapon = 'laser';
    this.fireRate = 0;
    
    // Génération des étoiles
    this.initStars();
    
    // Vagues d'ennemis
    this.wave = 1;
    this.enemiesPerWave = 5;
    this.waveTimer = 0;
    
    // Contrôles
    this.keys = {};
    
    // Boss
    this.boss = null;
    this.bossHealth = 100;
  }

  initStars() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5
      });
    }
  }

  update() {
    if (this.isPaused) return;
    
    // Mise à jour des étoiles
    this.updateStars();
    
    // Contrôles joueur
    this.updatePlayer();
    
    // Tir automatique
    if (this.keys[' '] && this.fireRate <= 0) {
      this.shoot();
      this.fireRate = this.weaponTypes[this.currentWeapon].rate;
    }
    if (this.fireRate > 0) this.fireRate--;
    
    // Mise à jour des balles
    this.updateBullets();
    
    // Génération d'ennemis
    this.spawnEnemies();
    
    // Mise à jour des ennemis
    this.updateEnemies();
    
    // Mise à jour du boss
    if (this.boss) {
      this.updateBoss();
    }
    
    // Particules
    this.updateParticles();
    
    // Power-ups
    this.updatePowerUps();
    
    // Vérifier game over
    if (this.player.health <= 0) {
      this.gameOver();
    }
  }

  updateStars() {
    this.stars.forEach(star => {
      star.y += star.speed;
      if (star.y > this.canvas.height) {
        star.y = -5;
        star.x = Math.random() * this.canvas.width;
      }
    });
  }

  updatePlayer() {
    if (this.keys['ArrowLeft'] && this.player.x > 0) {
      this.player.x -= this.player.speed;
    }
    if (this.keys['ArrowRight'] && this.player.x < this.canvas.width - this.player.width) {
      this.player.x += this.player.speed;
    }
    if (this.keys['ArrowUp'] && this.player.y > this.canvas.height / 2) {
      this.player.y -= this.player.speed;
    }
    if (this.keys['ArrowDown'] && this.player.y < this.canvas.height - this.player.height - 20) {
      this.player.y += this.player.speed;
    }
    
    // Régénération du bouclier
    if (this.player.shield < 100 && this.frameCount % 60 === 0) {
      this.player.shield = Math.min(100, this.player.shield + 1);
    }
  }

  shoot() {
    const weapon = this.weaponTypes[this.currentWeapon];
    
    if (this.currentWeapon === 'laser') {
      this.bullets.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y,
        vx: 0,
        vy: -weapon.speed,
        damage: weapon.damage,
        color: weapon.color,
        type: 'player',
        width: 4,
        height: 15
      });
    } else if (this.currentWeapon === 'plasma') {
      // Double tir
      this.bullets.push(
        {
          x: this.player.x + 10,
          y: this.player.y,
          vx: -1,
          vy: -weapon.speed,
          damage: weapon.damage,
          color: weapon.color,
          type: 'player',
          width: 6,
          height: 20
        },
        {
          x: this.player.x + this.player.width - 10,
          y: this.player.y,
          vx: 1,
          vy: -weapon.speed,
          damage: weapon.damage,
          color: weapon.color,
          type: 'player',
          width: 6,
          height: 20
        }
      );
    } else if (this.currentWeapon === 'missile') {
      this.bullets.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y,
        vx: 0,
        vy: -weapon.speed,
        damage: weapon.damage,
        color: weapon.color,
        type: 'player',
        width: 8,
        height: 25,
        homing: true,
        target: this.findNearestEnemy()
      });
    }
    
    // Effet de tir
    this.createExplosion(
      this.player.x + this.player.width / 2,
      this.player.y,
      weapon.color,
      10
    );
  }

  findNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;
    
    this.enemies.forEach(enemy => {
      const dist = Math.sqrt(
        Math.pow(enemy.x - this.player.x, 2) +
        Math.pow(enemy.y - this.player.y, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    });
    
    return nearest;
  }

  updateBullets() {
    this.bullets = this.bullets.filter(bullet => {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      
      // Missiles à tête chercheuse
      if (bullet.homing && bullet.target) {
        const dx = bullet.target.x + bullet.target.width/2 - bullet.x;
        const dy = bullet.target.y + bullet.target.height/2 - bullet.y;
        const angle = Math.atan2(dy, dx);
        bullet.vx = Math.cos(angle) * 8;
        bullet.vy = Math.sin(angle) * 8;
      }
      
      // Trail pour les missiles
      if (bullet.type === 'player' && bullet.width > 6) {
        this.particles.push({
          x: bullet.x,
          y: bullet.y + bullet.height,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2 + 1,
          life: 20,
          maxLife: 20,
          color: bullet.color,
          size: 3,
          type: 'smoke'
        });
      }
      
      // Vérifier les collisions
      if (bullet.type === 'player') {
        // Collision avec ennemis
        for (let enemy of this.enemies) {
          if (this.checkCollision(bullet, enemy)) {
            this.hitEnemy(enemy, bullet.damage);
            return false;
          }
        }
        
        // Collision avec boss
        if (this.boss && this.checkCollision(bullet, this.boss)) {
          this.hitBoss(bullet.damage);
          return false;
        }
      } else {
        // Balles ennemies
        if (this.checkCollision(bullet, this.player)) {
          this.hitPlayer(bullet.damage || 10);
          return false;
        }
      }
      
      // Sortie de l'écran
      return bullet.y > -50 && bullet.y < this.canvas.height + 50 &&
             bullet.x > -50 && bullet.x < this.canvas.width + 50;
    });
  }

  spawnEnemies() {
    this.waveTimer++;
    
    if (this.waveTimer > 180 && this.enemies.length === 0) {
      // Nouvelle vague
      const enemiesInWave = this.enemiesPerWave + Math.floor(this.wave / 3);
      
      for (let i = 0; i < enemiesInWave; i++) {
        const type = this.enemyTypes[Math.floor(Math.random() * this.enemyTypes.length)];
        const enemy = {
          ...type,
          x: Math.random() * (this.canvas.width - type.width),
          y: -type.height - i * 60,
          vx: (Math.random() - 0.5) * 2,
          vy: type.speed,
          currentHealth: type.health,
          pattern: Math.random() > 0.5 ? 'sine' : 'straight',
          offset: Math.random() * Math.PI * 2
        };
        
        this.enemies.push(enemy);
      }
      
      this.wave++;
      this.waveTimer = 0;
      
      // Boss tous les 5 niveaux
      if (this.wave % 5 === 0) {
        this.spawnBoss();
      }
    }
  }

  updateEnemies() {
    this.enemies = this.enemies.filter(enemy => {
      // Mouvement
      if (enemy.pattern === 'sine') {
        enemy.x += Math.sin(Date.now() * 0.002 + enemy.offset) * 2;
      } else {
        enemy.x += enemy.vx;
      }
      enemy.y += enemy.vy;
      
      // Rebond sur les bords
      if (enemy.x <= 0 || enemy.x >= this.canvas.width - enemy.width) {
        enemy.vx = -enemy.vx;
      }
      
      // Tir ennemi
      if (Math.random() < enemy.shootChance) {
        this.enemyShoot(enemy);
      }
      
      // Collision avec le joueur
      if (this.checkCollision(enemy, this.player)) {
        this.hitPlayer(20);
        this.hitEnemy(enemy, 999);
        return false;
      }
      
      return enemy.y < this.canvas.height + 50;
    });
  }

  enemyShoot(enemy) {
    this.bullets.push({
      x: enemy.x + enemy.width / 2,
      y: enemy.y + enemy.height,
      vx: 0,
      vy: 5,
      damage: 10,
      color: '#ef4444',
      type: 'enemy',
      width: 4,
      height: 10
    });
  }

  hitEnemy(enemy, damage) {
    enemy.currentHealth -= damage;
    
    if (enemy.currentHealth <= 0) {
      this.updateScore(enemy.points);
      this.createExplosion(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.color,
        30
      );
      this.shake(3);
      
      // Chance de drop
      if (Math.random() < 0.2) {
        this.spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
      }
      
      // Retirer l'ennemi
      const index = this.enemies.indexOf(enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    } else {
      // Hit effect
      this.createExplosion(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.color,
        10
      );
    }
  }

  hitPlayer(damage) {
    if (this.player.shield > 0) {
      this.player.shield = Math.max(0, this.player.shield - damage);
    } else {
      this.player.health = Math.max(0, this.player.health - damage);
    }
    
    this.createExplosion(
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height / 2,
      '#ef4444',
      20
    );
    this.shake(5);
    this.combo = 0;
  }

  spawnBoss() {
    this.boss = {
      x: this.canvas.width / 2 - 100,
      y: -200,
      width: 200,
      height: 150,
      health: 100 + this.wave * 20,
      maxHealth: 100 + this.wave * 20,
      speed: 1,
      phase: 0,
      attackTimer: 0
    };
  }

  updateBoss() {
    if (!this.boss) return;
    
    // Entrée du boss
    if (this.boss.y < 50) {
      this.boss.y += 2;
      return;
    }
    
    // Mouvement du boss
    this.boss.x += Math.sin(Date.now() * 0.001) * 2;
    
    // Attaques du boss
    this.boss.attackTimer++;
    
    if (this.boss.attackTimer % 60 === 0) {
      // Tir en éventail
      for (let i = -3; i <= 3; i++) {
        this.bullets.push({
          x: this.boss.x + this.boss.width / 2,
          y: this.boss.y + this.boss.height,
          vx: i * 2,
          vy: 5,
          damage: 15,
          color: '#dc2626',
          type: 'enemy',
          width: 8,
          height: 15
        });
      }
    }
    
    if (this.boss.attackTimer % 180 === 0) {
      // Laser
      this.bullets.push({
        x: this.boss.x + this.boss.width / 2,
        y: this.boss.y + this.boss.height,
        vx: 0,
        vy: 0,
        damage: 30,
        color: '#fbbf24',
        type: 'enemy',
        width: 20,
        height: this.canvas.height,
        laser: true,
        duration: 60
      });
    }
  }

  hitBoss(damage) {
    if (!this.boss) return;
    
    this.boss.health -= damage;
    
    if (this.boss.health <= 0) {
      // Boss détruit
      this.updateScore(1000 * this.wave);
      
      // Grosse explosion
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const x = this.boss.x + Math.random() * this.boss.width;
          const y = this.boss.y + Math.random() * this.boss.height;
          this.createExplosion(x, y, '#ef4444', 50);
        }, i * 100);
      }
      
      this.shake(20);
      this.boss = null;
      
      // Drop de power-ups
      for (let i = 0; i < 3; i++) {
        this.spawnPowerUp(
          this.boss.x + Math.random() * this.boss.width,
          this.boss.y + Math.random() * this.boss.height
        );
      }
    } else {
      // Hit effect
      this.createExplosion(
        this.boss.x + Math.random() * this.boss.width,
        this.boss.y + Math.random() * this.boss.height,
        '#fbbf24',
        20
      );
    }
  }

  spawnPowerUp(x, y) {
    const types = [
      { type: 'health', icon: '❤️', color: '#ef4444' },
      { type: 'shield', icon: '🛡️', color: '#3b82f6' },
      { type: 'weapon', icon: '🔫', color: '#8b5cf6' },
      { type: 'speed', icon: '⚡', color: '#fbbf24' }
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    this.powerUps.push({
      x, y,
      vy: 2,
      ...type
    });
  }

  checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  draw() {
    // Fond spatial
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    bgGradient.addColorStop(0, '#000814');
    bgGradient.addColorStop(1, '#001d3d');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Étoiles
    this.drawStars();
    
    // Ennemis
    this.drawEnemies();
    
    // Boss
    if (this.boss) {
      this.drawBoss();
    }
    
    // Joueur
    this.drawPlayer();
    
    // Balles
    this.drawBullets();
    
    // Power-ups
    this.drawPowerUps();
    
    // Particules
    this.drawParticles();
    
    // UI
    this.drawUI();
    this.drawHealthBar();
    this.drawWaveInfo();
    
    // Post-processing
    this.applyPostProcessing();
  }

  drawStars() {
    this.stars.forEach(star => {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
  }

  drawPlayer() {
    // Bouclier
    if (this.player.shield > 0) {
      const shieldAlpha = this.player.shield / 100;
      const shieldGradient = this.ctx.createRadialGradient(
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height / 2,
        0,
        this.player.x + this.player.width / 2,
        this.player.y + this.player.height / 2,
        40
      );
      shieldGradient.addColorStop(0, `rgba(59, 130, 246, ${shieldAlpha * 0.3})`);
      shieldGradient.addColorStop(1, 'transparent');
      this.ctx.fillStyle = shieldGradient;
      this.ctx.fillRect(
        this.player.x - 10,
        this.player.y - 10,
        this.player.width + 20,
        this.player.height + 20
      );
    }
    
    // Vaisseau principal
    this.ctx.save();
    this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
    
    // Corps du vaisseau
    const shipGradient = this.ctx.createLinearGradient(-this.player.width/2, 0, this.player.width/2, 0);
    shipGradient.addColorStop(0, '#1e40af');
    shipGradient.addColorStop(0.5, '#3b82f6');
    shipGradient.addColorStop(1, '#1e40af');
    
    this.ctx.fillStyle = shipGradient;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.player.height/2);
    this.ctx.lineTo(-this.player.width/2, this.player.height/2);
    this.ctx.lineTo(-this.player.width/4, this.player.height/3);
    this.ctx.lineTo(this.player.width/4, this.player.height/3);
    this.ctx.lineTo(this.player.width/2, this.player.height/2);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Cockpit
    this.ctx.fillStyle = '#60a5fa';
    this.ctx.beginPath();
    this.ctx.ellipse(0, -this.player.height/4, this.player.width/6, this.player.height/4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Réacteurs
    const engineGlow = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    this.ctx.fillStyle = `rgba(251, 191, 36, ${engineGlow})`;
    this.ctx.fillRect(-this.player.width/3, this.player.height/2 - 5, 8, 10);
    this.ctx.fillRect(this.player.width/3 - 8, this.player.height/2 - 5, 8, 10);
    
    this.ctx.restore();
    
    // Flammes des réacteurs
    if (this.keys['ArrowUp']) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: this.player.x + this.player.width/3 - 4 + Math.random() * 8,
          y: this.player.y + this.player.height,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 3 + 2,
          life: 20,
          maxLife: 20,
          color: '#fbbf24',
          size: Math.random() * 4 + 2,
          type: 'flame'
        });
        
        this.particles.push({
          x: this.player.x + 2*this.player.width/3 - 4 + Math.random() * 8,
          y: this.player.y + this.player.height,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 3 + 2,
          life: 20,
          maxLife: 20,
          color: '#fbbf24',
          size: Math.random() * 4 + 2,
          type: 'flame'
        });
      }
    }
  }

  drawEnemies() {
    this.enemies.forEach(enemy => {
      // Ombre
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(enemy.x + 2, enemy.y + 2, enemy.width, enemy.height);
      
      // Vaisseau ennemi
      const gradient = this.ctx.createLinearGradient(
        enemy.x, enemy.y,
        enemy.x, enemy.y + enemy.height
      );
      gradient.addColorStop(0, enemy.color);
      gradient.addColorStop(1, this.adjustColorBrightness(enemy.color, 0.5));
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height);
      this.ctx.lineTo(enemy.x, enemy.y);
      this.ctx.lineTo(enemy.x + enemy.width, enemy.y);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Barre de vie pour les tanks
      if (enemy.type === 'tank' && enemy.currentHealth > 1) {
        const healthPercent = enemy.currentHealth / enemy.health;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 4);
        this.ctx.fillStyle = '#10b981';
        this.ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * healthPercent, 4);
      }
    });
  }

  drawBoss() {
    if (!this.boss) return;
    
    // Corps du boss
    const bossGradient = this.ctx.createRadialGradient(
      this.boss.x + this.boss.width / 2,
      this.boss.y + this.boss.height / 2,
      0,
      this.boss.x + this.boss.width / 2,
      this.boss.y + this.boss.height / 2,
      this.boss.width / 2
    );
    bossGradient.addColorStop(0, '#dc2626');
    bossGradient.addColorStop(1, '#7f1d1d');
    
    this.ctx.fillStyle = bossGradient;
    this.ctx.fillRect(this.boss.x, this.boss.y, this.boss.width, this.boss.height);
    
    // Détails
    this.ctx.fillStyle = '#991b1b';
    for (let i = 0; i < 3; i++) {
      this.ctx.fillRect(
        this.boss.x + 20 + i * 60,
        this.boss.y + 30,
        40,
        40
      );
    }
    
    // Barre de vie
    const healthPercent = this.boss.health / this.boss.maxHealth;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.boss.x, this.boss.y - 20, this.boss.width, 10);
    
    const healthGradient = this.ctx.createLinearGradient(
      this.boss.x, this.boss.y - 20,
      this.boss.x + this.boss.width, this.boss.y - 20
    );
    healthGradient.addColorStop(0, '#dc2626');
    healthGradient.addColorStop(1, '#ef4444');
    
    this.ctx.fillStyle = healthGradient;
    this.ctx.fillRect(this.boss.x, this.boss.y - 20, this.boss.width * healthPercent, 10);
  }

  drawBullets() {
    this.bullets.forEach(bullet => {
      if (bullet.laser) {
        // Laser spécial
        const alpha = bullet.duration / 60;
        this.ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.5})`;
        this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
        
        // Lueur
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = bullet.color;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.fillRect(bullet.x - 2, bullet.y, 4, bullet.height);
        this.ctx.shadowBlur = 0;
        
        bullet.duration--;
      } else {
        // Balles normales
        const gradient = this.ctx.createLinearGradient(
          bullet.x, bullet.y,
          bullet.x, bullet.y + bullet.height
        );
        gradient.addColorStop(0, bullet.color);
        gradient.addColorStop(1, 'white');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y, bullet.width, bullet.height);
        
        // Lueur
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = bullet.color;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(bullet.x - 1, bullet.y, 2, bullet.height/2);
        this.ctx.shadowBlur = 0;
      }
    });
  }

  drawPowerUps() {
    this.powerUps.forEach(p => {
      // Animation
      const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 1;
      
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.scale(pulse, pulse);
      this.ctx.rotate(Date.now() * 0.002);
      
      // Lueur
      const glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      glow.addColorStop(0, p.color);
      glow.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glow;
      this.ctx.fillRect(-25, -25, 50, 50);
      
      // Icône
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(p.icon, 0, 0);
      
      this.ctx.restore();
    });
  }

  drawHealthBar() {
    // Barre de vie
    const barWidth = 200;
    const barHeight = 20;
    const x = 20;
    const y = this.canvas.height - 40;
    
    // Fond
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(x, y, barWidth, barHeight);
    
    // Vie
    const healthPercent = this.player.health / this.player.maxHealth;
    const healthGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y);
    healthGradient.addColorStop(0, '#dc2626');
    healthGradient.addColorStop(healthPercent, '#ef4444');
    healthGradient.addColorStop(healthPercent, 'transparent');
    
    this.ctx.fillStyle = healthGradient;
    this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    
    // Texte
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px "Orbitron", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${this.player.health}/${this.player.maxHealth}`, x + barWidth/2, y + barHeight/2 + 5);
    
    // Barre de bouclier
    if (this.player.shield > 0) {
      const shieldY = y - 25;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(x, shieldY, barWidth, 15);
      
      const shieldPercent = this.player.shield / 100;
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.fillRect(x, shieldY, barWidth * shieldPercent, 15);
    }
  }

  drawWaveInfo() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px "Orbitron", monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`Wave ${this.wave}`, this.canvas.width - 20, 40);
    
    if (this.boss) {
      this.ctx.fillStyle = '#ef4444';
      this.ctx.font = 'bold 24px "Orbitron", monospace';
      this.ctx.fillText('BOSS FIGHT!', this.canvas.width - 20, 70);
    }
  }

  handleKeyDown(e) {
    this.keys[e.key] = true;
    
    // Changement d'arme
    if (e.key >= '1' && e.key <= '3') {
      const weapons = ['laser', 'plasma', 'missile'];
      const index = parseInt(e.key) - 1;
      if (weapons[index] && this.player.weapons.includes(weapons[index])) {
        this.currentWeapon = weapons[index];
      }
    }
  }

  handleKeyUp(e) {
    this.keys[e.key] = false;
  }

  gameOver() {
    this.isRunning = false;
    
    // Explosion du joueur
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50;
      const speed = Math.random() * 10 + 5;
      this.particles.push({
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60,
        color: '#3b82f6',
        size: Math.random() * 6 + 2,
        type: 'explosion'
      });
    }
    
    this.shake(20);
    
    setTimeout(() => {
      this.drawGameOverScreen();
    }, 2000);
  }

  drawGameOverScreen() {
    // Fond
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Game Over
    this.ctx.fillStyle = '#ef4444';
    this.ctx.font = 'bold 48px "Orbitron", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
    
    // Score et vague
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px "Orbitron", monospace';
    this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.fillText(`Vague atteinte: ${this.wave}`, this.canvas.width / 2, this.canvas.height / 2 + 35);
    
    // High Score
    if (this.score === this.highScore) {
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fillText('NOUVEAU RECORD!', this.canvas.width / 2, this.canvas.height / 2 + 70);
    }
    
    // Instructions
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '16px "Orbitron", monospace';
    this.ctx.fillText('Cliquez pour rejouer', this.canvas.width / 2, this.canvas.height / 2 + 110);
    
    this.canvas.addEventListener('click', () => {
      this.init(this.canvas);
      this.start();
    }, { once: true });
  }
}

// Exporter les classes
window.UltraModernSnakeGame = UltraModernSnakeGame;
window.UltraModernBreakoutGame = UltraModernBreakoutGame;
window.UltraModernSpaceShooterGame = UltraModernSpaceShooterGame;