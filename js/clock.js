// SVG Analog Clock — mirrors AnalogStopwatchView
function createClock(color) {
  const size = 160;
  const dialSize = size * 0.82;
  const radius = dialSize / 2;
  const tickInset = dialSize * 0.12;
  const labelRadius = radius + dialSize * 0.08;
  const cx = size / 2;
  const cy = size / 2;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);

  // Dial background
  const dialBg = document.createElementNS(ns, 'circle');
  dialBg.setAttribute('cx', cx);
  dialBg.setAttribute('cy', cy);
  dialBg.setAttribute('r', radius);
  dialBg.setAttribute('fill', color);
  dialBg.classList.add('dial-fill');
  svg.appendChild(dialBg);

  // Dial stroke
  const dialStroke = document.createElementNS(ns, 'circle');
  dialStroke.setAttribute('cx', cx);
  dialStroke.setAttribute('cy', cy);
  dialStroke.setAttribute('r', radius);
  dialStroke.setAttribute('fill', 'none');
  dialStroke.setAttribute('stroke', color);
  dialStroke.classList.add('dial-stroke');
  dialStroke.setAttribute('stroke-width', '2');
  svg.appendChild(dialStroke);

  // Tick marks
  for (let i = 0; i < 60; i++) {
    const isMajor = i % 5 === 0;
    const tickH = isMajor ? dialSize * 0.08 : dialSize * 0.045;
    const tickW = isMajor ? 3 : 1.5;
    const angle = (i / 60) * 360;
    const r1 = radius - tickInset;
    const r2 = r1 + tickH;

    const rad = (angle - 90) * Math.PI / 180;
    const x1 = cx + (radius - tickInset) * Math.cos(rad);
    const y1 = cy + (radius - tickInset) * Math.sin(rad);
    const x2 = cx + (radius - tickInset + tickH) * Math.cos(rad);
    const y2 = cy + (radius - tickInset + tickH) * Math.sin(rad);

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', tickW);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', isMajor ? 0.9 : 0.45);
    svg.appendChild(line);
  }

  // Labels (0, 5, 10, ..., 55)
  const labels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  for (const value of labels) {
    const angle = (value / 60) * (2 * Math.PI) - (Math.PI / 2);
    const x = cx + Math.cos(angle) * labelRadius;
    const y = cy + Math.sin(angle) * labelRadius;

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', color);
    text.classList.add('clock-label');
    text.setAttribute('font-size', dialSize * 0.08);
    text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", system-ui, sans-serif');
    text.textContent = value;
    svg.appendChild(text);
  }

  // Minute hand
  const minuteHand = document.createElementNS(ns, 'rect');
  minuteHand.setAttribute('x', cx - 1.5);
  minuteHand.setAttribute('y', cy - dialSize * 0.28);
  minuteHand.setAttribute('width', 3);
  minuteHand.setAttribute('height', dialSize * 0.28);
  minuteHand.setAttribute('rx', 1.5);
  minuteHand.setAttribute('fill', color);
  minuteHand.setAttribute('opacity', 0.65);
  minuteHand.classList.add('minute-hand');
  svg.appendChild(minuteHand);

  // Second hand
  const secondHand = document.createElementNS(ns, 'rect');
  secondHand.setAttribute('x', cx - 1);
  secondHand.setAttribute('y', cy - dialSize * 0.38);
  secondHand.setAttribute('width', 2);
  secondHand.setAttribute('height', dialSize * 0.38);
  secondHand.setAttribute('rx', 1);
  secondHand.setAttribute('fill', color);
  secondHand.classList.add('second-hand');
  svg.appendChild(secondHand);

  // Center dot
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', cx);
  dot.setAttribute('cy', cy);
  dot.setAttribute('r', dialSize * 0.03);
  dot.setAttribute('fill', color);
  svg.appendChild(dot);

  return { svg, minuteHand, secondHand };
}

function updateClock(clock, time) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;

  const seconds = time % 60;
  const minutes = (time / 60) % 60;

  const secAngle = (seconds / 60) * 360;
  const minAngle = (minutes / 60) * 360;

  clock.secondHand.setAttribute('transform', `rotate(${secAngle}, ${cx}, ${cy})`);
  clock.minuteHand.setAttribute('transform', `rotate(${minAngle}, ${cx}, ${cy})`);
}
