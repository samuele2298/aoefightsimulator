const TEAM_COLORS = {
  A: '#4aa3ff',
  B: '#ff6b5d',
};

const UNIT_STATE_HIGHLIGHTS = {
  charge: '#ffd84a',
};

const DEFAULT_ZOOM = 2.5;

export function createBattlefieldRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const iconCache = new Map();
  const imageCache = new Map();

  let mapSize = { width: 120, height: 72 };
  let latestUnits = [];
  let latestObstacles = [];
  let teamMeta = {
    A: { civAbbr: 'A', civName: 'Team A', banner: '' },
    B: { civAbbr: 'B', civName: 'Team B', banner: '' },
  };
  let animationId = null;
  let zoom = DEFAULT_ZOOM;
  let cameraX = mapSize.width / 2;
  let cameraY = mapSize.height / 2;
  let dragState = null;

  canvas.style.touchAction = 'none';

  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.round(rect.width * dpr);
    const displayHeight = Math.round(rect.height * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getViewport() {
    const padding = 42;
    const usableWidth = canvas.width - padding * 2;
    const usableHeight = canvas.height - padding * 2;
    const baseScale = Math.min(usableWidth / mapSize.width, usableHeight / mapSize.height);
    const scale = baseScale * zoom;

    const visibleWorldWidth = canvas.width / scale;
    const visibleWorldHeight = canvas.height / scale;

    const minX = visibleWorldWidth / 2;
    const maxX = Math.max(minX, mapSize.width - visibleWorldWidth / 2);
    const minY = visibleWorldHeight / 2;
    const maxY = Math.max(minY, mapSize.height - visibleWorldHeight / 2);

    cameraX = clamp(cameraX, minX, maxX);
    cameraY = clamp(cameraY, minY, maxY);

    return {
      scale,
      offsetX: canvas.width / 2 - cameraX * scale,
      offsetY: canvas.height / 2 - cameraY * scale,
    };
  }

  function canDragNavigate() {
    return zoom > 1.001;
  }

  function updateCursor() {
    canvas.classList.toggle('is-draggable', canDragNavigate() && !dragState);
    canvas.classList.toggle('is-dragging', Boolean(dragState));
  }

  function toCanvas(x, y) {
    const viewport = getViewport();
    return {
      x: viewport.offsetX + x * viewport.scale,
      y: viewport.offsetY + y * viewport.scale,
    };
  }

  function getIcon(iconKey) {
    if (!iconKey) {
      return null;
    }
    if (!iconCache.has(iconKey)) {
      const img = new Image();
      img.src = `/data/images/units/${iconKey}`;
      iconCache.set(iconKey, img);
    }
    return iconCache.get(iconKey);
  }

  function getImage(src) {
    if (!src) {
      return null;
    }
    if (!imageCache.has(src)) {
      const img = new Image();
      img.src = src;
      imageCache.set(src, img);
    }
    return imageCache.get(src);
  }

  function drawBackgroundGrid() {
    const viewport = getViewport();
    const width = mapSize.width * viewport.scale;
    const height = mapSize.height * viewport.scale;

    ctx.strokeStyle = 'rgba(214, 186, 131, 0.14)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= mapSize.width; i += 5) {
      const x = viewport.offsetX + i * viewport.scale;
      ctx.beginPath();
      ctx.moveTo(x, viewport.offsetY);
      ctx.lineTo(x, viewport.offsetY + height);
      ctx.stroke();
    }

    for (let i = 0; i <= mapSize.height; i += 5) {
      const y = viewport.offsetY + i * viewport.scale;
      ctx.beginPath();
      ctx.moveTo(viewport.offsetX, y);
      ctx.lineTo(viewport.offsetX + width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(247, 222, 171, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(viewport.offsetX, viewport.offsetY, width, height);
  }

  function drawObstacles() {
    const viewport = getViewport();

    const styleMap = {
      forest: {
        fill: 'rgba(45, 96, 52, 0.62)',
        stroke: 'rgba(123, 184, 106, 0.82)',
      },
      rock: {
        fill: 'rgba(87, 95, 107, 0.62)',
        stroke: 'rgba(172, 181, 196, 0.82)',
      },
      water: {
        fill: 'rgba(38, 92, 130, 0.58)',
        stroke: 'rgba(116, 182, 224, 0.82)',
      },
      ruin: {
        fill: 'rgba(106, 82, 54, 0.6)',
        stroke: 'rgba(192, 162, 117, 0.82)',
      },
      landmark: {
        fill: 'rgba(142, 108, 64, 0.58)',
        stroke: 'rgba(230, 197, 129, 0.9)',
      },
    };

    for (const obstacle of latestObstacles) {
      const point = toCanvas(obstacle.x, obstacle.y);
      const obstacleStyle = styleMap[obstacle.style] || styleMap.forest;

      ctx.fillStyle = obstacleStyle.fill;
      ctx.strokeStyle = obstacleStyle.stroke;

      if (obstacle.shape === 'square' && typeof obstacle.size === 'number') {
        const size = obstacle.size * viewport.scale;
        ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
      } else {
        const radius = obstacle.radius * viewport.scale;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawUnit(unit) {
    if (unit.hp <= 0) {
      return;
    }

    const point = toCanvas(unit.x, unit.y);
    const size = clamp(14 * zoom + 8, 16, 46);
    const hasChargeHighlight = Boolean(unit.chargeActive);
    const highlightColor = hasChargeHighlight
      ? UNIT_STATE_HIGHLIGHTS.charge
      : TEAM_COLORS[unit.team];

    ctx.fillStyle = `${highlightColor}33`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${highlightColor}dd`;
    ctx.lineWidth = hasChargeHighlight ? 2.6 : 1.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    const icon = getIcon(unit.iconKey);
    if (icon && icon.complete) {
      ctx.save();
      ctx.drawImage(icon, point.x - size / 2, point.y - size / 2, size, size);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `${highlightColor}55`;
      ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = highlightColor || '#ddd';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    const hpRatio = Math.max(0, Math.min(1, unit.maxHp > 0 ? unit.hp / unit.maxHp : 0));
    const barWidth = 26;
    const barHeight = 4;
    const barX = point.x - barWidth / 2;
    const barY = point.y + size * 0.65;

    ctx.fillStyle = '#2d1d1d';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = hpRatio > 0.5 ? '#3dcf7e' : hpRatio > 0.2 ? '#d2c14b' : '#d95b5b';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
  }

  function buildLegendRows(team) {
    const counts = new Map();

    for (const unit of latestUnits) {
      if (unit.team !== team || unit.hp <= 0) {
        continue;
      }
      const key = unit.unitId || unit.name;
      if (!counts.has(key)) {
        counts.set(key, {
          name: unit.name || key,
          iconKey: unit.iconKey,
          count: 0,
          unitCost: unit.resourceValue || 0,
          totalCost: 0,
        });
      }
      const row = counts.get(key);
      row.count += 1;
      row.totalCost = row.count * row.unitCost;
    }

    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }

  function drawLegendBlock(team, x, y, widthOverride = null) {
    const meta = teamMeta[team] || { civAbbr: team, civName: `Team ${team}`, banner: '' };
    const banner = getImage(meta.banner);
    const rows = buildLegendRows(team);
    const teamUnits = latestUnits.filter((unit) => unit.team === team);
    const totalUnits = teamUnits.length;
    const alive = teamUnits.filter((unit) => unit.hp > 0).length;
    const aliveRatio = totalUnits > 0 ? alive / totalUnits : 0;
    const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0);
    const width = widthOverride || 392;
    const headerHeight = 50;
    const progressBlockHeight = 30;
    const rowHeight = 34;
    const rowsStartY = y + headerHeight + progressBlockHeight + 18;
    const height = rowsStartY + rows.length * rowHeight - y;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
    panelGradient.addColorStop(0, 'rgba(15, 22, 34, 0.60)');
    panelGradient.addColorStop(1, 'rgba(11, 16, 25, 0.34)');
    ctx.fillStyle = panelGradient;
    ctx.strokeStyle = `${TEAM_COLORS[team]}88`;
    ctx.lineWidth = 1.1;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 16);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = `${TEAM_COLORS[team]}24`;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, width - 2, headerHeight - 1, 16);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, width, headerHeight);
    }
    ctx.restore();

    if (banner && banner.complete) {
      ctx.drawImage(banner, x + 12, y + 11, 48, 28);
    } else {
      ctx.fillStyle = `${TEAM_COLORS[team]}80`;
      ctx.fillRect(x + 12, y + 11, 48, 28);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 15px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(`${meta.civName} (${meta.civAbbr.toUpperCase()})`, x + 68, y + 27);
    ctx.fillStyle = '#cfd6e4';
    ctx.font = '12px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(`Team ${team}  •  Alive ${alive}  •  Value ${totalCost}`, x + 68, y + 43);

    const progressLabelY = y + headerHeight + 14;
    ctx.fillStyle = '#cfd6e4';
    ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(
      `Survivors ${alive}/${totalUnits || 0} (${Math.round(aliveRatio * 100)}%)`,
      x + 14,
      progressLabelY
    );

    const barX = x + 14;
    const barY = progressLabelY + 6;
    const barWidth = width - 28;
    const barHeight = 10;
    ctx.fillStyle = 'rgba(228, 233, 243, 0.16)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 999);
      ctx.fill();
    } else {
      ctx.fillRect(barX, barY, barWidth, barHeight);
    }

    const fillWidth = Math.max(0, Math.min(barWidth, barWidth * aliveRatio));
    if (fillWidth > 0) {
      const fillGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      fillGradient.addColorStop(0, `${TEAM_COLORS[team]}aa`);
      fillGradient.addColorStop(1, `${TEAM_COLORS[team]}ff`);
      ctx.fillStyle = fillGradient;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillWidth, barHeight, 999);
        ctx.fill();
      } else {
        ctx.fillRect(barX, barY, fillWidth, barHeight);
      }
    }

    ctx.strokeStyle = 'rgba(228, 233, 243, 0.10)';
    ctx.beginPath();
    ctx.moveTo(x + 14, y + headerHeight + progressBlockHeight + 2);
    ctx.lineTo(x + width - 14, y + headerHeight + progressBlockHeight + 2);
    ctx.stroke();

    rows.forEach((row, idx) => {
      const lineY = rowsStartY + idx * rowHeight;
      const icon = getIcon(row.iconKey);
      if (icon && icon.complete) {
        ctx.drawImage(icon, x + 14, lineY - 17, 24, 24);
      } else {
        ctx.fillStyle = TEAM_COLORS[team];
        ctx.beginPath();
        ctx.arc(x + 26, lineY - 5, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#edf2fb';
      ctx.font = '600 14px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(row.name, x + 46, lineY - 1);
      ctx.fillStyle = '#f7d58f';
      ctx.font = '13px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`x${row.count}   ${row.totalCost}`, x + width - 14, lineY - 1);
      ctx.textAlign = 'left';

      if (idx < rows.length - 1) {
        ctx.strokeStyle = 'rgba(228, 233, 243, 0.08)';
        ctx.beginPath();
        ctx.moveTo(x + 14, lineY + 10);
        ctx.lineTo(x + width - 14, lineY + 10);
        ctx.stroke();
      }
    });

    return {
      width,
      height,
    };
  }

  function drawZoomBadge() {
    const label = `Zoom x${zoom.toFixed(2)}`;
    ctx.save();
    ctx.font = '600 12px "Trebuchet MS", "Segoe UI", sans-serif';
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + 26;
    const boxHeight = 28;
    const x = canvas.width / 2 - boxWidth / 2;
    const y = canvas.height - boxHeight - 14;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(12, 14, 20, 0.88)';
    ctx.strokeStyle = 'rgba(247, 222, 171, 0.7)';
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, boxWidth, boxHeight, 999);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, boxWidth, boxHeight);
      ctx.strokeRect(x, y, boxWidth, boxHeight);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 13, y + boxHeight / 2 + 0.5);
    ctx.restore();
  }

  function renderFrame() {
    resizeCanvasToDisplaySize();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackgroundGrid();
    drawObstacles();

    for (const unit of latestUnits) {
      drawUnit(unit);
    }

    const legendGap = 10;
    const maxLegendWidth = Math.min(392, Math.max(220, Math.floor((canvas.width - legendGap * 3) / 2)));
    const enoughForTwoColumns = canvas.width >= (maxLegendWidth * 2 + legendGap * 3);

    const leftLegend = drawLegendBlock('A', legendGap, legendGap, maxLegendWidth);
    if (enoughForTwoColumns) {
      drawLegendBlock('B', canvas.width - maxLegendWidth - legendGap, legendGap, maxLegendWidth);
    } else {
      const nextY = legendGap + (leftLegend ? leftLegend.height + 8 : 8);
      drawLegendBlock('B', legendGap, nextY, maxLegendWidth);
    }
    drawZoomBadge();

    animationId = requestAnimationFrame(renderFrame);
  }

  function setMapSize(size) {
    if (size && size.width && size.height) {
      mapSize = size;
      cameraX = mapSize.width / 2;
      cameraY = mapSize.height / 2;
    }
  }

  function setUnits(units) {
    latestUnits = Array.isArray(units) ? units : [];
  }

  function setZoom(value) {
    zoom = clamp(Number(value) || DEFAULT_ZOOM, 0.6, 7.5);
    updateCursor();
  }

  function getZoom() {
    return zoom;
  }

  function setObstacles(obstacles) {
    latestObstacles = Array.isArray(obstacles) ? obstacles : [];
  }

  function setTeamMeta(meta) {
    if (meta && meta.A && meta.B) {
      teamMeta = meta;
    }
  }

  function pan(deltaX, deltaY) {
    cameraX += deltaX;
    cameraY += deltaY;
    getViewport();
  }

  function resetView() {
    zoom = DEFAULT_ZOOM;
    cameraX = mapSize.width / 2;
    cameraY = mapSize.height / 2;
    updateCursor();
  }

  function reset() {
    latestUnits = [];
    latestObstacles = [];
    resetView();
  }

  function start() {
    if (!animationId) {
      animationId = requestAnimationFrame(renderFrame);
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!canDragNavigate() || event.button !== 0) {
      return;
    }

    dragState = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };

    canvas.setPointerCapture(event.pointerId);
    updateCursor();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const viewport = getViewport();
    const deltaX = event.clientX - dragState.lastX;
    const deltaY = event.clientY - dragState.lastY;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;

    pan(-deltaX / viewport.scale, -deltaY / viewport.scale);
  });

  function endDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState = null;
    updateCursor();
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', () => {
    dragState = null;
    updateCursor();
  });

  updateCursor();

  window.addEventListener('resize', resizeCanvasToDisplaySize);

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  return {
    start,
    stop,
    reset,
    setUnits,
    setMapSize,
    setObstacles,
    setTeamMeta,
    setZoom,
    getZoom,
    pan,
    resetView,
  };
}
