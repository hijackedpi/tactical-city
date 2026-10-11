// ── HUD ────────────────────────────────────────────────────────────────────
function updateHUD(){
  const hp = Math.max(0, health);
  const hpNum = document.getElementById('cs-hp-num');
  const hpFill = document.getElementById('cs-hp-fill');
  const healthEl = document.getElementById('cs-health');
  if(hpNum) hpNum.innerText = hp;
  if(hpFill) hpFill.style.width = Math.max(0, Math.min(100, hp)) + '%';
  if(healthEl){
    healthEl.classList.toggle('low', hp <= 25);
    healthEl.classList.toggle('mid', hp > 25 && hp <= 50);
  }

  const killsEl = document.getElementById('cs-kills');
  if(killsEl) killsEl.style.display = 'none';   // no scoreboard until multiplayer

  const ammoEl = document.getElementById('cs-ammo');
  const clipEl = document.getElementById('cs-ammo-clip');
  const reserveEl = document.getElementById('cs-ammo-reserve');
  const nameEl = document.getElementById('cs-ammo-name');
  const sepEl = document.getElementById('cs-ammo-sep');
  if(playerInCar){
    if(ammoEl) ammoEl.style.display = 'none';
    return;
  }
  if(!ammoEl) return;
  ammoEl.style.display = 'block';
  const ticksEl = document.getElementById('cs-mags');        // reused: one tick per round
  if(gun.melee){
    clipEl.innerText = 'MELEE';
    reserveEl.innerText = '';
    if(sepEl) sepEl.style.display = 'none';
    if(ticksEl){ ticksEl.innerHTML = ''; ticksEl.dataset.sig = ''; }
    ammoEl.classList.add('melee'); ammoEl.classList.remove('low', 'dry');
  } else {
    if(sepEl) sepEl.style.display = '';
    ammoEl.classList.remove('melee');
    // left: rounds loaded; right: every spare round you are carrying
    clipEl.innerText = ammo;
    reserveEl.innerText = reserve;
    if(ticksEl){
      const cap = gun.maxAmmo || 0, sig = cap + ':' + ammo;
      if(ticksEl.dataset.sig !== sig){                      // only rebuild when it changes
        ticksEl.dataset.sig = sig;
        ticksEl.className = cap <= 7 ? 'wide' : (cap <= 20 ? 'mid' : '');
        let html = '';
        for(let i = cap - 1; i >= 0; i--) html += i < ammo ? '<i></i>' : '<i class="spent"></i>';
        ticksEl.innerHTML = html;
      }
    }
    ammoEl.classList.toggle('low', ammo > 0 && ammo <= Math.ceil(gun.maxAmmo * 0.3));
    ammoEl.classList.toggle('dry', ammo === 0 && reserve === 0);
  }
  if(nameEl) nameEl.innerText = gun.name;
}

// ── AMMO PANEL LOOK ─────────────────────────────────────────────────────────
// Rounds loaded / spare rounds, a tick per round in the magazine that empties
// as you fire, the weapon name under it. No box: a soft shadow keeps it
// readable on bright walls. Amber when the magazine runs low, red when out.
(function ammoPanelStyle(){
  const css = document.createElement('style');
  css.textContent = `
  #cs-ammo{background:radial-gradient(closest-side, rgba(0,0,0,.42), rgba(0,0,0,.25) 55%, rgba(0,0,0,0)) !important;
    border:none !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;
    padding:16px 18px 14px 40px !important;min-width:0 !important;right:14px !important;bottom:12px !important}
  #cs-ammo-clip{font-size:56px !important;font-weight:800;letter-spacing:-1px;
    text-shadow:0 2px 6px rgba(0,0,0,.8),0 0 18px rgba(0,0,0,.35) !important}
  #cs-ammo-sep{font-size:22px !important;color:rgba(236,239,243,.55) !important;margin:0 5px 0 8px !important}
  #cs-ammo-reserve{font-size:24px !important;color:rgba(236,239,243,.75) !important;text-shadow:0 1px 4px rgba(0,0,0,.85)}
  #cs-magbar{display:none !important}
  #cs-mags{display:flex !important;gap:2px !important;justify-content:flex-end;align-items:flex-end;
    height:14px !important;margin-top:8px !important;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}
  #cs-mags i{width:3px !important;height:14px !important;border:none !important;border-radius:1px !important;
    background:#f1f3f6 !important;box-shadow:none !important;overflow:visible}
  #cs-mags.mid i{width:5px !important}
  #cs-mags.wide i{width:9px !important;border-radius:2px !important}
  #cs-mags i::after{display:none !important}
  #cs-mags i.spent{background:rgba(236,239,243,.16) !important}
  #cs-ammo-name{font-size:12px !important;letter-spacing:3px !important;color:rgba(236,239,243,.7) !important;
    margin-top:7px !important;text-shadow:0 1px 3px rgba(0,0,0,.9)}
  #cs-ammo.low #cs-ammo-clip{color:#f2b23c !important}
  #cs-ammo.low #cs-mags i:not(.spent){background:#f2b23c !important}
  #cs-ammo.dry #cs-ammo-clip, #cs-ammo.dry #cs-ammo-reserve{color:#e64b3c !important}
  #cs-ammo.melee #cs-ammo-clip{font-size:30px !important;letter-spacing:3px;color:rgba(236,239,243,.8) !important}`;
  document.head.appendChild(css);
})();

