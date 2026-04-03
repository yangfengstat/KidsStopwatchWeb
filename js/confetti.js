// Confetti celebration for streak milestones
const Confetti = (() => {
  const MILESTONE_DAYS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
  const COLORS = ['#ff6b9d', '#c44dff', '#6bb0e8', '#ffd93d', '#6bcb77', '#ff8c42', '#4ecdc4'];
  const PARTICLE_COUNT = 80;
  const DURATION = 3000;

  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;
  let startTime = 0;

  function isMilestone(streak) {
    return MILESTONE_DAYS.includes(streak);
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const isCircle = Math.random() > 0.5;
    return {
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      size: Math.random() * 8 + 4,
      color,
      isCircle,
      opacity: 1,
      gravity: 0.08 + Math.random() * 0.04,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.03 + Math.random() * 0.05,
    };
  }

  function launch() {
    ensureCanvas();
    resize();
    window.addEventListener('resize', resize);

    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle();
      // Stagger the start
      p.y = -20 - Math.random() * 200;
      particles.push(p);
    }

    startTime = performance.now();
    if (animationId) cancelAnimationFrame(animationId);
    animate();
  }

  function animate() {
    const elapsed = performance.now() - startTime;
    const fadeStart = DURATION * 0.6;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    for (const p of particles) {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.wobble += p.wobbleSpeed;
      p.x += Math.sin(p.wobble) * 0.5;

      // Fade out
      if (elapsed > fadeStart) {
        p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (DURATION - fadeStart));
      }

      if (p.y < canvas.height + 50 && p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.isCircle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
    }

    if (alive && elapsed < DURATION) {
      animationId = requestAnimationFrame(animate);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    window.removeEventListener('resize', resize);
    particles = [];
  }

  return { launch, isMilestone };
})();
