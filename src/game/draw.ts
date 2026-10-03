// ---------------------------------------------------------------------------
// IRON VANGUARD — canvas renderer
// ---------------------------------------------------------------------------
import type { Game } from './engine';
import { WORLD, PLAYER_TANK_MAP, tierSkin, clamp } from './types';
import type { BaseData, Obstacle, Tank } from './types';

// --- cached sprites --------------------------------------------------------
const glowCache = new Map<string, HTMLCanvasElement>();

function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  const size = 96;
  c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.fill();
  glowCache.set(color, c);
  return c;
}



function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
export function drawWorld(g: Game) {
  const ctx = g.ctx;
  const dpr = g.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#101722';
  ctx.fillRect(0, 0, g.cw, g.ch);

  const cam = g.cam;
  ctx.save();
  ctx.translate(g.cw / 2, g.ch / 2);
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x + cam.shakeX / cam.scale, -cam.y + cam.shakeY / cam.scale);

  const halfW = g.cw / cam.scale / 2 + 120;
  const halfH = g.ch / cam.scale / 2 + 120;
  const view = {
    x0: cam.x - halfW, x1: cam.x + halfW,
    y0: cam.y - halfH, y1: cam.y + halfH,
  };

  // terrain + decals
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(g.terrain, 0, 0, WORLD.w, WORLD.h);
  ctx.drawImage(g.decal, 0, 0, WORLD.w, WORLD.h);

  // world edge glow
  ctx.strokeStyle = 'rgba(120,200,255,0.10)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, WORLD.w - 10, WORLD.h - 10);

  drawBase(ctx, g.playerBase, g, view);
  drawBase(ctx, g.enemyBase, g, view);

  for (const o of g.obstacles) {
    if (o.x + o.w < view.x0 || o.x > view.x1 || o.y + o.h < view.y0 || o.y > view.y1) continue;
    if (o.kind === 'crate' && o.hp <= 0) continue;
    drawObstacle(ctx, o);
  }

  // ground-level particles
  drawParticles(ctx, g, true);

  for (const t of g.tanks) {
    if (t.dead) continue;
    if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
    drawTank(ctx, t, g);
  }

  drawBullets(ctx, g);
  drawParticles(ctx, g, false);
  drawReticle(ctx, g);
  ctx.restore();

  drawScreenFx(ctx, g);
}

