// ── MAIN GAME LOOP ─────────────────────────────────────────────────────────
const _nearbyCar = [];
const _carTmpBox = new THREE.Box3();
let lastSpawn = 0;
let wheelRoll = 0;
const _spEl = document.getElementById('speedo-num');
let _spLast = null;

function animate(now){
  requestAnimationFrame(animate);
  _perfT0 = performance.now();
  _perfFrame = _perfLastFrame ? _perfT0 - _perfLastFrame : 0;
  _perfLastFrame = _perfT0;
  if(!document.pointerLockElement){ renderer.render(scene, camera); return; }

  // Advance all animation mixers (enemy walk cycles + the player's body). dt in seconds.
  {
    const dt = Math.min(0.05, (now - (window._lastAnimNow||now)) / 1000);
    _frameDt = dt;
    // Enemy mixers now advance inside the AI loop, but only for enemies that
    // are actually on screen — see the visibility test there.
    if(_fpMixer) _fpMixer.update(dt);
    camera.updateMatrixWorld();
    _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
  }
  window._lastAnimNow = now;

  // FOV smoothing for scope zoom
  if(Math.abs(currentFov - targetFov) > 0.1){
    currentFov += (targetFov - currentFov) * 0.25;
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }

  updateTrafficLights(now);
  
  // Only the single nearest interior light is ever active — you can only be in
  // one building at a time, so lighting more than one just wastes shading.
  {
    let nearest = null, nearestD2 = Infinity;
    for(const il of interiorLights){
      const dx = camera.position.x - il.cx, dz = camera.position.z - il.cz;
      const d2 = dx*dx + dz*dz;
      if(d2 < nearestD2){ nearestD2 = d2; nearest = il; }
    }
    for(const il of interiorLights){
      if(il === nearest){
        const inside = nearestD2 < (il.radius*0.95)*(il.radius*0.95);
        if(inside){
          if(!il.light.visible) il.light.visible = true;
          il.light.intensity += (2.4 - il.light.intensity) * 0.18;
        } else {
          il.light.intensity += (0 - il.light.intensity) * 0.18;
          if(il.light.intensity < 0.02 && il.light.visible){ il.light.visible = false; il.light.intensity = 0; }
        }
      } else {
        if(il.light.visible){ il.light.visible = false; il.light.intensity = 0; }
      }
    }
  }

  // Hide transparent window decals while inside a building — big fill-rate
  // saving indoors. Only loops on the frame you cross the threshold.
  {
    let nD2 = Infinity, nR = 1;
    for(const il of interiorLights){
      const dx = camera.position.x - il.cx, dz = camera.position.z - il.cz;
      const d2 = dx*dx + dz*dz;
      if(d2 < nD2){ nD2 = d2; nR = il.radius; }
    }
    const insideB = nD2 < (nR*0.7)*(nR*0.7);
    if(insideB !== window._wdHidden){
      window._wdHidden = insideB;
      for(const p of _windowDecals) p.visible = !insideB;
    }
  }

  // Bots removed — remote players will be added over the network instead.
  // makeEnemy() and the update loop below remain as the rendering path for
  // them; drive position/rotation from network state rather than AI.

  if(playerInCar && currentCar){
    // ═══════ DRIVING PHYSICS ═══════
    const car = currentCar;
    // Throttle / brake
    if(keys['KeyW']){
      car.speed += CAR_ACCEL;
    }
    if(keys['KeyS']){
      car.speed -= CAR_ACCEL;
    }
    car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
    // Friction
    car.speed *= CAR_FRICTION;
    if(Math.abs(car.speed) < 0.0008) car.speed = 0;
    // Handbrake
    if(keys['Space']){
      car.speed *= CAR_HANDBRAKE_DECAY;
    }
    // Steering input (steer wheel angle target)
    let steerTarget = 0;
    if(keys['KeyA']) steerTarget += 0.45;
    if(keys['KeyD']) steerTarget -= 0.45;
    // Smooth steering
    car.steer += (steerTarget - car.steer) * 0.18;
    // Turn in place — A/D rotate the car regardless of speed
    if(keys['KeyA']) car.angle += CAR_TURN_RATE;
    if(keys['KeyD']) car.angle -= CAR_TURN_RATE;

    // Movement: car faces +Z locally, so world forward is (sin(angle), 0, cos(angle))
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    const newX = car.x + fx * car.speed;
    const newZ = car.z + fz * car.speed;

    // Collision: try X axis then Z axis separately so we can slide along walls.
    const prevX = car.x, prevZ = car.z;
    // Build a tentative bbox for newX (keep current Z)
    const cosA = Math.abs(Math.cos(car.angle));
    const sinA = Math.abs(Math.sin(car.angle));
    const ex = car.halfW * cosA + car.halfL * sinA;
    const ez = car.halfW * sinA + car.halfL * cosA;
    const tmpBox = _carTmpBox;

    tmpBox.min.set(newX - ex, 0, prevZ - ez);
    tmpBox.max.set(newX + ex, 1.8, prevZ + ez);
    let hitX = false;
    _queryRegion(newX - ex, prevZ - ez, newX + ex, prevZ + ez, _nearbyCar);
    for(let i=0;i<_nearbyCar.length;i++){
      if(tmpBox.intersectsBox(_nearbyCar[i])){ hitX = true; break; }
    }
    if(!hitX) car.x = newX;

    tmpBox.min.set(car.x - ex, 0, newZ - ez);
    tmpBox.max.set(car.x + ex, 1.8, newZ + ez);
    let hitZ = false;
    _queryRegion(car.x - ex, newZ - ez, car.x + ex, newZ + ez, _nearbyCar);
    for(let i=0;i<_nearbyCar.length;i++){
      if(tmpBox.intersectsBox(_nearbyCar[i])){ hitZ = true; break; }
    }
    if(!hitZ) car.z = newZ;

    // Bounce on impact
    if(hitX || hitZ){
      if(Math.abs(car.speed) > 0.15){
        playCarImpact();
      }
      car.speed *= -0.25;
    }

    // Clamp to play area
    car.x = Math.max(-BW + 3, Math.min(BW - 3, car.x));
    car.z = Math.max(-BW + 3, Math.min(BW - 3, car.z));

    // Update visual transform
    car.group.position.x = car.x;
    car.group.position.z = car.z;
    car.group.rotation.y = car.angle;

    // Run over enemies — 60 damage when the car strikes one
    if(Math.abs(car.speed) > 0.05){
      for(let j=enemies.length-1; j>=0; j--){
        const e = enemies[j];
        const edx = e.position.x - car.x;
        const edz = e.position.z - car.z;
        const cA = Math.cos(-car.angle), sA = Math.sin(-car.angle);
        const localX = edx * cA - edz * sA;
        const localZ = edx * sA + edz * cA;
        if(Math.abs(localX) < car.halfW + 0.4 && Math.abs(localZ) < car.halfL + 0.4){
          e.userData.hp -= 60;
          playHit();
          if(e.userData.hp <= 0){
            scene.remove(e); enemies.splice(j, 1);
            kills++; addMoney(KILL_REWARD); playKill(); updateHUD();
          } else {
            const sign = localX > 0 ? 1 : -1;
            const px = -Math.cos(car.angle) * sign * 1.2;
            const pz =  Math.sin(car.angle) * sign * 1.2;
            if(!enemyCollides(e.position.x + px, e.position.z + pz, 0.4)){
              e.position.x += px; e.position.z += pz;
            }
          }
        }
      }
    }

    // Spin wheels
    wheelRoll += car.speed / 0.32; // radius
    for(const w of car.wheels){
      w.tire.rotation.x = wheelRoll;
      if(w.steer){
        w.group.rotation.y = car.steer * 0.7;
      }
    }

    // Update collision box (kept in obstacles[] only when NOT being driven, but
    // for AI and bullets we still want the box up to date — easy to just write it)
    updateCarBox(car);

    // Brake-light intensity
    const braking = (keys['KeyS'] && car.speed > 0) || keys['Space'];
    for(const tl of car.taillights){
      tl.material.emissiveIntensity = braking ? 1.3 : 0.4;
    }

    // Chase camera: position behind the camera's yaw (not the car's heading)
    // so the player can swing the camera around with the mouse.
    const camDist = 7.0;
    const camHeight = 3.6;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
    // Camera sits behind+above the car, offset along yaw forward direction
    const camFwdX = -Math.sin(yaw);
    const camFwdZ = -Math.cos(yaw);
    camera.position.x = car.x - camFwdX * camDist;
    camera.position.z = car.z - camFwdZ * camDist;
    camera.position.y = 1.5 + camHeight + pitch * 1.5;

    // Speedometer (rough km/h conversion)
    const kmh = Math.abs(car.speed) * 200 | 0;
    if(_spLast !== kmh){ if(_spEl) _spEl.innerText = kmh; _spLast = kmh; }
    updateEngine(car.speed);
  } else {
    // ═══════ ON-FOOT MOVEMENT ═══════
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    // The "player position" is camera.position in 1st person, or _playerGroundPos
    // in 3rd person (since the camera floats away from the player then).
    // Always use a dedicated ground position so the camera's eye-offset in 1st
    // person never feeds back into movement (which caused forward drift).
    const pp = _playerGroundPos;
    if(!thirdPerson && verticalVelocity === 0 && pp.y === 1.7){ /* pp already tracks player */ }

    // Movement: WASD relative to yaw
    const fwd = _scratchFwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = _scratchRight.set(-Math.sin(yaw - Math.PI/2), 0, -Math.cos(yaw - Math.PI/2));
    // NET HOOK 1 — frozen during buy time and between rounds. Look around all
    // you like; you just cannot leave spawn until the round goes live.
    const frozen = (typeof netFrozen !== 'undefined') && netFrozen;
    const moveSpeed = frozen ? 0 : (isScoped ? playerSpeed * 0.45 : playerSpeed);
    let dx = 0, dz = 0;
    if(keys['KeyW']){ dx += fwd.x; dz += fwd.z; }
    if(keys['KeyS']){ dx -= fwd.x; dz -= fwd.z; }
    if(keys['KeyD']){ dx += right.x; dz += right.z; }
    if(keys['KeyA']){ dx -= right.x; dz -= right.z; }
    const len = Math.hypot(dx, dz);
    if(len > 0){ dx = dx/len * moveSpeed; dz = dz/len * moveSpeed; }

    const feetY = pp.y - FEET_OFFSET;
    if(dx !== 0 && !playerCollides(pp.x + dx, pp.z, feetY)) pp.x += dx;
    if(dz !== 0 && !playerCollides(pp.x, pp.z + dz, feetY)) pp.z += dz;

    // Gravity & jumping — the floor is now whatever you're standing on.
    verticalVelocity -= gravity;
    pp.y += verticalVelocity;
    const floorY = groundHeightAt(pp.x, pp.z, feetY) + FEET_OFFSET;
    if(pp.y < floorY){
      pp.y = floorY;
      verticalVelocity = 0;
      isGrounded = true;
    }
    // If we have ended up inside something solid, ride to the top of it.
    // groundHeightAt with no ceiling returns the highest surface here.
    if(playerCollides(pp.x, pp.z, pp.y - FEET_OFFSET)){
      const top = groundHeightAt(pp.x, pp.z, Infinity);
      if(top > pp.y - FEET_OFFSET){
        pp.y = top + FEET_OFFSET;
        verticalVelocity = 0;
        isGrounded = true;
      }
    }
    // Clamp to play area
    pp.x = Math.max(-BW + 3, Math.min(BW - 3, pp.x));
    pp.z = Math.max(-BW + 3, Math.min(BW - 3, pp.z));

    // In third-person, position the camera behind & slightly above the player
    // for an over-the-shoulder chase view.
    if(thirdPerson){
      const camBack = 5.5, camUp = 1.2;
      camera.position.set(
        pp.x + Math.sin(yaw) * camBack,
        pp.y + camUp,
        pp.z + Math.cos(yaw) * camBack
      );
      // Look slightly downward by limiting how high the over-the-shoulder sits;
      // pitch still works via the mouse for looking up/down.
    }

    // Show "Press E" prompt when near a car
    // (no vehicles, so no enter prompt)

    // Pick up any dropped gun we're standing on
    checkGunPickups();

    // Gun recoil decay
    gunRecoilZ *= 0.85; gunRecoilY *= 0.85;
    if(playerGun){
      const [ox, oy, oz] = gunOffsets[selectedGunKey];
      // Math.abs + viewSide so a left-handed viewmodel survives recoil,
      // which rewrites this transform every single frame.
      playerGun.position.set(Math.abs(ox)*viewSide, oy + gunRecoilY, oz + gunRecoilZ);
    }

    // ── PLAYER BODY + CAMERA ──
    // Camera placement deliberately sits OUTSIDE the body check: with the
    // character model disabled there is no body, and nesting the camera update
    // inside it would leave the view frozen at spawn while collision moved.
    if(USE_CHARACTER_MODEL && !_fpBody) buildFirstPersonBody();
    if(_fpBody){
      _fpBodyHolder.matrixAutoUpdate = true;
      const bodyDrop = thirdPerson ? 0 : 0.15;
      _fpBodyHolder.position.set(pp.x, pp.y - FEET_OFFSET - bodyDrop, pp.z);
      _fpBodyHolder.rotation.y = yaw + Math.PI;
      _fpBodyHolder.updateMatrix();
      const moving = (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']) && isGrounded;
      if(_fpRunAction) _fpRunAction.paused = !moving;
      _fpBody.visible = _fpBodyWanted && !isScoped;
    }

    // First-person eye, computed fresh from pp each frame so it cannot drift.
    if(!thirdPerson){
      // Step the eye back until it is clear of geometry. At offset 0 the eye
      // sits at the body centre, which collision already keeps PLAYER_HALF
      // (0.35) from any wall — comfortably outside the 0.2 near plane — so
      // this loop always terminates somewhere safe.
      const sy = -Math.sin(yaw), cy2 = -Math.cos(yaw);
      const eyeFeet = pp.y - FEET_OFFSET;
      let camFwd = 0.42;
      while(camFwd > 0.001 && eyeBlocked(pp.x + sy*camFwd, pp.z + cy2*camFwd, eyeFeet)){
        camFwd -= 0.14;
      }
      if(camFwd < 0) camFwd = 0;
      camera.position.x = pp.x + sy * camFwd;
      camera.position.z = pp.z + cy2 * camFwd;
      camera.position.y = pp.y - 0.12;
    }

  }

  // ── PLAYER BULLETS ──
  for(let i=playerBullets.length-1;i>=0;i--){
    const b = playerBullets[i];
    const prevPos = _scratchPrev.copy(b.position);
    b.position.add(b.userData.vel);
    // Velocity is constant, so the nose only needs aiming once, at spawn.
    if(!b.userData.aimed){
      b.quaternion.setFromUnitVectors(_BULLET_FWD, _scratchDir.copy(b.userData.vel).normalize());
      b.userData.aimed = true;
    }
    b.userData.life++;
    if(b.userData.life > 30){ scene.remove(b); playerBullets.splice(i, 1); continue; }
    // Check obstacle hit (line segment vs box)
    if(isBlocked(prevPos.x, prevPos.y, prevPos.z, b.position.x, b.position.y, b.position.z)){
      scene.remove(b); playerBullets.splice(i, 1); continue;
    }
    // Enemy hits
    let hit = false;
    for(let j=enemies.length-1;j>=0;j--){
      const e = enemies[j];
      const ex = e.position.x, ez = e.position.z;
      // Swept check: closest distance from the enemy to the segment the bullet
      // traveled this frame, so fast bullets can't skip over an enemy in one step.
      const sx = prevPos.x, sz = prevPos.z;
      const vx = b.position.x - sx, vz = b.position.z - sz;
      const segLen2 = vx*vx + vz*vz;
      let tHit = segLen2 > 0 ? (((ex - sx)*vx + (ez - sz)*vz) / segLen2) : 0;
      tHit = Math.max(0, Math.min(1, tHit));
      const cx = sx + vx*tHit, cz = sz + vz*tHit;
      const ddx = cx - ex, ddz = cz - ez;
      if(ddx*ddx + ddz*ddz < 0.5){
        const by = b.position.y;
        // Head: y ~ 1.6-1.85; torso: 0.9-1.6; legs: <0.9
        let dmg = b.userData.damage;
        if(by > 1.55 && b.userData.headshotDamage){ dmg = b.userData.headshotDamage; }
        // NET HOOK 2 — the server owns health for networked players. Applying
        // damage locally as well would mean ten clients each running their own
        // private version of who is still alive.
        if(e.userData.isRemote){
          netReportHit(e.userData.netId, dmg, by > 1.55);
          playHit();
        } else {
          e.userData.hp -= dmg;
          playHit();
          if(e.userData.hp <= 0){
            scene.remove(e); enemies.splice(j, 1);
            kills++; addMoney(KILL_REWARD); playKill(); updateHUD();
          }
        }
        hit = true; break;
      }
    }
    if(hit){ scene.remove(b); playerBullets.splice(i, 1); }
  }

  // ── ENEMY BULLETS ──
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b = enemyBullets[i];
    const prev = _scratchPrev.copy(b.position);
    b.position.add(b.userData.vel);
    if(!b.userData.aimed){
      b.quaternion.setFromUnitVectors(_BULLET_FWD, _scratchDir.copy(b.userData.vel).normalize());
      b.userData.aimed = true;
    }
    b.userData.life++;
    if(b.userData.life > 26){ scene.remove(b); enemyBullets.splice(i, 1); continue; }
    if(isBlocked(prev.x, prev.y, prev.z, b.position.x, b.position.y, b.position.z)){
      scene.remove(b); enemyBullets.splice(i, 1); continue;
    }
    // Player hit
    const target = playerInCar && currentCar
      ? _scratchTgt.set(currentCar.x, 1.0, currentCar.z)
      : camera.position;
    const tdx = b.position.x - target.x, tdz = b.position.z - target.z, tdy = b.position.y - target.y;
    const hitR = playerInCar ? 1.8 : 0.6;
    if(tdx*tdx + tdz*tdz + tdy*tdy < hitR*hitR){
      // Cars take less damage to player inside (armored-ish)
      const dmg = playerInCar ? 4 : 12;
      health -= dmg; updateHUD();
      playPlayerHurt();
      document.getElementById('hit-flash').style.background = 'rgba(255,0,0,0.4)';
      setTimeout(()=>{document.getElementById('hit-flash').style.background='rgba(255,0,0,0)';}, 80);
      scene.remove(b); enemyBullets.splice(i, 1);
      if(health <= 0){ playDeath(); resetGame(); return; }
      continue;
    }
  }

  // ── ENEMY AI ──
  const playerPos = playerInCar && currentCar
    ? _scratchPlyr.set(currentCar.x, 1.0, currentCar.z)
    : camera.position;
  for(const e of enemies){
    const dx = playerPos.x - e.position.x;
    const dz = playerPos.z - e.position.z;
    const dist = Math.hypot(dx, dz);

    // Health bar: turns WITH the enemy's body + shrink the fill to match HP.
    if(e.userData.healthBar){
      const W = e.userData.barW;
      const frac = Math.max(0.001, Math.min(1, e.userData.hp / e.userData.maxHp));
      e.userData.barFill.scale.x = frac;                        // shrink width
      e.userData.barFill.position.x = -W/2 + (W*frac)/2;        // keep left edge anchored
    }

    // NET HOOK 3 — a remote player faces wherever their own mouse is pointing,
    // not at us. Bots face the player; people face where they are looking.
    const dirAngle = Math.atan2(dx, dz);
    e.rotation.y = e.userData.isRemote ? e.userData.netYaw : dirAngle;

    // Draw and animate only what the camera can actually see. Skinned meshes
    // are the most expensive thing in the scene, and this skips both the draw
    // and the skeleton update for anything off screen. AI below is unaffected.
    _cullSphere.center.set(e.position.x, e.position.y + 1.0, e.position.z);
    const onScreen = _frustum.intersectsSphere(_cullSphere);
    if(e.visible !== onScreen) e.visible = onScreen;
    if(onScreen && e.userData.mixer) e.userData.mixer.update(_frameDt);

    // NET HOOK 4 — everything below this line is AI: pathing toward the player
    // and deciding when to shoot. A remote player has a human doing that, and
    // their position arrives from the network instead. Health bar, facing and
    // culling above still apply, which is why the skip sits here and not at the
    // top of the loop.
    if(e.userData.isRemote) continue;

    if(dist > 90) continue; // skip the rest of the AI for distant enemies

    // Walk toward player (stop at range)
    const stopRange = 14;
    if(dist > stopRange){
      const stepSpeed = 0.10;   // the map is far larger than the old spawn ring
      const nx = e.position.x + (dx/dist) * stepSpeed;
      const nz = e.position.z + (dz/dist) * stepSpeed;
      const ef = e.position.y;
      if(!enemyCollides(nx, e.position.z, 0.4, ef)) e.position.x = nx;
      if(!enemyCollides(e.position.x, nz, 0.4, ef)) e.position.z = nz;
      e.position.y = groundHeightAt(e.position.x, e.position.z, ef);
      // Model walk animation: unpause the mixer's walk action.
      if(e.userData.walkAction){
        e.userData.walkAction.paused = false;
        e.userData.walkAction.timeScale = 3;   // match the faster stride
      }
      // (legacy primitive legs, if any)
      e.userData.walkPhase += 0.18;
      const swing = Math.sin(e.userData.walkPhase) * 0.35;
      if(e.userData.legL) e.userData.legL.rotation.x = swing;
      if(e.userData.legR) e.userData.legR.rotation.x = -swing;
    } else {
      // Standing still at firing range: freeze the walk.
      if(e.userData.walkAction) e.userData.walkAction.paused = true;
      if(e.userData.legL) e.userData.legL.rotation.x = 0;
      if(e.userData.legR) e.userData.legR.rotation.x = 0;
    }

    // Attack — gunner: line-of-sight check then fire
    {
      if(dist < 30 && now - e.userData.lastAttack > 1400){
        const ey = 1.55;
        if(!isBlocked(e.position.x, ey, e.position.z, playerPos.x, playerPos.y, playerPos.z)){
          e.userData.lastAttack = now;
          const bm = new THREE.Mesh(_eBulletGeo, _eBulletMat);
          bm.position.set(e.position.x, ey, e.position.z);
          const tdx = playerPos.x - e.position.x;
          const tdz = playerPos.z - e.position.z;
          const tdy = playerPos.y - ey;
          const tlen = Math.hypot(tdx, tdy, tdz);
          // Add slight aim error
          const err = 0.04;
          const vel = new THREE.Vector3(
            tdx/tlen + (Math.random()-0.5)*err,
            tdy/tlen + (Math.random()-0.5)*err,
            tdz/tlen + (Math.random()-0.5)*err
          ).normalize().multiplyScalar(2.7);
          bm.userData = { vel, life: 0 };
          scene.add(bm); enemyBullets.push(bm);
          playEnemyShot();
          // Arm aim animation
          if(e.userData.armPivot){
            const aimAngle = -Math.atan2(tdy, Math.hypot(tdx, tdz));
            e.userData.armPivot.rotation.x = aimAngle - Math.PI/2;
          }
        }
      }
    }
  }

  {
    const tDraw = performance.now();
    _perfLogic = tDraw - _perfT0;
    // Hide buildings that are behind other buildings. Three.js only
    // frustum-culls, so on a street grid most of the town is submitted every
    // frame despite being solidly occluded. Spread over frames — see
    // updateStructureCulling in the map.
    if(typeof updateStructureCulling === 'function') updateStructureCulling(camera);

    renderer.render(scene, camera);
    _perfDraw = performance.now() - tDraw;
  }
}

resetAllAmmo();
syncAmmoIn();
preloadWeapons();
updateHUD();
updateMoneyUI();