function resetGame(){
  // Eject from car if dying mid-drive
  if(playerInCar) exitCar(true);
  if(isScoped) setScoped(false);
  cancelReload(); stopAutoFire();
  // Keep money and owned weapons across deaths; keep the equipped gun.
  gun={...GUNS[selectedGunKey]};
  health=100;kills=0;verticalVelocity=0;pitch=0;
  resetAllAmmo();
  ammo=gun.ammo; reserve=(GUNS[selectedGunKey].spareMags||0)*gun.ammo;
  {
    const sp = randomSpawnIn(TEAM_SPAWNS.t);
    yaw = TEAM_SPAWNS.t.yaw;
    camera.position.set(sp[0], 1.7, sp[1]);
    camera.rotation.set(0,0,0);
    _playerGroundPos.set(sp[0], 1.7, sp[1]);
  }
  enemyBullets.forEach(b=>scene.remove(b));enemyBullets.length=0;
  playerBullets.forEach(b=>scene.remove(b));playerBullets.length=0;
  enemies.forEach(e=>scene.remove(e));enemies.length=0;
  if(playerGun) camera.remove(playerGun);
  playerGun = gunModels[selectedGunKey] || null;
  if(playerGun){
    playerGun.position.set(...gunOffsets[selectedGunKey]);
    camera.add(playerGun);
    applyViewmodel();
  }
  money = Math.max(money, START_MONEY);
  updateHUD(); updateMoneyUI();
  document.getElementById('title').innerText='ELIMINATED';
  document.getElementById('desc').innerHTML='You went down. Your loadout is kept &mdash; redeploy at your spawn.';
  document.getElementById('start-btn').innerText='REDEPLOY';
  document.getElementById('instructions').style.display='flex';
  if(document.pointerLockElement) document.exitPointerLock();
}

