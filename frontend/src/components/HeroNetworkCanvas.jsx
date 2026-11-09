import React, { useEffect, useRef } from 'react';

export default function HeroNetworkCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const mouse = { x: -1000, y: -1000, radius: 90 };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Subtle, controlled node density - avoid excessive floating clutter
    const nodeCount = Math.min(22, Math.max(12, Math.floor(width / 55)));
    const nodes = [];

    // Subtle neutral grey network nodes
    const nodeTypes = [
      { fill: '#777D87', stroke: 'rgba(176, 179, 186, 0.35)', r: 2.5 },
      { fill: '#555B66', stroke: 'rgba(119, 125, 135, 0.30)', r: 2.25 },
      { fill: '#8C929E', stroke: 'rgba(176, 179, 186, 0.25)', r: 2.75 },
    ];

    for (let i = 0; i < nodeCount; i++) {
      const type = nodeTypes[i % nodeTypes.length];
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.18,
        vy: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.18,
        radius: type.r,
        fill: type.fill,
        stroke: type.stroke,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Connect near nodes with subtle, low-motion grey lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.14;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(119, 125, 135, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw and move nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!prefersReducedMotion) {
          n.x += n.vx;
          n.y += n.vy;

          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;

          // Gentle mouse reaction
          const mdx = mouse.x - n.x;
          const mdy = mouse.y - n.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < mouse.radius) {
            const force = (1 - mDist / mouse.radius) * 0.8;
            n.x -= (mdx / (mDist || 1)) * force;
            n.y -= (mdy / (mDist || 1)) * force;
          }
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.fill;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = n.stroke;
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto opacity-60"
      style={{
        width: '100%',
        height: '100%',
        maskImage: 'linear-gradient(to bottom, black 50%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 95%)',
      }}
    />
  );
}
