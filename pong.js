const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Space theme colors
const STAR_COLOR = '#fff';
const PADDLE_COLOR = '#00f0ff';
const BALL_COLOR = '#ffeb3b';
const STAR_COUNT = 80;

// Draw random stars in the background
function drawStars() {
    for (let i = 0; i < STAR_COUNT; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 1.5 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = STAR_COLOR;
        ctx.globalAlpha = Math.random() * 0.5 + 0.5;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Paddle
const paddleHeight = 60; // was 80, now smaller for harder play
const paddleWidth = 12;
let leftPaddleY = canvas.height / 2 - paddleHeight / 2;
let rightPaddleY = canvas.height / 2 - paddleHeight / 2;
// 3D variables (z-axis: 0 = closest, 1 = farthest)
let leftPaddleZ = 0.25; // left paddle can move z=0 to 0.5
let rightPaddleZ = 0.75; // right paddle can move z=0.5 to 1
const paddleSpeed = 6;
const paddleZSpeed = 0.04;

// Ball
let ballX = canvas.width / 2;
let ballY = canvas.height / 2;
let ballRadius = 10;
let ballSpeedX = 5;
let ballSpeedY = 3;
let ballZ = 0.5;
let ballSpeedZ = 0.01 + (Math.random() - 0.5) * 0.01;

// Scores
let leftScore = 0;
let rightScore = 0;

// Controls
let upPressed = false;
let downPressed = false;
let leftUpPressed = false;
let leftDownPressed = false;
// 3D: Add z-axis controls
let leftZNegPressed = false; // A
let leftZPosPressed = false; // D
let rightZNegPressed = false; // ,
let rightZPosPressed = false; // .

// Game state
let gameRunning = false;
let animationId = null;

// Laser ball variables
let laserBallX = canvas.width / 2;
let laserBallY = 130;
let laserBallRadius = 18;
let laserBallSpeedX = (Math.random() > 0.5 ? 1 : -1) * 7; // was 5, now faster
let laserBallSpeedY = 4 + (Math.random() - 0.5) * 2; // was 3, now faster
let laserActive = false;
let laserFiring = false;
let laserCharge = 0;
let laserFlash = 0;
let laserSound = null;
let twoPlayerMode = false;

// Hit counter
let hitCount = 0;

// Ability variables
let leftAbilityReady = true;
let rightAbilityReady = true;
let leftAbilityActive = false;
let rightAbilityActive = false;
let leftAbilityTimer = 0;
let rightAbilityTimer = 0;
const ABILITY_DURATION = 180; // 3 seconds at 60fps
const ABILITY_PADDLE_BOOST = 60; // extra paddle height

// AI difficulty settings
let aiDifficulty = 'medium';
let aiSpeedMultiplier = 1.1;

// Ability types
let leftAbilityType = null;
let rightAbilityType = null;

// Listen for key events
window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.key === 'ArrowUp') upPressed = true;
    if (e.key === 'ArrowDown') downPressed = true;
    // 3D: Right paddle z-axis
    if (e.key === ',') rightZNegPressed = true;
    if (e.key === '.') rightZPosPressed = true;
    if (twoPlayerMode) {
        if (e.key === 'w' || e.key === 'W') leftUpPressed = true;
        if (e.key === 's' || e.key === 'S') leftDownPressed = true;
        // 3D: Left paddle z-axis
        if (e.key === 'a' || e.key === 'A') leftZNegPressed = true;
        if (e.key === 'd' || e.key === 'D') leftZPosPressed = true;
        if (e.key === 'e' || e.key === 'E') {
            if (leftAbilityReady && !leftAbilityActive) {
                if (leftAbilityType === 'blackhole') {
                    activateBlackHole(true);
                    leftAbilityReady = false;
                } else {
                    leftAbilityActive = true;
                    leftAbilityReady = false;
                    leftAbilityTimer = ABILITY_DURATION;
                }
            }
        }
    }
    if (e.key === '/') {
        if (rightAbilityReady && !rightAbilityActive) {
            if (rightAbilityType === 'blackhole') {
                activateBlackHole(false);
                rightAbilityReady = false;
            } else {
                rightAbilityActive = true;
                rightAbilityReady = false;
                rightAbilityTimer = ABILITY_DURATION;
            }
        }
    }
});
window.addEventListener('keyup', (e) => {
    if (!gameRunning) return;
    if (e.key === 'ArrowUp') upPressed = false;
    if (e.key === 'ArrowDown') downPressed = false;
    if (e.key === ',') rightZNegPressed = false;
    if (e.key === '.') rightZPosPressed = false;
    if (twoPlayerMode) {
        if (e.key === 'w' || e.key === 'W') leftUpPressed = false;
        if (e.key === 's' || e.key === 'S') leftDownPressed = false;
        if (e.key === 'a' || e.key === 'A') leftZNegPressed = false;
        if (e.key === 'd' || e.key === 'D') leftZPosPressed = false;
    }
});