// ── RELOAD INDICATOR ────────────────────────────────────────────────────────
// A gold ring under the crosshair fills over the reload, and the ammo ticks
// fill up one by one as the new rounds go in. Replaces the old orange text.
(function reloadIndicator(){
  const css = document.createElement('style');
  css.textContent = `
  #reload-msg{display:none !important}
  #rl-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,38px);pointer-events:none;
    display:none;flex-direction:column;align-items:center;gap:4px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.85))}
  #rl-ring svg{width:38px;height:38px;transform:rotate(-90deg)}
  #rl-ring .bg{fill:none;stroke:rgba(255,255,255,.18);stroke-width:3.5}
  #rl-ring .fg{fill:none;stroke:#e8b54a;stroke-width:3.5;stroke-linecap:round}
  #rl-ring span{font:700 10px/1 'Arial Narrow',sans-serif;letter-spacing:3px;color:#e8b54a}
  #cs-mags i.incoming{background:#e8b54a !important}
  body.title-mode #rl-ring{display:none !important}`;
  document.head.appendChild(css);
  const R = 15, C = 2 * Math.PI * R;
  const el = document.createElement('div'); el.id = 'rl-ring';
  el.innerHTML = '<svg viewBox="0 0 38 38"><circle class="bg" cx="19" cy="19" r="' + R + '"/>' +
                 '<circle class="fg" cx="19" cy="19" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg>' +
                 '<span>RELOADING</span>';
  document.body.appendChild(el);
  const fg = el.querySelector('.fg');
  let shown = false;
  (function frame(){
    requestAnimationFrame(frame);
    const on = typeof isReloading !== 'undefined' && isReloading && reloadDur > 0 && !(typeof gun !== 'undefined' && gun.melee);
    if(on !== shown){ el.style.display = on ? 'flex' : 'none'; shown = on; }
    if(!on) return;
    const p = Math.max(0, Math.min(1, (performance.now() - reloadStartedAt) / reloadDur));
    fg.setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(2));
    // ammo ticks: the rounds going in light up gold as the reload progresses
    const ticks = document.getElementById('cs-mags');
    if(ticks && gun && gun.maxAmmo){
      const cap = gun.maxAmmo, incoming = Math.max(0, Math.min(cap - ammo, reserve));
      const filled = Math.floor(p * incoming);
      const sig = 'r' + cap + ':' + ammo + ':' + filled;
      if(ticks.dataset.sig !== sig){
        ticks.dataset.sig = sig;
        let html = '';
        for(let i = cap - 1; i >= 0; i--)
          html += i < ammo ? '<i></i>' : (i < ammo + filled ? '<i class="incoming"></i>' : '<i class="spent"></i>');
        ticks.innerHTML = html;
      }
    }
  })();
})();


