// ── HUD ────────────────────────────────────────────────────────────────────
function updateHUD(){
  const hp = Math.max(0, health);
  const hpNum = document.getElementById('cs-hp-num');
  const hpFill = document.getElementById('cs-hp-fill');
  const healthEl = document.getElementById('cs-health');
  if(hpNum) hpNum.innerText = hp;
  if(hpFill) hpFill.style.width = Math.max(0, Math.min(100, hp)) + '%';
  if(healthEl) healthEl.classList.toggle('low', hp <= 25);

  const killsEl = document.getElementById('cs-kills');
  if(killsEl) killsEl.style.display = 'none';   // no scoreboard until multiplayer

  const ammoEl = document.getElementById('cs-ammo');
  const clipEl = document.getElementById('cs-ammo-clip');
  const reserveEl = document.getElementById('cs-ammo-reserve');
  const nameEl = document.getElementById('cs-ammo-name');
  if(playerInCar){
    if(ammoEl) ammoEl.style.display = 'none';
  } else {
    if(ammoEl) ammoEl.style.display = 'block';
    const magbar = document.querySelector('#cs-magbar i');
    const magsEl = document.getElementById('cs-mags');
    const spares = GUNS[selectedGunKey].spareMags || 0;

    if(gun.melee){
      if(clipEl) clipEl.innerText = '\u2014';
      if(reserveEl) reserveEl.innerText = '';
      if(document.getElementById('cs-ammo-sep')) document.getElementById('cs-ammo-sep').style.display = 'none';
      if(magsEl) magsEl.innerHTML = '';
      if(ammoEl){ ammoEl.classList.add('melee'); ammoEl.classList.remove('low','dry'); }
    } else {
      if(document.getElementById('cs-ammo-sep')) document.getElementById('cs-ammo-sep').style.display = '';
      if(ammoEl) ammoEl.classList.remove('melee');
      // Left of the slash is what is loaded; right is the magazine's capacity.
      // Spare magazines are shown as pips rather than a raw round count.
      if(clipEl) clipEl.innerText = ammo;
      if(reserveEl) reserveEl.innerText = gun.maxAmmo;
      if(magbar) magbar.style.width = (gun.maxAmmo ? (ammo / gun.maxAmmo) * 100 : 0) + '%';

      if(magsEl){
        if(spares === 0){
          magsEl.innerHTML = '';
        } else {
          // reserve is a round count, so convert back to whole mags plus the
          // fraction remaining in the one currently being drawn from
          const whole = Math.floor(reserve / gun.maxAmmo);
          const part  = (reserve % gun.maxAmmo) / gun.maxAmmo;
          let html = '';
          for(let i = 0; i < spares; i++){
            if(i < whole)                    html += '<i style="--f:1"></i>';
            else if(i === whole && part > 0) html += '<i class="part" style="--f:' + part.toFixed(3) + '"></i>';
            else                             html += '<i style="--f:0"></i>';
          }
          magsEl.innerHTML = html;
        }
      }
      if(ammoEl){
        ammoEl.classList.toggle('low', ammo > 0 && ammo <= Math.ceil(gun.maxAmmo * 0.3));
        ammoEl.classList.toggle('dry', ammo === 0 && reserve === 0);
      }
    }
    if(nameEl) nameEl.innerText = gun.name;
  }
}

function resetGame(){
  // Eject from car if dying mid-drive
  if(playerInCar) exitCar(true);
  if(isScoped) setScoped(false);
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
  updateHUD(); updateMoneyUI();
  money = Math.max(money, START_MONEY);
  document.getElementById('title').innerText='ELIMINATED';
  document.getElementById('desc').innerHTML='You went down. Your loadout is kept &mdash; redeploy at your spawn.';
  document.getElementById('start-btn').innerText='REDEPLOY';
  document.getElementById('instructions').style.display='flex';
  if(document.pointerLockElement) document.exitPointerLock();
}