function playLaserSound() {
    if (!laserSound) {
        laserSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7e2.mp3');
    }
    laserSound.currentTime = 0;
    laserSound.play();
}

function drawLaserCharge() {
    // Draw charge-up circle below spaceship
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 130, 30 + 10 * Math.sin(laserCharge * Math.PI), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,255,255,0.7)';
    ctx.lineWidth = 6 + 6 * Math.sin(laserCharge * Math.PI);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(laserCharge * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function drawLaserBall() {
    ctx.save();
    // Flash effect
    if (laserFlash > 0) {
        ctx.globalAlpha = Math.min(1, laserFlash);
        ctx.beginPath();
        ctx.arc(laserBallX, laserBallY, laserBallRadius + 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,255,0.25)';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 60;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
    // Outer plasma aura
    let grad = ctx.createRadialGradient(laserBallX, laserBallY, laserBallRadius * 0.7, laserBallX, laserBallY, laserBallRadius + 12);
    grad.addColorStop(0, 'rgba(0,255,255,0.7)');
    grad.addColorStop(1, 'rgba(0,255,255,0.05)');
    ctx.beginPath();
    ctx.arc(laserBallX, laserBallY, laserBallRadius + 12, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    // Main ball
    ctx.beginPath();
    ctx.arc(laserBallX, laserBallY, laserBallRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,255,255,0.95)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 32;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Core
    ctx.beginPath();
    ctx.arc(laserBallX, laserBallY, laserBallRadius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function drawPaddle(x, y, isLeft, z) {
    let h = paddleHeight;
    if (isLeft && leftAbilityActive) h += ABILITY_PADDLE_BOOST;
    if (!isLeft && rightAbilityActive) h += ABILITY_PADDLE_BOOST;
    // 3D: scale paddle based on z-depth (closer = bigger)
    let zNorm = z !== undefined ? z : 0.5;
    let scale = 0.7 + 0.6 * (1 - Math.abs(zNorm - 0.5) * 2); // 1 at center, 0.7 at far/near
    ctx.save();
    ctx.fillStyle = PADDLE_COLOR;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.translate(x + paddleWidth / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.fillRect(-paddleWidth / 2, -h / 2, paddleWidth, h);
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawBall() {
    // 3D: scale ball based on z-depth
    let zNorm = ballZ;
    let scale = 0.7 + 0.6 * (1 - Math.abs(zNorm - 0.5) * 2);
    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawScore() {
    ctx.font = '32px Orbitron, Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(leftScore, canvas.width / 4, 50);
    ctx.fillText(rightScore, 3 * canvas.width / 4, 50);
}

function resetBall() {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeedX = -ballSpeedX;
    ballSpeedY = (Math.random() - 0.5) * 8;
    // Pause and show overlay after a score
    gameRunning = false;
    if (startOverlay) startOverlay.style.display = 'flex';
    cancelAnimationFrame(animationId);
}

function resetLaserBall() {
    laserBallX = canvas.width / 2;
    laserBallY = 130;
    laserBallSpeedX = (Math.random() > 0.5 ? 1 : -1) * 7;
    laserBallSpeedY = 4 + (Math.random() - 0.5) * 2;
    // 3D: reset ballZ and speedZ
    ballZ = 0.5;
    ballSpeedZ = (Math.random() - 0.5) * 0.12;
    laserActive = false;
    laserFiring = false;
    laserCharge = 0;
    laserFlash = 0;
    hitCount = 0;
    leftAbilityReady = true;
    rightAbilityReady = true;
    leftAbilityActive = false;
    rightAbilityActive = false;
    leftAbilityTimer = 0;
    rightAbilityTimer = 0;
    // 3D: reset paddles z
    leftPaddleZ = 0.5;
    rightPaddleZ = 0.5;
}

function getPaddleHeight(isLeft) {
    let h = paddleHeight;
    if (isLeft && leftAbilityActive) h += ABILITY_PADDLE_BOOST;
    if (!isLeft && rightAbilityActive) h += ABILITY_PADDLE_BOOST;
    return h;
}

function predictLaserBallY() {
    // Predict where the ball will be when it reaches the left paddle
    let x = laserBallX;
    let y = laserBallY;
    let vx = laserBallSpeedX;
    let vy = laserBallSpeedY;
    let r = laserBallRadius;
    while (vx < 0 && x - r > paddleWidth) {
        let t = (x - r - paddleWidth) / -vx;
        let newY = y + vy * t;
        if (newY - r < 0) {
            vy = -vy;
            y = r;
        } else if (newY + r > canvas.height) {
            vy = -vy;
            y = canvas.height - r;
        } else {
            y = newY;
            x = paddleWidth + r;
        }
    }
    return y;
}

function update() {
    // Move paddles
    if (upPressed && rightPaddleY > 0) rightPaddleY -= paddleSpeed;
    if (downPressed && rightPaddleY < canvas.height - paddleHeight) rightPaddleY += paddleSpeed;
    // 3D: Right paddle z-axis (only in its half: 0.5 to 1)
    if (rightZNegPressed) rightPaddleZ -= paddleZSpeed;
    if (rightZPosPressed) rightPaddleZ += paddleZSpeed;
    rightPaddleZ = Math.max(0.5, Math.min(1, rightPaddleZ));
    if (twoPlayerMode) {
        if (leftUpPressed && leftPaddleY > 0) leftPaddleY -= paddleSpeed;
        if (leftDownPressed && leftPaddleY < canvas.height - paddleHeight) leftPaddleY += paddleSpeed;
        // 3D: Left paddle z-axis (only in its half: 0 to 0.5)
        if (leftZNegPressed) leftPaddleZ -= paddleZSpeed;
        if (leftZPosPressed) leftPaddleZ += paddleZSpeed;
        leftPaddleZ = Math.max(0, Math.min(0.5, leftPaddleZ));
    } else {
        // Improved AI for left paddle
        let targetY = predictLaserBallY() - getPaddleHeight(true) / 2;
        if (leftPaddleY < targetY - 6) {
            leftPaddleY += paddleSpeed * aiSpeedMultiplier;
        } else if (leftPaddleY > targetY + 6) {
            leftPaddleY -= paddleSpeed * aiSpeedMultiplier;
        }
        // Clamp
        if (leftPaddleY < 0) leftPaddleY = 0;
        if (leftPaddleY > canvas.height - getPaddleHeight(true)) leftPaddleY = canvas.height - getPaddleHeight(true);
        // 3D: AI z follows ball z in left half
        if (ballZ < 0.5) {
            if (leftPaddleZ < ballZ - 0.03) leftPaddleZ += paddleZSpeed * aiSpeedMultiplier;
            else if (leftPaddleZ > ballZ + 0.03) leftPaddleZ -= paddleZSpeed * aiSpeedMultiplier;
            leftPaddleZ = Math.max(0, Math.min(0.5, leftPaddleZ));
        }
    }
    // 3D: Move paddles (z)
    if (rightInPressed && rightPaddleZ < 1) rightPaddleZ += paddleZSpeed;
    if (rightOutPressed && rightPaddleZ > 0.5) rightPaddleZ -= paddleZSpeed;
    if (twoPlayerMode) {
        if (leftInPressed && leftPaddleZ < 0.5) leftPaddleZ += paddleZSpeed;
        if (leftOutPressed && leftPaddleZ > 0) leftPaddleZ -= paddleZSpeed;
    } else {
        // AI for left paddle (z)
        let targetZ = ballZ < 0.5 ? ballZ : 0.25;
        if (leftPaddleZ < targetZ - 0.03) leftPaddleZ += paddleZSpeed * aiSpeedMultiplier;
        else if (leftPaddleZ > targetZ + 0.03) leftPaddleZ -= paddleZSpeed * aiSpeedMultiplier;
        if (leftPaddleZ < 0) leftPaddleZ = 0;
        if (leftPaddleZ > 0.5) leftPaddleZ = 0.5;
    }
    if (rightPaddleZ < 0.5) rightPaddleZ = 0.5;
    if (rightPaddleZ > 1) rightPaddleZ = 1;
    if (leftPaddleZ < 0) leftPaddleZ = 0;
    if (leftPaddleZ > 0.5) leftPaddleZ = 0.5;

    // Laser charge-up
    if (!laserActive && laserFiring) {
        laserCharge += 0.04;
        if (laserCharge >= 1) {
            laserActive = true;
            laserFiring = false;
            laserFlash = 1.2;
            playLaserSound();
        }
    }
    // Laser flash decay
    if (laserFlash > 0) {
        laserFlash -= 0.08;
        if (laserFlash < 0) laserFlash = 0;
    }
    // Move laser ball if active
    if (laserActive) {
        laserBallX += laserBallSpeedX;
        laserBallY += laserBallSpeedY;
        // 3D: Move ball z
        ballZ += ballSpeedZ;
        // Clamp ballZ to [0,1]
        if (ballZ < 0) { ballZ = 0; ballSpeedZ = -ballSpeedZ; }
        if (ballZ > 1) { ballZ = 1; ballSpeedZ = -ballSpeedZ; }

        // Collisions with top/bottom
        if (laserBallY - laserBallRadius < 0 || laserBallY + laserBallRadius > canvas.height) {
            laserBallSpeedY = -laserBallSpeedY;
        }

        // Collisions with paddles
        let hit = false;
        // Right paddle
        let rightH = getPaddleHeight(false);
        // 3D: Check z-overlap for right paddle
        if (
            laserBallX + laserBallRadius > canvas.width - paddleWidth &&
            laserBallY > rightPaddleY &&
            laserBallY < rightPaddleY + rightH &&
            Math.abs(ballZ - rightPaddleZ) < 0.13 // z-collision threshold
        ) {
            laserBallSpeedX = -laserBallSpeedX;
            laserBallX = canvas.width - paddleWidth - laserBallRadius;
            // 3D: Add some z-spin
            ballSpeedZ += (ballZ - rightPaddleZ) * 0.08;
            hit = true;
        }
        // Left paddle
        let leftH = getPaddleHeight(true);
        if (
            laserBallX - laserBallRadius < paddleWidth &&
            laserBallY > leftPaddleY &&
            laserBallY < leftPaddleY + leftH &&
            Math.abs(ballZ - leftPaddleZ) < 0.13
        ) {
            laserBallSpeedX = -laserBallSpeedX;
            laserBallX = paddleWidth + laserBallRadius;
            ballSpeedZ += (ballZ - leftPaddleZ) * 0.08;
            hit = true;
        }
        if (hit) {
            hitCount++;
            if (hitCount % 2 === 0) {
                laserBallSpeedX *= 1.2; // was 1.1, now 1.2 for more challenge
                laserBallSpeedY *= 1.2;
                ballSpeedZ *= 1.1;
            }
        }

        // Score
        if (laserBallX - laserBallRadius < 0) {
            rightScore++;
            resetLaserBall();
            gameRunning = false;
            if (startOverlay) startOverlay.style.display = 'flex';
            cancelAnimationFrame(animationId);
        }
        if (laserBallX + laserBallRadius > canvas.width) {
            leftScore++;
            resetLaserBall();
            gameRunning = false;
            if (startOverlay) startOverlay.style.display = 'flex';
            cancelAnimationFrame(animationId);
        }
    }

    // Ability timers
    if (leftAbilityActive) {
        leftAbilityTimer--;
        if (leftAbilityTimer <= 0) leftAbilityActive = false;
    }
    if (rightAbilityActive) {
        rightAbilityTimer--;
        if (rightAbilityTimer <= 0) rightAbilityActive = false;
    }
    // Black Hole feedback timer
    if (blackHoleFeedbackTimer > 0) blackHoleFeedbackTimer--;
}

// Ability effect: Black Hole
let blackHoleFeedbackTimer = 0;
let blackHoleFeedbackSide = null;
let blackHoleFailSound = null;
let blackHoleEffectActive = false;
let blackHoleEffectX = 0;
let blackHoleEffectY = 0;
let blackHoleEffectTimer = 0;

function playBlackHoleFailSound() {
    if (!blackHoleFailSound) {
        blackHoleFailSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7e2.mp3'); // fallback: use same as laser, or pick a different one
    }
    blackHoleFailSound.currentTime = 0;
    blackHoleFailSound.play();
}

function activateBlackHole(isLeft) {
    // Instantly pull the laser ball to the activating paddle and send it back (no animation)
    if (laserActive) {
        const targetX = isLeft ? paddleWidth + laserBallRadius + 2 : canvas.width - paddleWidth - laserBallRadius - 2;
        const targetY = isLeft ? leftPaddleY + getPaddleHeight(true) / 2 : rightPaddleY + getPaddleHeight(false) / 2;
        laserBallX = targetX;
        laserBallY = targetY;
        // 3D: set ballZ to paddle's z
        ballZ = isLeft ? leftPaddleZ : rightPaddleZ;
        laserFlash = 1.2;
        laserBallSpeedX = isLeft ? 11 : -11; // Much faster than normal
        laserBallSpeedY = (Math.random() - 0.5) * 10;
        // 3D: give ball a new z speed
        ballSpeedZ = (Math.random() - 0.5) * 0.18;
        playLaserSound();
        hitCount = 0;
        // Black hole visual effect
        blackHoleEffectActive = true;
        blackHoleEffectX = targetX;
        blackHoleEffectY = targetY;
        blackHoleEffectTimer = 32; // ~0.5s at 60fps
    } else {
        // Black Hole used at wrong time: show feedback and play error sound
        showBlackHoleError(isLeft);
    }
}

// Show feedback if Black Hole is used at the wrong time
function showBlackHoleError(isLeft) {
    // Visual feedback: show a floating message near the paddle
    const msg = document.createElement('div');
    msg.className = 'blackhole-error-msg';
    msg.textca
    msg.style.background = 'rgba(0,0,0,0.85)';
    msg.style.color = '#fff';
    msg.style.padding = '16px 32px';
    msg.style.borderRadius = '18px';
    msg.style.fontFamily = 'Orbitron, Arial, sans-serif';
    msg.style.fontSize = '1.1rem';
    msg.style.boxShadow = '0 4px 24px #00f0ff88';
    msg.style.pointerEvents = 'none';
    msg.style.transition = 'opacity 0.5s';
    msg.style.opacity = '1';
    // Wait for DOM to render, then set left position based on actual width
    setTimeout(() => {
        const width = msg.offsetWidth;
        let left = isLeft ? rect.left + 40 : rect.right - width - 40;
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        msg.style.left = left + 'px';
    }, 0);
    setTimeout(() => { msg.style.opacity = '0'; }, 1200);
    setTimeout(() => { msg.remove(); }, 1800);
    // Play error sound
    playBlackHoleErrorSound();
}

function playBlackHoleErrorSound() {
    const errSound = new Audio('https://cdn.pixabay.com/audio/2022/10/16/audio_12b6b7b2e2.mp3');
    errSound.volume = 0.5;
    errSound.play();
}

function drawBlackHoleFeedback() {
    if (blackHoleFeedbackTimer > 0) {
        ctx.save();
        ctx.font = 'bold 24px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, blackHoleFeedbackTimer / 30);
        ctx.fillStyle = '#ff5252';
        let x, y;
        if (blackHoleFeedbackSide === 'left') {
            x = canvas.width / 4;
            y = canvas.height / 2;
        } else if (blackHoleFeedbackSide === 'right') {
            x = 3 * canvas.width / 4;
            y = canvas.height / 2;
        } else {
            x = canvas.width / 2;
            y = canvas.height / 2;
        }
        ctx.fillText('Black Hole not ready!', x, y);
        ctx.restore();
    }
}

function drawBlackHoleEffect() {
    if (blackHoleEffectActive && blackHoleEffectTimer > 0) {
        ctx.save();
        // Animate size and distortion
        const t = 1 - blackHoleEffectTimer / 32;
        const maxRadius = Math.max(canvas.width, canvas.height) * 0.45;
        const radius = maxRadius * (0.7 + 0.3 * Math.sin(t * Math.PI));
        // Black core
        ctx.beginPath();
        ctx.arc(blackHoleEffectX, blackHoleEffectY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 60;
        ctx.fill();
        // Accretion disk
        let grad = ctx.createRadialGradient(blackHoleEffectX, blackHoleEffectY, radius * 0.7, blackHoleEffectX, blackHoleEffectY, radius * 1.1);
        grad.addColorStop(0, 'rgba(0,0,0,0.0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.0)');
        grad.addColorStop(0.85, 'rgba(0,255,255,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0.0)');
        ctx.beginPath();
        ctx.arc(blackHoleEffectX, blackHoleEffectY, radius * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Gravitational lensing (subtle)
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(blackHoleEffectX, blackHoleEffectY, radius * 1.25, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 16;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 40;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.restore();
        blackHoleEffectTimer--;
        if (blackHoleEffectTimer <= 0) blackHoleEffectActive = false;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawSpaceship();
    drawPaddle(0, leftPaddleY, true, leftPaddleZ); // 3D: pass z
    drawPaddle(canvas.width - paddleWidth, rightPaddleY, false, rightPaddleZ); // 3D: pass z
    drawBlackHoleEffect();
    if (laserFiring) drawLaserCharge();
    if (laserActive || laserFlash > 0) drawBall(); // 3D: drawBall uses z
    drawScore();
    drawBlackHoleFeedback();
}

function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

// DOMContentLoaded event to ensure elements exist before accessing them
document.addEventListener('DOMContentLoaded', () => {
    const startOverlay = document.getElementById('startOverlay');
    const onePlayerBtn = document.getElementById('onePlayerBtn');
    const twoPlayerBtn = document.getElementById('twoPlayerBtn');
    const difficultyOverlay = document.getElementById('difficultyOverlay');
    const easyBtn = document.getElementById('easyBtn');
    const mediumBtn = document.getElementById('mediumBtn');
    const abilityOverlay = document.getElementById('abilityOverlay');
    const blackHoleBtn = document.getElementById('blackHoleBtn');
    const lightSpeedBtn = document.getElementById('lightSpeedBtn');
    const reinforceBtn = document.getElementById('reinforceBtn');
    const abilityTooltip = document.getElementById('abilityTooltip');

    function showAbilityOverlay(player) {
        abilityOverlay.style.display = 'flex';
        abilityOverlay.dataset.player = player;
    }
    function hideAbilityOverlay() {
        abilityOverlay.style.display = 'none';
        abilityOverlay.dataset.player = '';
    }

    function showTooltip(e) {
        const desc = e.target.getAttribute('data-desc');
        if (!desc) return;
        abilityTooltip.textContent = desc;
        abilityTooltip.style.display = 'block';
        const rect = e.target.getBoundingClientRect();
        abilityTooltip.style.left = (rect.left + rect.width / 2 - abilityTooltip.offsetWidth / 2) + 'px';
        abilityTooltip.style.top = (rect.bottom + 8) + 'px';
    }
    function moveTooltip(e) {
        if (abilityTooltip.style.display === 'block') {
            const rect = e.target.getBoundingClientRect();
            abilityTooltip.style.left = (rect.left + rect.width / 2 - abilityTooltip.offsetWidth / 2) + 'px';
            abilityTooltip.style.top = (rect.bottom + 8) + 'px';
        }
    }
    function hideTooltip() {
        abilityTooltip.style.display = 'none';
    }

    if (onePlayerBtn) {
        onePlayerBtn.addEventListener('click', () => {
            twoPlayerMode = false;
            if (startOverlay) startOverlay.style.display = 'none';
            if (difficultyOverlay) difficultyOverlay.style.display = 'flex';
        });
    }
    if (twoPlayerBtn) {
        twoPlayerBtn.addEventListener('click', () => {
            twoPlayerMode = true;
            if (startOverlay) startOverlay.style.display = 'none';
            if (abilityOverlay) showAbilityOverlay('both');
        });
    }
    function startGameWithDifficulty(diff) {
        aiDifficulty = diff;
        if (diff === 'easy') aiSpeedMultiplier = 0.7;
        else if (diff === 'medium') aiSpeedMultiplier = 1.1;
        if (difficultyOverlay) difficultyOverlay.style.display = 'none';
        if (abilityOverlay) showAbilityOverlay('left');
    }
    if (easyBtn) easyBtn.addEventListener('click', () => startGameWithDifficulty('easy'));
    if (mediumBtn) {
        setTimeout(() => { mediumBtn.textContent = 'Hard'; }, 0);
        mediumBtn.addEventListener('click', () => startGameWithDifficulty('medium'));
    }

    function selectAbility(type) {
        if (abilityOverlay.dataset.player === 'left') {
            leftAbilityType = type;
            hideAbilityOverlay();
            // Start game after ability selection in 1P
            if (!gameRunning) {
                gameRunning = true;
                if (!laserActive && !laserFiring) {
                    resetLaserBall();
                    laserFiring = true;
                }
                gameLoop();
            }
        } else if (abilityOverlay.dataset.player === 'both') {
            // For 2P, assign both to same for now (can be extended for per-player selection)
            leftAbilityType = type;
            rightAbilityType = type;
            hideAbilityOverlay();
            if (!gameRunning) {
                gameRunning = true;
                if (!laserActive && !laserFiring) {
                    resetLaserBall();
                    laserFiring = true;
                }
                gameLoop();
            }
        }
    }
    if (blackHoleBtn) blackHoleBtn.addEventListener('click', () => selectAbility('blackhole'));
    if (lightSpeedBtn) lightSpeedBtn.addEventListener('click', () => selectAbility('lightspeed'));
    if (reinforceBtn) reinforceBtn.addEventListener('click', () => selectAbility('reinforce'));
    // On load, show overlay and draw initial state
    if (startOverlay) {
        startOverlay.style.display = 'flex';
    }
    resetLaserBall();
    draw();

    document.querySelectorAll('.ability-btn').forEach(btn => {
        btn.addEventListener('mouseenter', showTooltip);
        btn.addEventListener('mousemove', moveTooltip);
        btn.addEventListener('mouseleave', hideTooltip);
        btn.addEventListener('focus', showTooltip);
        btn.addEventListener('blur', hideTooltip);
    });
});