// ---------------------------------------------------------------------------
function drawTank(ctx: CanvasRenderingContext2D, t: Tank, g: Game) {
  const r = t.r;
  const chassis = t.player ? PLAYER_TANK_MAP[g.selectedTank] : null;

  // ---- livery (reference palette) ----
  let body: string, accent: string, glowy: boolean;
  if (t.player) {
    body = chassis!.body; accent = chassis!.accent; glowy = t.twin;
  } else if (t.kind === 'boss') {
    body = '#4a4038'; accent = '#ff7a1a'; glowy = true;
  } else if (t.kind === 'bomber') {
    body = '#b5281f'; accent = '#ff6a2a'; glowy = true;
  } else {
    const sk = tierSkin(t.tier || 1);
    body = sk.body; accent = sk.accent; glowy = sk.glow;
  }
  const metal = '#363d47';
  const darkMetal = '#1b2026';
  const boss = t.kind === 'boss';

  const pop = t.spawnPop > 0 ? 1 + t.spawnPop * 0.5 : 1;
  ctx.save();
  ctx.translate(t.x, t.y);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(4, 8, r * 1.18, r * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(pop, pop);

  // =========================================================================
  // HULL + TREADS (rotated to movement direction)
  // =========================================================================
  ctx.save();
  ctx.rotate(t.angle);

  // chunky segmented treads with road wheels
  const treadW = r * 2.2, treadH = r * 0.56;
  for (const sy of [-1, 1]) {
    const ty = sy * (r * 0.82);
    ctx.fillStyle = darkMetal;
    rr(ctx, -treadW / 2, ty - treadH / 2, treadW, treadH, treadH * 0.32);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const links = boss ? 9 : 7;
    for (let i = 0; i < links; i++) {
      const lx = -treadW / 2 + (i + 0.5) * (treadW / links);
      ctx.fillRect(lx - (treadW / links) * 0.28, ty - treadH / 2 + 1.5, (treadW / links) * 0.56, treadH - 3);
    }
    ctx.fillStyle = metal;
    const wheels = boss ? 5 : 4;
    for (let i = 0; i < wheels; i++) {
      const wx = -treadW / 2 + (i + 0.5) * (treadW / wheels);
      ctx.beginPath(); ctx.arc(wx, ty, treadH * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // angular hull plate
  const hw = r * 0.96, hh = r * 0.78;
  const grd = ctx.createLinearGradient(0, -r, 0, r);
  grd.addColorStop(0, shade(body, 0.2));
  grd.addColorStop(0.5, body);
  grd.addColorStop(1, shade(body, -0.42));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(-hw, -hh);
  ctx.lineTo(hw * 0.7, -hh);
  ctx.lineTo(hw, -hh * 0.5);
  ctx.lineTo(hw, hh * 0.5);
  ctx.lineTo(hw * 0.7, hh);
  ctx.lineTo(-hw, hh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // top highlight plate + central panel line
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  rr(ctx, -hw * 0.8, -hh * 0.72, hw * 1.45, hh * 0.46, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.45, -hh); ctx.lineTo(-hw * 0.45, hh);
  ctx.stroke();

  // gold edge trim (navy tier 8 + boss)
  if (t.tier === 8 || boss) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = boss ? 3 : 2.2;
    ctx.beginPath();
    ctx.moveTo(hw * 0.7, -hh); ctx.lineTo(hw, -hh * 0.5);
    ctx.lineTo(hw, hh * 0.5); ctx.lineTo(hw * 0.7, hh);
    ctx.stroke();
  }

  // glowing energy strips for glow-tier / boss / double-shooter
  if (glowy) {
    ctx.globalCompositeOperation = 'lighter';
    for (const sy of [-1, 1]) {
      for (let i = 0; i < (boss ? 3 : 2); i++) {
        const gx = -hw * 0.5 + i * hw * 0.5;
        const gyy = sy * hh * 0.56;
        ctx.globalAlpha = 0.5 + Math.sin(g.playTime * 6 + i + sy) * 0.22;
        ctx.fillStyle = accent;
        rr(ctx, gx, gyy - 2.5, hw * 0.3, 5, 2.5);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // corner rivets
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (const rx of [-hw * 0.82, hw * 0.55]) {
    for (const ry of [-hh * 0.76, hh * 0.76]) {
      ctx.beginPath(); ctx.arc(rx, ry, r * 0.08, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // =========================================================================
  // TURRET + CANNON(S) (rotated to aim)
  // =========================================================================
  ctx.save();
  ctx.rotate(t.turret);
  const recoil = t.recoil * (boss ? 9 : 5);

  const bOffsets = t.twin ? [-r * 0.3, r * 0.3] : [0];
  for (const off of bOffsets) {
    const bl = r * (t.kind === 'sniper' ? 2.0 : boss ? 1.75 : 1.5);
    const bt = r * (boss ? 0.3 : 0.25);
    ctx.save();
    ctx.translate(0, off);
    const bg = ctx.createLinearGradient(0, -bt, 0, bt);
    bg.addColorStop(0, '#4a515c');
    bg.addColorStop(1, '#1c2128');
    ctx.fillStyle = bg;
    rr(ctx, r * 0.3 - recoil, -bt, bl, bt * 2, bt * 0.5);
    ctx.fill();
    // reinforcing band
    ctx.fillStyle = '#12161b';
    rr(ctx, r * 0.3 + bl * 0.42 - recoil, -bt * 1.15, bt * 0.5, bt * 2.3, 1);
    ctx.fill();
    // muzzle brake
    ctx.fillStyle = shade(accent, -0.08);
    rr(ctx, r * 0.3 + bl - recoil, -bt * 1.3, bt * 1.1, bt * 2.6, 2);
    ctx.fill();
    // hot barrel ember
    if (glowy) {
      ctx.globalCompositeOperation = 'lighter';
      const es = bt * 4;
      ctx.globalAlpha = 0.45 + Math.sin(g.playTime * 10 + off) * 0.2;
      ctx.drawImage(glow(accent), r * 0.3 + bl - recoil - es * 0.35, -es / 2, es, es);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // chunky hex turret
  const tr = r * (boss ? 0.78 : 0.72);
  const tgd = ctx.createRadialGradient(-tr * 0.3, -tr * 0.3, tr * 0.1, 0, 0, tr);
  tgd.addColorStop(0, shade(body, 0.3));
  tgd.addColorStop(1, shade(body, -0.4));
  ctx.fillStyle = tgd;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * tr, py = Math.sin(a) * tr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // mantlet
  ctx.fillStyle = shade(body, -0.25);
  rr(ctx, tr * 0.2, -tr * 0.5, tr * 0.7, tr, 3);
  ctx.fill();
  // commander hatch
  ctx.fillStyle = shade(accent, -0.05);
  ctx.beginPath(); ctx.arc(-tr * 0.15, 0, tr * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(-tr * 0.15, 0, tr * 0.22, 0, Math.PI * 2); ctx.fill();
  // turret rivets
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * tr * 0.74, Math.sin(a) * tr * 0.74, tr * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // hit flash
  if (t.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = t.hitFlash * 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // elite dashed ring
  if (t.elite) {
    const pulse = 0.5 + Math.sin(g.playTime * 6) * 0.3;
    ctx.strokeStyle = `rgba(255,215,90,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 9]);
    ctx.lineDashOffset = -g.playTime * 34;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // boss aura
  if (boss) {
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.35 + Math.sin(g.playTime * 4) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.drawImage(glow('#ff7a1a'), -r * 2.1, -r * 2.1, r * 4.2, r * 4.2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();

  if (t.elite) {
    ctx.font = 'bold 15px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('★', t.x, t.y - t.r - 22);
  }
  if (boss) {
    ctx.font = 'bold 13px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText('☠ WARLORD', t.x, t.y - t.r - 24);
    ctx.fillStyle = '#ff9a3a';
    ctx.fillText('☠ WARLORD', t.x, t.y - t.r - 24);
  }

  // health bar
  if (!t.player && t.hp < t.maxHp) {
    const w = Math.max(30, t.r * 2);
    const pct = clamp(t.hp / t.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(t.x - w / 2 - 1, t.y - t.r - 15, w + 2, 7);
    ctx.fillStyle = pct > 0.5 ? '#7ee08a' : pct > 0.25 ? '#ffd166' : '#ff5f6d';
    ctx.fillRect(t.x - w / 2, t.y - t.r - 14, w * pct, 5);
  }
  if (t.player && t.hp < t.maxHp) {
    const w = 52;
    const pct = clamp(t.hp / t.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(t.x - w / 2 - 1, t.y - t.r - 16, w + 2, 7);
    ctx.fillStyle = pct > 0.4 ? '#7ee08a' : '#ff5f6d';
    ctx.fillRect(t.x - w / 2, t.y - t.r - 15, w * pct, 5);
  }
}

// ---------------------------------------------------------------------------
function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, x + 5, y + 7, w, h, 6);
  ctx.fill();

  if (o.kind === 'crate') {
    const dmg = 1 - clamp(o.hp / o.maxHp, 0, 1);
    ctx.fillStyle = '#8a6a3d';
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = '#5b4626';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4);
    ctx.lineWidth = 3;
    ctx.stroke();
    if (dmg > 0.15) {
      ctx.strokeStyle = `rgba(20,10,0,${dmg})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.5, y + h * 0.6);
      ctx.stroke();
    }
    return;
  }

  if (o.kind === 'block') {
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, '#5b6675');
    grd.addColorStop(1, '#39424f');
    ctx.fillStyle = grd;
    rr(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 6, y + 8 + i * 12, w - 12, 4);
    }
    ctx.strokeStyle = 'rgba(255,190,90,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    return;
  }

  // rock — seeded jagged polygon
  const seed = o.seed;
  ctx.beginPath();
  const pts = 9;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wob = 0.82 + ((Math.sin(seed + i * 2.7) + 1) / 2) * 0.3;
    const px = x + w / 2 + Math.cos(a) * (w / 2) * wob;
    const py = y + h / 2 + Math.sin(a) * (h / 2) * wob;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grd = ctx.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, '#57627a');
  grd.addColorStop(1, '#2f3746');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.38, y + h * 0.32, w * 0.22, h * 0.16, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
function drawBase(ctx: CanvasRenderingContext2D, b: BaseData, g: Game, view: any) {
  if (b.x + b.w < view.x0 || b.x - b.w > view.x1) return;
  const mine = b.owner === 'p';
  const main = mine ? '#e0913c' : '#cf4057';
  const accent = mine ? '#ffd166' : '#ff8fa0';
  const x = b.x - b.w / 2, y = b.y - b.h / 2, w = b.w, h = b.h;
  const pct = clamp(b.hp / b.maxHp, 0, 1);

  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  rr(ctx, x + 8, y + 12, w, h, 10);
  ctx.fill();

  // outer wall
  const grd = ctx.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, shade(main, 0.1));
  grd.addColorStop(1, shade(main, -0.5));
  ctx.fillStyle = grd;
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // battlements
  ctx.fillStyle = shade(main, -0.25);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 10 + i * (w - 20) / 5 + 3, y - 8, 16, 12);
    ctx.fillRect(x + 10 + i * (w - 20) / 5 + 3, y + h - 4, 16, 12);
  }

  // inner plating
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, x + 22, y + 26, w - 44, h - 52, 8);
  ctx.fill();

  // core
  const corePulse = 0.6 + Math.sin(g.playTime * (b.alive ? 3.4 : 0) + (mine ? 0 : 1.6)) * 0.4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = b.alive ? 0.5 + corePulse * 0.4 : 0.15;
  ctx.drawImage(glow(accent), b.x - 60, b.y - 60, 120, 120);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
  ctx.fill();

  // damage cracks
  if (pct < 0.7) {
    ctx.strokeStyle = `rgba(10,6,4,${(1 - pct) * 0.9})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const sx = x + 20 + i * (w / 4);
      ctx.beginPath();
      ctx.moveTo(sx, y + 8);
      ctx.lineTo(sx + 14, y + h * 0.45);
      ctx.lineTo(sx - 6, y + h - 10);
      ctx.stroke();
    }
  }

  // turret
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.turret);
  ctx.fillStyle = '#2c3441';
  rr(ctx, 14, -8, 62, 16, 4);
  ctx.fill();
  ctx.fillStyle = accent;
  rr(ctx, 68, -10, 12, 20, 3);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = shade(main, -0.4);
  ctx.beginPath();
  ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  // hit flash
  if (b.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = b.hitFlash * 0.5;
    ctx.fillStyle = '#ffffff';
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // alarm ring
  if (b.alarm > 0 && mine) {
    const k = 1 - (b.alarm % 0.8) / 0.8;
    ctx.strokeStyle = `rgba(255,70,60,${0.75 * (1 - k)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 60 + k * 110, 0, Math.PI * 2);
    ctx.stroke();
  }

  // hp bar
  const bw = w + 40;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, b.x - bw / 2, y - 34, bw, 14, 7);
  ctx.fill();
  ctx.fillStyle = mine ? '#7ee08a' : '#ff5f6d';
  rr(ctx, b.x - bw / 2 + 2, y - 32, (bw - 4) * pct, 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 15px "Chakra Petch", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(b.hp)}`, b.x, y - 40);
  ctx.restore();
}

// ---------------------------------------------------------------------------
function drawBullets(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of g.bullets) {
    if (!b.active) continue;
    const ang = Math.atan2(b.vy, b.vx);
    const len = b.kind === 'rail' ? 34 : 20;
    // glow
    const gs = b.r * 9;
    ctx.drawImage(glow(b.glow), b.x - gs / 2, b.y - gs / 2, gs, gs);
    // body
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    ctx.fillStyle = b.hue;
    rr(ctx, -len / 2, -b.r * 0.6, len, b.r * 1.2, b.r * 0.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, len / 2 - b.r, -b.r * 0.28, b.r, b.r * 0.56, b.r * 0.28);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
function drawParticles(ctx: CanvasRenderingContext2D, g: Game, ground: boolean) {
  for (const q of g.particles) {
    if (!q.active) continue;
    const isGround = q.kind === 'casing' || q.kind === 'debris' || q.kind === 'smoke';
    if (isGround !== ground) continue;
    const a = clamp(q.life / q.maxLife, 0, 1);
    switch (q.kind) {
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = q.size;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - q.vx * 0.022, q.y - q.vy * 0.022);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'smoke': {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'debris': {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
        ctx.restore();
        break;
      }
      case 'casing': {
        ctx.globalAlpha = Math.min(1, a * 1.4);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-3, -1.5, 6, 3);
        ctx.restore();
        break;
      }
      case 'ring': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 3 + a * 5;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'flash': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.9;
        const s = q.size * (2.2 - a * 0.6);
        ctx.drawImage(glow(q.color), q.x - s / 2, q.y - s / 2, s, s);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'text': {
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.font = 'bold 17px "Chakra Petch", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(q.text ?? '', q.x, q.y);
        ctx.fillStyle = q.color;
        ctx.fillText(q.text ?? '', q.x, q.y);
        break;
      }
      default:
        break;
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
function drawReticle(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player;
  if (p.dead) return;
  const ap = g.aimPoint();
  const ax = ap.x, ay = ap.y;
  const t = g.playTime;
  ctx.save();
  // aim line
  const ang = Math.atan2(ay - p.y, ax - p.x);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 14]);
  ctx.lineDashOffset = -((t * 90) % 26);
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(ang) * (p.r + 26), p.y + Math.sin(ang) * (p.r + 26));
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.translate(ax, ay);
  ctx.rotate(t * 0.9);
  ctx.strokeStyle = 'rgba(255,209,102,0.95)';
  ctx.lineWidth = 3;
  const R = 17;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(R, R * 0.45);
    ctx.lineTo(R, R);
    ctx.lineTo(R * 0.45, R);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,209,102,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
function drawScreenFx(ctx: CanvasRenderingContext2D, g: Game) {
  const cw = g.cw, ch = g.ch;
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);

  // off-screen markers
  const marks: [number, number, string][] = [
    [g.enemyBase.x, g.enemyBase.y, '#ff5f6d'],
    [g.playerBase.x, g.playerBase.y, '#ffd166'],
  ];
  for (const [wx, wy, col] of marks) {
    const sx = (wx - g.cam.x) * g.cam.scale + cw / 2;
    const sy = (wy - g.cam.y) * g.cam.scale + ch / 2;
    const pad = 46;
    if (sx > pad && sx < cw - pad && sy > pad && sy < ch - pad) continue;
    const cx = clamp(sx, pad, cw - pad);
    const cy = clamp(sy, pad, ch - pad);
    const a = Math.atan2(sy - ch / 2, sx - cw / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // damage vignette
  const vig = g.vignette;
  if (vig > 0.01) {
    const grd = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    grd.addColorStop(0, 'rgba(255,40,30,0)');
    grd.addColorStop(1, `rgba(255,40,30,${0.55 * vig})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);
  }
  // low hp pulse
  const hpPct = g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 1;
  if (!g.player.dead && hpPct < 0.35) {
    const k = 0.18 + Math.sin(g.playTime * 7) * 0.12;
    const grd = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.2, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    grd.addColorStop(0, 'rgba(255,0,0,0)');
    grd.addColorStop(1, `rgba(255,20,20,${k * (1 - hpPct / 0.35)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);
  }
  // permanent vignette
  const pg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.78);
  pg.addColorStop(0, 'rgba(0,0,0,0)');
  pg.addColorStop(1, 'rgba(4,8,14,0.55)');
  ctx.fillStyle = pg;
  ctx.fillRect(0, 0, cw, ch);

  // impact flash
  if (g.flash > 0.01) {
    ctx.fillStyle = `rgba(${g.flashColor},${g.flash * 0.35})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // announcement
  if (g.announceTimer > 0 && g.announceText) {
    const k = g.announceTimer / 2.0;
    const appear = clamp((1 - k) * 6, 0, 1);
    const alpha = clamp(k * 2.4, 0, 1);
    const scale = 1 + (1 - appear) * 0.6;
    ctx.save();
    ctx.translate(cw / 2, ch * 0.2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(clamp(cw * 0.05, 20, 44))}px "Chakra Petch", system-ui, sans-serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(g.announceText, 0, 0);
    ctx.fillStyle = g.announceColor;
    ctx.fillText(g.announceText, 0, 0);
    ctx.restore();
  }

  // respawn overlay
  if (g.player.dead && g.respawn > 0) {
    ctx.fillStyle = 'rgba(8,10,16,0.45)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px "Chakra Petch", system-ui, sans-serif';
    ctx.fillStyle = '#ff6b81';
    ctx.fillText('HULL DESTROYED', cw / 2, ch / 2 - 16);
    ctx.font = 'bold 22px "Chakra Petch", system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`REDEPLOY IN ${g.respawn.toFixed(1)}s`, cw / 2, ch / 2 + 22);
  }
}

// ---------------------------------------------------------------------------
function shade(hex: string, amt: number) {
  if (!hex.startsWith('#')) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  let r = (num >> 16) & 255, gg = (num >> 8) & 255, b = num & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}