// ── VITALS PANEL (health + money) ───────────────────────────────────────────
// Bottom-left, replacing the old number-and-bar. A slanted glass panel with a
// stripe in your team's colour: health as a big number beside ten slanted
// segments of 10 HP each, and money on its own tag above. Segments go white,
// amber at 50 or less, red at 25 or less; when you are hit the segments you
// lost flash red before emptying. The old #cs-health / #cs-money stay in the
// page (other code still writes to them) but are hidden.
(function vitalsPanel(){
  const css = document.createElement('style');
  css.textContent = `
  #cs-health, #cs-money{display:none !important}
  #vt{position:absolute;left:22px;bottom:22px;pointer-events:none;display:flex;flex-direction:column;
    align-items:flex-start;gap:7px;font-family:'Saira Condensed','Stratum2','Arial Narrow',sans-serif;
    --acc:#e0a35a;filter:drop-shadow(0 3px 8px rgba(0,0,0,.45))}
  #vt.ct{--acc:#6fa5e0}
  body.title-mode #vt{display:none}
  .vt-panel{position:relative;display:flex;align-items:center;gap:16px;padding:8px 30px 9px 22px;
    background:linear-gradient(100deg, rgba(12,15,20,.86), rgba(12,15,20,.62));
    clip-path:polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);transition:background .25s}
  .vt-panel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--acc)}
  .vt-hp{display:flex;flex-direction:column;align-items:flex-start;min-width:74px}
  .vt-lbl{font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(236,239,243,.55);line-height:1}
  .vt-num{font-size:46px;font-weight:800;line-height:.9;color:#f6f7f9;font-variant-numeric:tabular-nums;transition:color .15s}
  .vt-segs{display:flex;gap:3px;transform:skewX(-18deg)}
  .vt-seg{width:15px;height:22px;background:rgba(236,239,243,.12);position:relative;overflow:hidden}
  .vt-seg i{position:absolute;left:0;top:0;bottom:0;background:#f1f3f6;transition:width .12s,background .15s}
  .vt-seg.lost{background:#e64b3c;transition:background .7s ease-out}
  #vt.mid .vt-num{color:#f2b23c} #vt.mid .vt-seg i{background:#f2b23c}
  #vt.low .vt-num{color:#e64b3c} #vt.low .vt-seg i{background:#e64b3c}
  #vt.low .vt-panel::before{animation:vtPulse .8s ease-in-out infinite}
  @keyframes vtPulse{0%,100%{background:#e64b3c}50%{background:rgba(230,75,60,.25)}}
  #vt.hit .vt-panel{background:linear-gradient(100deg, rgba(110,22,18,.9), rgba(60,14,12,.7))}
  .vt-money{display:flex;align-items:stretch;clip-path:polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    background:rgba(12,15,20,.78)}
  .vt-cash{background:#5fbf72;color:#0d1a10;font-weight:800;font-size:17px;padding:2px 9px;display:flex;align-items:center}
  .vt-amt{color:#eef0f3;font-size:20px;font-weight:700;padding:2px 20px 2px 9px;font-variant-numeric:tabular-nums;letter-spacing:.5px}
  .vt-delta{position:absolute;left:100%;bottom:2px;margin-left:10px;white-space:nowrap;font-size:17px;font-weight:800;
    opacity:0;transform:translateY(4px);transition:opacity .25s, transform 1.2s ease-out;text-shadow:0 1px 4px rgba(0,0,0,.9)}
  .vt-delta.up{color:#8be39a} .vt-delta.down{color:#e8806f}
  .vt-delta.show{opacity:1;transform:translateY(-10px)}
  .vt-mrow{position:relative}`;
  document.head.appendChild(css);

  const vt = document.createElement('div'); vt.id = 'vt';
  let segs = '';
  for(let i = 0; i < 10; i++) segs += '<div class="vt-seg"><i></i></div>';
  vt.innerHTML =
    '<div class="vt-mrow"><div class="vt-money"><div class="vt-cash">$</div><div class="vt-amt">0</div></div><div class="vt-delta"></div></div>' +
    '<div class="vt-panel"><div class="vt-hp"><div class="vt-lbl">HEALTH</div><div class="vt-num">100</div></div>' +
    '<div class="vt-segs">' + segs + '</div></div>';
  document.body.appendChild(vt);
  const numEl = vt.querySelector('.vt-num'), amtEl = vt.querySelector('.vt-amt'), dEl = vt.querySelector('.vt-delta');
  const segEls = [...vt.querySelectorAll('.vt-seg')];

  let lastHp = -1, lastMoney = null, lastTeam = '', hitT = null, dT = null;
  (function frame(){
    requestAnimationFrame(frame);
    // hidden while driving, like the rest of the HUD
    const show = !(typeof playerInCar !== 'undefined' && playerInCar);
    vt.style.display = show ? '' : 'none';

    const team = (typeof selfTeamNow === 'function' ? selfTeamNow() : 't');
    if(team !== lastTeam){ vt.classList.toggle('ct', team === 'ct'); lastTeam = team; }

    const hp = Math.max(0, Math.min(100, Math.round(typeof health !== 'undefined' ? health : 100)));
    if(hp !== lastHp){
      numEl.textContent = hp;
      vt.classList.toggle('low', hp <= 25);
      vt.classList.toggle('mid', hp > 25 && hp <= 50);
      for(let i = 0; i < 10; i++){
        const f = Math.max(0, Math.min(1, (hp - i * 10) / 10));
        const was = lastHp < 0 ? f : Math.max(0, Math.min(1, (lastHp - i * 10) / 10));
        segEls[i].firstChild.style.width = (f * 100) + '%';
        if(f < was){                                   // this segment just lost health: flash it red
          const el = segEls[i];
          el.classList.remove('lost'); el.style.transition = 'none'; el.style.background = '#e64b3c';
          void el.offsetWidth; el.style.transition = ''; el.style.background = '';
          el.classList.add('lost'); setTimeout(() => el.classList.remove('lost'), 50);
        }
      }
      if(lastHp >= 0 && hp < lastHp){
        vt.classList.add('hit'); clearTimeout(hitT); hitT = setTimeout(() => vt.classList.remove('hit'), 180);
      }
      lastHp = hp;
    }

    const m = typeof money !== 'undefined' ? money : 0;
    if(m !== lastMoney){
      amtEl.textContent = m.toLocaleString();
      if(lastMoney !== null){
        const d = m - lastMoney;
        dEl.textContent = (d > 0 ? '+$' : '-$') + Math.abs(d).toLocaleString();
        dEl.className = 'vt-delta ' + (d > 0 ? 'up' : 'down');
        dEl.style.transition = 'none'; void dEl.offsetWidth; dEl.style.transition = '';
        dEl.classList.add('show'); clearTimeout(dT); dT = setTimeout(() => dEl.classList.remove('show'), 1600);
      }
      lastMoney = m;
    }
  })();
})();
