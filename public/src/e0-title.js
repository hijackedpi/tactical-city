// ════════════════════════════════════════════════════════════════════════════
//  e0-title.js — the title screen
//
//  Self-contained: injects its own CSS and restyles the existing screens rather
//  than editing index.template.html. The lobby (d0-net.js) IS the title screen;
//  this file dresses it.
//
//  THE BACKDROP: TWO WORLDS
//  The backdrop is not the live 3D map (that tied the front door to one level).
//  It is a painted, animated split of the game's two maps, the palace at dusk
//  and the jungle ruins in mist, divided by a diagonal seam that follows the
//  lobby's map picker (TTScene below). It is cheap: the scenery is painted once
//  per resize, and the 3D scene underneath is throttled to a trickle while the
//  title is up (still rendering occasionally so shaders and textures are warm
//  and the first deployed frame does not hitch).
//
//  Everything that decides WHEN the title is showing is unchanged:
//  _titleShouldRun() is still the single source of truth, h0-self.js and
//  j0-knife.js still ask it, and the solo-pause override at the bottom of this
//  file still wraps it.
// ════════════════════════════════════════════════════════════════════════════

(function injectTitleStyles(){
  const css = `
  :root{
    --tt-font:'Saira Condensed','Stratum2','Arial Narrow',sans-serif;
    --tt-gold:#dca24c; --tt-gold-hi:#f5d68d; --tt-cream:#f4ecdc;
    --tt-t:#e0a35a; --tt-ct:#6fa3dc; --tt-muted:#8f98a6; --tt-line:rgba(220,162,76,.24);
  }

  /* ── backdrop + chrome layers. scene 398 < lobby 400 < chrome 401; the
     chrome is click-through and sits above the lobby so its scrim cannot dim it ── */
  #tt-scene{position:fixed;inset:0;width:100%;height:100%;display:block;z-index:398;
    pointer-events:none;opacity:0;visibility:hidden;
    transition:opacity .9s ease, visibility 0s linear .9s}
  #tt-chrome{position:fixed;inset:0;z-index:401;pointer-events:none;opacity:0;visibility:hidden;
    transition:opacity .7s ease, visibility 0s linear .7s;font-family:var(--tt-font);color:var(--tt-cream)}
  body.title-mode #tt-scene, body.title-mode #tt-chrome{opacity:1;visibility:visible;
    transition:opacity .9s ease, visibility 0s}

  /* scanlines + vignette, drawn once in CSS rather than per frame */
  #tt-chrome > *{position:absolute;z-index:1}
  #tt-chrome::before{content:'';position:absolute;inset:0;
    background:repeating-linear-gradient(180deg,rgba(255,255,255,.018) 0 1px,transparent 1px 3px);
    mix-blend-mode:overlay}
  #tt-chrome::after{content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse 120% 100% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%)}

  .tt-corner{position:absolute;width:26px;height:26px;border:0 solid rgba(245,214,141,.42)}
  .tt-corner.tl{top:18px;left:18px;border-top-width:2px;border-left-width:2px}
  .tt-corner.tr{top:18px;right:18px;border-top-width:2px;border-right-width:2px}
  .tt-corner.bl{bottom:18px;left:18px;border-bottom-width:2px;border-left-width:2px}
  .tt-corner.br{bottom:18px;right:18px;border-bottom-width:2px;border-right-width:2px}

  .tt-top,.tt-bot{position:absolute;left:54px;right:54px;display:flex;align-items:center;gap:22px;
    font-size:12px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#a79c88}
  .tt-top{top:22px}
  .tt-bot{bottom:22px;color:#9a917f}
  .tt-mark{display:flex;align-items:center;gap:10px;color:var(--tt-cream);font-weight:800;letter-spacing:.26em}
  .tt-mark svg{width:22px;height:22px;display:block}
  .tt-sep{flex:1;height:1px;background:linear-gradient(90deg,rgba(220,162,76,.35),rgba(220,162,76,0))}
  .tt-top .tt-sep.r{background:linear-gradient(270deg,rgba(220,162,76,.35),rgba(220,162,76,0))}
  .tt-stat{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .tt-stat b{color:var(--tt-cream);font-weight:700;font-variant-numeric:tabular-nums}
  .tt-led{width:7px;height:7px;border-radius:50%;background:#e0a35a;box-shadow:0 0 10px #e0a35a}
  .tt-led.on{background:#6fdc95;box-shadow:0 0 10px #6fdc95;animation:ttPulse 2.4s ease-in-out infinite}
  .tt-clock{font-variant-numeric:tabular-nums;color:var(--tt-cream)}
  .tt-tip{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
  .tt-tip i{font-style:normal;color:#11151b;background:var(--tt-gold);padding:3px 7px 2px;font-weight:800;letter-spacing:.18em;font-size:10.5px}
  .tt-tip span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d3c9b6;letter-spacing:.12em;
    transition:opacity .45s ease, transform .45s ease}
  .tt-tip span.out{opacity:0;transform:translateY(6px)}

  /* ── the lobby becomes a two-column composition over the backdrop ── */
  #net-lobby, #net-room{ background:transparent !important; backdrop-filter:none !important; }
  #net-lobby:not(.net-hide){
    display:grid !important;
    grid-template-columns:minmax(0,1fr) minmax(330px,420px);
    align-items:center; align-content:safe center;
    column-gap:clamp(28px,6vw,110px); row-gap:28px;
    padding:clamp(72px,11vh,120px) clamp(28px,6.5vw,110px) clamp(70px,10vh,110px);
    box-sizing:border-box; overflow-y:auto; overflow-x:hidden;
  }
  /* readability scrim: dark on the left under the logo, and along the floor */
  #net-lobby::before, #net-room::before{
    content:''; position:fixed; inset:0; pointer-events:none; z-index:-1;
    background:
      linear-gradient(90deg, rgba(4,6,10,.72) 0%, rgba(4,6,10,.30) 42%, rgba(4,6,10,0) 62%, rgba(4,6,10,.35) 100%),
      linear-gradient(180deg, rgba(4,6,10,0) 55%, rgba(4,6,10,.75) 100%);
  }
  #net-lobby, #net-room{ isolation:isolate; }

  /* ── hero ── */
  .tt-hero{ position:relative; min-width:0; }
  .tt-kick{display:inline-flex;align-items:center;gap:12px;
    font:700 13px/1 var(--tt-font);letter-spacing:.42em;text-transform:uppercase;color:var(--tt-gold);
    margin-bottom:clamp(14px,2.4vh,24px); opacity:0; animation:tFade .7s .1s ease-out forwards}
  .tt-kick::before{content:'';width:34px;height:2px;background:var(--tt-gold)}

  .tt-logo{margin:0;font-family:var(--tt-font);font-weight:900;line-height:.8;text-transform:uppercase;
    transform:skewX(-7deg);transform-origin:left bottom;user-select:none;white-space:nowrap}
  .tt-logo .tt-ln{position:relative;display:block;width:max-content}
  .tt-l1{font-size:clamp(46px,min(7.4vw,12.5vh),142px);letter-spacing:.035em;color:var(--tt-gold);
    text-shadow:0 0 42px rgba(220,162,76,.35), 0 6px 30px rgba(0,0,0,.65)}
  .tt-l2{font-size:clamp(92px,min(15.8vw,26.5vh),300px);letter-spacing:.012em;color:var(--tt-cream);
    margin-top:clamp(2px,.6vh,8px);
    text-shadow:0 10px 60px rgba(0,0,0,.85), 0 0 1px rgba(255,240,214,.4)}
  .tt-l1 .tl.dim{color:inherit}
  .tt-ln .tl{display:inline-block;opacity:0;transform:translateY(.28em) scaleY(1.15);
    animation:tRise .65s cubic-bezier(.2,.9,.25,1) forwards}
  /* light sweep: a clipped duplicate of the word, painted with a moving glint */
  .tt-ln::after{content:attr(data-text);position:absolute;left:0;top:0;pointer-events:none;
    color:transparent;-webkit-background-clip:text;background-clip:text;
    background-image:linear-gradient(100deg,transparent 42%,rgba(255,250,235,.95) 50%,transparent 58%);
    background-size:260% 100%;background-repeat:no-repeat;background-position:160% 0;
    text-shadow:none;
    animation:ttSweep 7s 1.6s ease-in-out infinite}
  .tt-l2::after{animation-delay:1.8s}
  /* occasional glitch, toggled from JS */
  /* the shadows live inside the keyframes, so the effect ends on its own even
     if the timer that removes the class is late (a long frame, a busy tab) */
  .tt-logo.glitch .tt-l2{animation:ttJit .28s steps(3) 1}
  .tt-logo.glitch .tt-l1{animation:ttJit1 .28s steps(3) 1}

  .tt-rule{display:flex;align-items:center;gap:10px;margin:clamp(16px,2.8vh,28px) 0 clamp(12px,2vh,18px);
    opacity:0;animation:tFade .6s .75s ease-out forwards}
  .tt-rule i{display:block;height:3px;width:clamp(120px,16vw,240px);
    background:linear-gradient(90deg,var(--tt-t),var(--tt-gold-hi) 50%,var(--tt-ct));
    transform-origin:left center;animation:tGrow .9s .75s cubic-bezier(.22,.9,.28,1) both}
  .tt-rule b{font:800 12px/1 var(--tt-font);letter-spacing:.3em;color:#a39a89;text-transform:uppercase}
  .tt-rule b u{text-decoration:none;color:var(--tt-t)} .tt-rule b s{text-decoration:none;color:var(--tt-ct)}
  .tt-tag{margin:0 0 8px;font:800 clamp(20px,2.1vw,30px)/1.15 var(--tt-font);letter-spacing:.08em;
    text-transform:uppercase;color:var(--tt-cream);opacity:0;animation:tFade .7s .85s ease-out forwards}
  .tt-tag em{font-style:normal;color:var(--tt-gold)}
  .tt-sub{margin:0 0 clamp(16px,2.6vh,24px);max-width:48ch;font:500 16px/1.55 var(--tt-font);
    letter-spacing:.03em;color:#b8ad99;opacity:0;animation:tFade .7s .95s ease-out forwards}
  .tt-chips{display:flex;flex-wrap:wrap;gap:8px;opacity:0;animation:tFade .7s 1.05s ease-out forwards}
  .tt-chip{display:flex;align-items:center;gap:8px;padding:8px 13px 7px;
    font:700 12px/1 var(--tt-font);letter-spacing:.18em;text-transform:uppercase;color:#d9cfbd;
    background:rgba(12,15,21,.55);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(6px)}
  .tt-chip b{color:var(--tt-gold-hi);font-weight:800}
  .tt-chip.t{box-shadow:inset 3px 0 0 var(--tt-t)} .tt-chip.ct{box-shadow:inset 3px 0 0 var(--tt-ct)}

  /* ── panel: the deploy card ── */
  #net-lobby #net-panel, #net-room #net-panel{
    position:relative; justify-self:end; width:100% !important; max-width:420px;
    box-sizing:border-box; margin:0;
    background:linear-gradient(180deg,rgba(17,21,28,.80),rgba(9,12,17,.88)) !important;
    backdrop-filter:blur(16px) saturate(1.15);
    border:1px solid rgba(255,255,255,.07) !important; border-top:none !important;
    box-shadow:0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04) !important;
    padding:0 22px 16px !important;
    font-family:var(--tt-font);
    opacity:0; animation:tSlide .7s .55s cubic-bezier(.2,.9,.25,1) forwards;
  }
  #net-room #net-panel{justify-self:center;max-width:460px}
  #net-lobby #net-panel::before, #net-room #net-panel::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;
    background:linear-gradient(90deg,var(--tt-t),var(--tt-gold-hi) 50%,var(--tt-ct))}
  .tt-ph{display:flex;align-items:center;gap:10px;margin:0 -22px 14px;padding:16px 22px 13px;
    border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
  .tt-ph span{font:800 18px/1 var(--tt-font);letter-spacing:.24em;text-transform:uppercase;color:var(--tt-cream)}
  .tt-ph em{margin-left:auto;display:flex;align-items:center;gap:7px;font:700 11px/1 var(--tt-font);
    font-style:normal;letter-spacing:.18em;text-transform:uppercase;color:#8f98a6}
  #net-lobby #net-panel h2{ display:none !important; }
  #net-room #net-panel h2{font:800 22px/1 var(--tt-font) !important;letter-spacing:.2em !important;margin:20px 0 6px !important}
  #net-lobby #net-panel .sub, #net-room #net-panel .sub{
    margin:0 0 14px !important; font:500 14px/1.45 var(--tt-font) !important; color:#9a917f !important; letter-spacing:.03em;
  }
  #net-lobby .net-sec, #net-room .net-sec{font:700 11px/1 var(--tt-font);letter-spacing:.24em;color:#8a806e;margin:16px 0 9px}
  #net-lobby .net-sec::after{background:linear-gradient(90deg,rgba(220,162,76,.3),rgba(220,162,76,0))}
  #net-lobby .net-in, #net-room .net-in{background:rgba(5,7,10,.65);border:1px solid rgba(255,255,255,.09);
    font:700 16px/1 var(--tt-font);letter-spacing:.14em;padding:12px 14px;transition:border-color .15s, box-shadow .15s}
  #net-lobby .net-in:focus, #net-room .net-in:focus{border-color:var(--tt-gold);box-shadow:0 0 0 3px rgba(220,162,76,.16)}
  #net-lobby .net-in::placeholder{color:#5d5a53}
  #net-lobby .net-btn, #net-room .net-btn{position:relative;overflow:hidden;
    font:800 14px/1 var(--tt-font);letter-spacing:.2em;padding:13px 18px 12px;
    clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);
    transition:filter .15s, transform .15s, color .15s, background .15s}
  #net-lobby .net-btn:not(.ghost), #net-room .net-btn:not(.ghost){background:linear-gradient(180deg,#f3d387,#cf9a43);color:#1d1408}
  #net-lobby .net-btn:not(.ghost):hover, #net-room .net-btn:not(.ghost):hover{filter:brightness(1.1);transform:translateY(-1px)}
  #net-lobby .net-btn:not(.ghost)::after, #net-room .net-btn:not(.ghost)::after{content:'';position:absolute;top:0;bottom:0;width:40%;left:-60%;
    background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);transition:left .5s ease}
  #net-lobby .net-btn:not(.ghost):hover::after, #net-room .net-btn:not(.ghost):hover::after{left:130%}
  #net-lobby .net-btn.ghost, #net-room .net-btn.ghost{background:rgba(255,255,255,.035);color:#b5ad9f;border:1px solid rgba(255,255,255,.1)}
  #net-lobby .net-btn.ghost:hover, #net-room .net-btn.ghost:hover{background:rgba(220,162,76,.1);color:var(--tt-cream);border-color:rgba(220,162,76,.45)}
  #net-lobby .net-btn:active{transform:translateY(1px)}
  #net-lobby .net-games{border:1px solid rgba(255,255,255,.07);background:rgba(4,6,9,.5);max-height:190px}
  #net-lobby .net-g{font:600 14px/1.2 var(--tt-font);letter-spacing:.04em;transition:background .15s}
  #net-lobby .net-g:hover{background:rgba(220,162,76,.06)}
  #net-lobby .net-g button{font:800 11px/1 var(--tt-font);letter-spacing:.16em;background:var(--tt-gold)}
  #net-lobby .net-empty{font:500 13.5px/1.5 var(--tt-font);color:#7a756b}
  #net-lobby .net-mini{font:700 10px/1 var(--tt-font)}
  #net-lobby .net-err{font-family:var(--tt-font)}
  #net-lobby #net-solo{border-color:rgba(111,163,220,.35);color:#c9dbef}
  #net-lobby #net-solo:hover{background:rgba(111,163,220,.12);border-color:rgba(111,163,220,.7);color:#fff}
  #net-room .net-code{font:800 40px/1 var(--tt-font);letter-spacing:.42em;color:var(--tt-gold-hi);
    background:rgba(4,6,9,.6);border:1px dashed rgba(220,162,76,.4)}
  #net-room .net-list{border-color:rgba(255,255,255,.07)}
  #net-room .net-p{font-family:var(--tt-font)}

  .tt-maps{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tt-map{display:flex;align-items:center;gap:10px;padding:7px;cursor:pointer;text-align:left;
    background:rgba(4,6,9,.5);border:1px solid rgba(255,255,255,.08);color:#d9cfbd;
    font-family:var(--tt-font);transition:border-color .15s, background .15s}
  .tt-map:hover{border-color:rgba(220,162,76,.5);background:rgba(220,162,76,.06)}
  .tt-map.on{border-color:var(--tt-gold);background:rgba(220,162,76,.1);box-shadow:inset 0 0 0 1px rgba(220,162,76,.35)}
  .tt-map-img{border:1px solid rgba(255,255,255,.08);line-height:0}
  .tt-map-txt{display:flex;flex-direction:column;gap:4px;min-width:0}
  .tt-map-txt b{font:800 15px/1 var(--tt-font);letter-spacing:.14em;text-transform:uppercase;color:var(--tt-cream)}
  .tt-map-txt em{font:700 10px/1 var(--tt-font);font-style:normal;letter-spacing:.18em;text-transform:uppercase;color:#8a806e}
  .tt-map.on .tt-map-txt em{color:var(--tt-gold)}
  .tt-map-blurb{margin:8px 0 2px;font:500 13px/1.4 var(--tt-font);color:#8f877a;letter-spacing:.02em}

  /* ── adaptive layout ── */
  @media (max-width:960px){
    #net-lobby:not(.net-hide){grid-template-columns:minmax(0,1fr);align-content:start;
      padding:84px 22px 76px;row-gap:26px}
    #net-lobby #net-panel{justify-self:stretch;max-width:560px}
    .tt-l1{font-size:clamp(40px,11vw,110px)} .tt-l2{font-size:clamp(78px,23vw,220px)}
    .tt-top .tt-hide-sm, .tt-sep, .tt-bot, .tt-corner{display:none}
    .tt-top{top:0;left:0;right:0;padding:16px 20px 26px;justify-content:space-between;
      background:linear-gradient(180deg,rgba(4,6,10,.94) 40%,rgba(4,6,10,0))}
    #tt-chrome::after{display:none}
    .tt-kick{letter-spacing:.28em;font-size:12px}
    #net-lobby::before{background:linear-gradient(180deg,rgba(4,6,10,.45),rgba(4,6,10,.8))}
  }
  @media (max-width:560px){
    .tt-top,.tt-bot{left:20px;right:20px;gap:14px;font-size:10.5px}
    .tt-corner{display:none}
    .tt-tip i{display:none}
    .tt-sub{font-size:15px}
  }
  @media (max-height:780px) and (min-width:961px){
    #net-lobby:not(.net-hide){padding-top:64px;padding-bottom:56px}
    #net-lobby .net-games{max-height:118px}
    .tt-ph{padding:12px 22px 10px;margin-bottom:10px}
    #net-lobby .net-sec{margin:10px 0 7px}
    #net-lobby #net-panel .sub{display:none}
    #net-lobby .net-row{margin-bottom:9px}
    #net-lobby .net-btn{padding:11px 16px 10px}
  }
  @media (max-height:640px) and (min-width:961px){
    .tt-sub,.tt-chips{display:none}
    .tt-l1{font-size:min(7vw,11vh)} .tt-l2{font-size:min(14vw,22vh)}
  }

  @keyframes tFade{ to{ opacity:1 } }
  @keyframes tRise{ to{ opacity:1; transform:none } }
  @keyframes tGrow{ from{ transform:scaleX(0) } to{ transform:none } }
  @keyframes tSlide{ from{ opacity:0; transform:translateX(26px) } to{ opacity:1; transform:none } }
  @keyframes ttSweep{ 0%{background-position:160% 0} 22%,100%{background-position:-60% 0} }
  @keyframes ttJit{
    0%,99%{text-shadow:-4px 0 rgba(255,70,60,.75), 4px 0 rgba(80,190,255,.75), 0 10px 60px rgba(0,0,0,.85)}
    0%{transform:translate(0,0)} 33%{transform:translate(-3px,1px)} 66%{transform:translate(3px,-1px)} 100%{transform:none} }
  @keyframes ttJit1{ 0%,99%{text-shadow:-3px 0 rgba(255,70,60,.6), 3px 0 rgba(80,190,255,.6)} }
  @keyframes ttPulse{ 50%{ opacity:.45 } }

  /* The HUD must not show through the title screen. */
  body.title-mode #crosshair, body.title-mode #cs-health, body.title-mode #cs-money,
  body.title-mode #cs-ammo, body.title-mode #cs-slots, body.title-mode #cs-pickup-prompt,
  body.title-mode #reload-msg, body.title-mode #enter-prompt, body.title-mode #speedo,
  body.title-mode #shop-btn{ display:none !important; }

  @media (prefers-reduced-motion:reduce){
    .tt-kick,.tt-ln .tl,.tt-rule,.tt-rule i,.tt-tag,.tt-sub,.tt-chips,
    #net-lobby #net-panel,#net-room #net-panel{
      animation:none !important; opacity:1 !important; transform:none !important;
    }
    .tt-ln::after{display:none}
    .tt-led.on{animation:none}
  }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

// ── LETTERING ───────────────────────────────────────────────────────────────
// Split into per-letter spans so they can rise in sequence. Spaces become
// non-breaking: each letter is an inline-block, and a plain space inside one
// collapses to nothing. `delay0` offsets the whole word's entrance.
function _titleSplit(el, text, delay0){
  el.innerHTML = '';
  const cut = text.indexOf(' ');
  const d0 = (typeof delay0 === 'number') ? delay0 : 0.18;
  [...text].forEach((ch, i) => {
    const sp = document.createElement('span');
    sp.className = 'tl' + (ch === '_' || (cut > 0 ? i < cut : i < 3) ? ' dim' : '');
    sp.textContent = ch === ' ' ? ' ' : ch;
    sp.style.animationDelay = (d0 + i * 0.045).toFixed(3) + 's';
    el.appendChild(sp);
  });
}

// ── HERO + CHROME ───────────────────────────────────────────────────────────
// The lobby IS the title screen: the hero goes in as the left column, and
// d0-net's panel stays a direct child as the right column.
const TT_TIPS = [
  'Headshots hit hardest. Aim at head height and keep your crosshair there',
  'Press B during buy time to open the armory',
  'SMG kills pay $600, twice what a rifle kill pays',
  'A knife kill pays $1,500',
  'Hold Tab to see the scoreboard',
  'Sides swap after round 7. First team to 8 wins',
  'Right-click to scope with the AWP',
  'Buying a new primary drops the one you were carrying',
  'Share a 4-letter code to bring friends into a private game',
];


// ── MAP PLANS ───────────────────────────────────────────────────────────────
// Top-down plans for the lobby's map cards and the "The map" help tab. Both
// maps' plans are available whichever one is loaded: Overgrowth's comes from
// its own layout table, the palace's footprints are copied here (its table
// only exists while the palace is the map being built).
const PALACE_PLAN = [
  [3,24,16.5,45],[-32,-1,-9.5,9.5],[21.5,17.5,45,33.75],[-45,-45,-29.5,-31],[-8.5,-45,8.5,-22],[34.5,-5,45,12.5],[16.75,-8.5,29.5,6],[-25.5,-21.5,-13,-5],[1,2,11.5,19],[-23.75,20.5,-2,45],[-45,13.5,-31.5,31],[-45,-9,-36,8.5],[16.25,-24.5,39,-13.5],[-24.5,-45,-13.5,-26.5],[13.5,-45,35,-29.5],
  [40.5,40.5,44.25,44.25],[15,9.5,20,14.5],   // the two watchtowers
];
function ttPlanSVG(id, size, labels){
  const px = x => ((x + 47) / 94 * 200).toFixed(1);
  const py = z => ((47 - z) / 94 * 200).toFixed(1);
  const rect = (x0, z0, x1, z1, fill, stroke, extra) =>
    `<rect x="${px(x0)}" y="${py(z1)}" width="${(px(x1)-px(x0)).toFixed(1)}" height="${(py(z0)-py(z1)).toFixed(1)}" fill="${fill}" stroke="${stroke||'none'}" stroke-width="1" ${extra||''}/>`;
  const txt = (x, z, t, col, fs) =>
    `<text x="${px(x)}" y="${(+py(z) + fs*.35).toFixed(1)}" fill="${col}" font-size="${fs}" font-weight="800" text-anchor="middle" font-family="'Saira Condensed',sans-serif">${t}</text>`;
  let b = '';
  if(id === 'overgrowth' && window.OVERGROWTH){
    const O = window.OVERGROWTH;
    b += rect(-45,-45,45,45,'#18221a','#3f5a34');
    b += rect(-45,O.river.z0,45,O.river.z1,'#24463f');
    const t = O.spawns.t, c = O.spawns.ct;
    b += rect(t.x0,t.z0,t.x1,t.z1,'rgba(224,163,90,.35)','#e0a35a');
    b += rect(c.x0,c.z0,c.x1,c.z1,'rgba(111,163,220,.35)','#6fa3dc');
    for(const s of O.solids) b += rect(s[0],s[1],s[2],s[3],'#5b5c4a','#23241c');
    // long ruin blocks, drawn at their real angle
    for(const [cx, cz, L, deg] of (O.walls || [])){
      const D = L * .515, ux = Math.cos(deg * Math.PI / 180), uz = Math.sin(deg * Math.PI / 180);
      const c = [[-L/2,-D/2],[L/2,-D/2],[L/2,D/2],[-L/2,D/2]].map(([a, e]) =>
        px(cx + ux * a - uz * e) + ',' + py(cz + uz * a + ux * e)).join(' ');
      b += `<polygon points="${c}" fill="#5b5c4a" stroke="#23241c" stroke-width="1"/>`;
    }
    for(const l of O.low) b += rect(l[0],l[1],l[2],l[3],'#8a7f5c');
    const tu = O.tunnel;
    b += rect(tu.x0,tu.z0,tu.x1,tu.z1,'none','#c9b27a','stroke-dasharray="3 2" opacity=".8"');
    if(labels !== false){
      const sc = (z) => [(z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2];
      b += txt(...sc(t),'T','#e0a35a',9) + txt(...sc(c),'CT','#6fa3dc',8);
      b += txt(-30,-19,'PLAINS','#c9d8a8',7) + txt(29,40,'WARREN','#c9d8a8',7);
      b += txt(-1,-0.6,'MID','#e8e4dc',6) + txt(40.5,23.4,'TUNNEL','#8fa184',4.5);
    }
  } else {
    b += rect(-45,-45,45,45,'#221e17','#5d4a2c');
    b += rect(-45,35,-35,45,'rgba(224,163,90,.35)','#e0a35a');
    b += rect(35,-45,45,-35,'rgba(111,163,220,.35)','#7fa8d8');
    for(const r of PALACE_PLAN) b += rect(r[0],r[1],r[2],r[3],'#6a5a40','#2a2418');
    if(labels !== false){
      b += txt(33,41,'GREAT COURT','#d9c49a',6) + txt(-37,-28,'BAZAAR','#d9c49a',6);
      b += txt(-40,40,'T','#e0a35a',9) + txt(40,-40,'CT','#7fa8d8',8);
    }
  }
  return `<svg viewBox="-4 -4 208 208" width="${size}" height="${size}" style="display:block;flex:0 0 auto">${b}</svg>`;
}
window.ttPlanSVG = ttPlanSVG;

(function buildLobbyTitle(){
  const lobby = document.getElementById('net-lobby');
  if(!lobby) return;                       // d0-net absent: fallback button only
  const panel = lobby.querySelector('#net-panel');

  const nGuns = (typeof GUNS === 'object') ? Object.keys(GUNS).filter(k => !GUNS[k].melee).length : 9;

  const hero = document.createElement('div');
  hero.className = 'tt-hero';
  hero.innerHTML =
    '<div class="tt-kick">Round-based tactical shooter &middot; 2 maps</div>' +
    '<h1 class="tt-logo" aria-label="Tactical City">' +
      '<span class="tt-ln tt-l1" data-text="TACTICAL"></span>' +
      '<span class="tt-ln tt-l2" data-text="CITY"></span>' +
    '</h1>' +
    '<div class="tt-rule"><i></i><b><u>T</u> &nbsp;vs&nbsp; <s>CT</s></b></div>' +
    '<p class="tt-tag">Buy. Plan. <em>Breach.</em> Hold the line.</p>' +
    '<p class="tt-sub">Fast 5v5 rounds, right in your browser. Nothing to install. ' +
      'Share a code, pick a side and win the round.</p>' +
    '<div class="tt-chips">' +
      '<div class="tt-chip t"><b>5v5</b> Online</div>' +
      '<div class="tt-chip ct"><b>' + nGuns + '</b> Weapons</div>' +
      '<div class="tt-chip"><b>$</b> Round economy</div>' +
      '<div class="tt-chip"><b>' + (typeof MAPS === 'object' ? Object.keys(MAPS).length : 1) + '</b> Maps</div>' +
    '</div>';
  lobby.insertBefore(hero, panel);
  _titleSplit(hero.querySelector('.tt-l1'), 'TACTICAL', 0.22);
  _titleSplit(hero.querySelector('.tt-l2'), 'CITY', 0.42);

  // Panel header: a status line in place of the hidden h2.
  if(panel){
    const ph = document.createElement('div');
    ph.className = 'tt-ph';
    ph.innerHTML = '<span>Deploy</span><em><i class="tt-led" id="tt-net-led"></i><span id="tt-net-txt">Connecting</span></em>';
    panel.insertBefore(ph, panel.firstChild);

    // Map picker. The page builds one map at load, so choosing another stores
    // the choice and reloads. Rooms carry their map: create one and it is on
    // yours; join one and you are moved onto its map.
    const nameRow = panel.querySelector('#net-name') && panel.querySelector('#net-name').closest('.net-row');
    if(nameRow && typeof MAPS === 'object'){
      const wrap = document.createElement('div');
      wrap.innerHTML = '<div class="net-sec"><span>Map</span></div><div class="tt-maps">' +
        Object.keys(MAPS).map(id =>
          '<button type="button" class="tt-map' + (id === MAP_ID ? ' on' : '') + '" data-map="' + id + '">' +
            '<span class="tt-map-img">' + ttPlanSVG(id, 58, false) + '</span>' +
            '<span class="tt-map-txt"><b>' + MAPS[id].name + '</b><em>' +
              (id === MAP_ID ? 'Loaded' : 'Switch map') + '</em></span>' +
          '</button>').join('') + '</div>' +
        '<p class="tt-map-blurb">' + MAPS[MAP_ID].blurb + '</p>';
      nameRow.after(...wrap.childNodes);
      // hovering a card slides the backdrop's seam toward that map's world
      panel.querySelectorAll('.tt-map').forEach(btn => {
        btn.addEventListener('mouseenter', () => { if(typeof TTScene === 'object') TTScene.hover(btn.dataset.map); });
        btn.addEventListener('mouseleave', () => { if(typeof TTScene === 'object') TTScene.hover(null); });
        btn.addEventListener('focus',      () => { if(typeof TTScene === 'object') TTScene.hover(btn.dataset.map); });
        btn.addEventListener('blur',       () => { if(typeof TTScene === 'object') TTScene.hover(null); });
      });
      panel.querySelectorAll('.tt-map').forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.map;
        if(id === MAP_ID) return;
        if(typeof netSwitchMap === 'function') netSwitchMap(id);
        else { try { localStorage.setItem('tc.map', id); } catch(e){} location.reload(); }
      }));
    }
  }

  // Occasional glitch on the logo. Rare enough to feel like an accident.
  const logo = hero.querySelector('.tt-logo');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduced){
    (function glitch(){
      setTimeout(() => {
        if(document.body.classList.contains('title-mode')){
          logo.classList.add('glitch');
          setTimeout(() => logo.classList.remove('glitch'), 280);
        }
        glitch();
      }, 7000 + Math.random() * 7000);
    })();
  }
})();

(function buildChrome(){
  const ch = document.createElement('div');
  ch.id = 'tt-chrome';
  ch.innerHTML =
    '<div class="tt-corner tl"></div><div class="tt-corner tr"></div>' +
    '<div class="tt-corner bl"></div><div class="tt-corner br"></div>' +
    '<div class="tt-top">' +
      '<div class="tt-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<circle cx="12" cy="12" r="8"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/>' +
        '<circle cx="12" cy="12" r="1.6" fill="#dca24c" stroke="none"/></svg>Tactical City</div>' +
      '<div class="tt-sep"></div>' +
      '<div class="tt-stat tt-hide-sm">Public games <b id="tt-s-games">0</b></div>' +
      '<div class="tt-stat tt-hide-sm">In play <b id="tt-s-players">0</b></div>' +
      '<div class="tt-sep r"></div>' +
      '<div class="tt-stat"><span class="tt-clock" id="tt-clock">--:--</span></div>' +
    '</div>' +
    '<div class="tt-bot"><div class="tt-tip"><i>Intel</i><span id="tt-tip"></span></div></div>';
  document.body.appendChild(ch);

  const $ = id => document.getElementById(id);
  const tipEl = $('tt-tip');
  let tipI = Math.floor(Math.random() * TT_TIPS.length);
  tipEl.textContent = TT_TIPS[tipI];
  setInterval(() => {
    if(!document.body.classList.contains('title-mode')) return;
    tipEl.classList.add('out');
    setTimeout(() => {
      tipI = (tipI + 1) % TT_TIPS.length;
      tipEl.textContent = TT_TIPS[tipI];
      tipEl.classList.remove('out');
    }, 450);
  }, 6500);

  // Live readouts. Cheap, and only while the title is up.
  function tick(){
    if(!document.body.classList.contains('title-mode')) return;
    const d = new Date();
    $('tt-clock').textContent = d.toTimeString().slice(0, 8);
    const rooms = (typeof netRooms !== 'undefined' && Array.isArray(netRooms)) ? netRooms : [];
    $('tt-s-games').textContent = rooms.length;
    $('tt-s-players').textContent = rooms.reduce((a, r) => a + (+r.players || 0), 0);
    const on = (typeof netSocket !== 'undefined' && netSocket && netSocket.connected);
    const led = $('tt-net-led'), txt = $('tt-net-txt');
    if(led){ led.classList.toggle('on', !!on); }
    if(txt){ txt.textContent = on ? 'Online' : 'Offline, solo only'; }
  }
  tick();
  setInterval(tick, 1000);
})();

// ════════════════════════════════════════════════════════════════════════════
//  TTScene — "TWO WORLDS", the animated title backdrop
//
//  The screen is split by a glowing diagonal seam into the game's two maps,
//  both painted procedurally on a 2D canvas:
//
//    PALACE (left)      dusk: violet-to-gold sky, a low swollen sun, palace
//                       silhouettes with domes, minarets and warm-lit arches,
//                       palms and a crenellated wall in the foreground,
//                       gliding birds and drifting desert dust
//    OVERGROWTH (right) green mist: light shafts through the canopy, a stepped
//                       pyramid, the tower and the colossus head in silhouette,
//                       vast trunks and swaying vines in the foreground,
//                       fireflies, falling leaves and rolling ground mist
//
//  The seam is not fixed. The loaded map owns most of the screen; hovering a
//  map card in the lobby slides the seam so that world takes over, and each
//  world slides with it so its landmark stays centred in the space it has.
//
//  Static scenery is painted once per resize into layer canvases; per frame
//  only the skies, the animated extras and the composite are drawn.
// ════════════════════════════════════════════════════════════════════════════
const TTScene = (function(){
  const cv = document.createElement('canvas');
  cv.id = 'tt-scene';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, DPR = 1, PAD = 0;
  let P = null, J = null, grain = null;          // pre-rendered worlds
  let running = false, raf = 0, last = 0, T = 0;
  let mx = 0, my = 0, smx = 0, smy = 0;

  // ── seam control ──────────────────────────────────────────────────────────
  // split = fraction of the screen width given to the palace (left world)
  const SPLIT = { alcazar: .62, overgrowth: .30, none: .5 };
  const HOVER = { alcazar: .86, overgrowth: .14 };
  const loaded = (typeof MAP_ID === 'string' && SPLIT[MAP_ID] !== undefined) ? MAP_ID : 'none';
  let hoverId = null;
  let split = SPLIT[loaded], splitTarget = split;

  function rng(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function layer(){
    const c = document.createElement('canvas');
    c.width = Math.ceil((W + PAD * 2) * DPR); c.height = Math.ceil(H * DPR);
    const g = c.getContext('2d'); g.scale(DPR, DPR); g.translate(PAD, 0);
    return [c, g];
  }

  // ── PALACE painting ─────────────────────────────────────────────────────────
  function dome(g, cx, base, r, drumH){
    g.fillRect(cx - r * 1.02, base - drumH, r * 2.04, drumH + 2);
    g.beginPath(); g.ellipse(cx, base - drumH, r, r * 1.08, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - r * .05, base - drumH - r * 1.08 - r * .35, r * .1, r * .4);
    g.beginPath(); g.arc(cx, base - drumH - r * 1.08 - r * .38, r * .09, 0, 6.283); g.fill();
  }
  function minaret(g, cx, base, h, w){
    g.fillRect(cx - w / 2, base - h, w, h + 2);
    g.fillRect(cx - w * .85, base - h * .72, w * 1.7, h * .035);     // balcony
    g.fillRect(cx - w * .7, base - h - h * .05, w * 1.4, h * .05);
    g.beginPath(); g.ellipse(cx, base - h - h * .05, w * .62, w * .9, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - w * .06, base - h - h * .05 - w * .9 - h * .08, w * .12, h * .08);
  }
  function crenels(g, x0, x1, top, h, step){
    for(let x = x0; x < x1; x += step) g.fillRect(x, top - h, step * .55, h + 1);
  }
  function arches(g, x0, x1, top, h, n, glow){
    const w = (x1 - x0) / n;
    for(let i = 0; i < n; i++){
      const ax = x0 + i * w + w * .22, aw = w * .56;
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(ax, top + h); g.lineTo(ax, top + aw * .5);
      g.ellipse(ax + aw / 2, top + aw * .5, aw / 2, aw * .55, 0, Math.PI, 0);
      g.lineTo(ax + aw, top + h); g.closePath(); g.fill();
    }
  }
  function palm(g, x, base, h, lean){
    g.lineWidth = Math.max(3, h * .035); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, base);
    g.quadraticCurveTo(x + lean * .4, base - h * .55, x + lean, base - h); g.stroke();
    const tx = x + lean, ty = base - h;
    for(let i = 0; i < 9; i++){
      const a = -Math.PI * .95 + i * (Math.PI * 1.1 / 8);
      const len = h * (.42 + (i % 3) * .06);
      g.lineWidth = Math.max(2, h * .018);
      g.beginPath(); g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * len * .6, ty + Math.sin(a) * len * .35 - len * .15,
                         tx + Math.cos(a) * len, ty + Math.sin(a) * len * .5 + len * .25);
      g.stroke();
    }
  }
  function buildPalace(){
    const r = rng(311);
    const far = layer(), mid = layer(), near = layer();
    // far: a long hazy skyline of the palace city
    { const g = far[1], base = H * .76;
      g.fillStyle = 'rgba(122,62,78,.72)';
      g.fillRect(-PAD, base, W + PAD * 2, H - base);
      for(let x = -PAD; x < W + PAD; ){
        const w = 30 + r() * 70, h = H * (.03 + r() * .07);
        g.fillRect(x, base - h, w, h + 1);
        if(r() < .35) dome(g, x + w / 2, base - h, w * .32, h * .15);
        else if(r() < .25) minaret(g, x + w * .5, base - h, H * (.09 + r() * .06), Math.max(5, w * .09));
        else crenels(g, x, x + w, base - h, 5, 9);
        x += w + r() * 14;
      }
    }
    // mid: the palace itself, centred on world x .36W
    { const g = mid[1], base = H * .83, cx = W * .36, R = Math.min(H * .13, W * .1);
      g.fillStyle = '#3a1e30';
      g.fillRect(cx - R * 4.4, base - H * .12, R * 8.8, H);                 // main block
      crenels(g, cx - R * 4.4, cx + R * 4.4, base - H * .12, 8, 16);
      dome(g, cx, base - H * .12, R, R * .55);                              // the great dome
      for(const s of [-1, 1]){
        minaret(g, cx + s * R * 2.6, base - H * .12, H * .36, R * .22);
        dome(g, cx + s * R * 1.55, base - H * .12, R * .42, R * .25);
        g.fillStyle = '#3a1e30';
        g.fillRect(cx + s * R * 5.6 - R * 1.1, base - H * .07, R * 2.2, H);   // side towers
        crenels(g, cx + s * R * 5.6 - R * 1.1, cx + s * R * 5.6 + R * 1.1, base - H * .07, 7, 14);
      }
      arches(g, cx - R * 4, cx + R * 4, base - H * .1, H * .07, 9, 'rgba(255,170,80,.55)');
      arches(g, cx - R * 4, cx + R * 4, base - H * .1, H * .07, 9, 'rgba(255,214,140,.18)');
      // a second, smaller palace wing off to the left
      g.fillStyle = '#3a1e30';
      const lx = cx - R * 9;
      g.fillRect(lx - R * 1.8, base - H * .08, R * 3.6, H);
      dome(g, lx, base - H * .08, R * .6, R * .3);
      minaret(g, lx + R * 2.2, base - H * .08, H * .26, R * .18);
      arches(g, lx - R * 1.5, lx + R * 1.5, base - H * .065, H * .05, 3, 'rgba(255,160,70,.45)');
    }
    // near: wall, palms, dark ground
    { const g = near[1], base = H * .93;
      g.fillStyle = '#170c14';
      g.fillRect(-PAD, base, W + PAD * 2, H);
      crenels(g, -PAD, W * .9, base, H * .035, 26);
      g.fillRect(-PAD, base - 4, W * .9 + PAD, 6);
      g.strokeStyle = '#170c14';
      palm(g, W * .04, base, H * .42, W * .03);
      palm(g, W * .12, base, H * .3, -W * .02);
      palm(g, W * .62, base, H * .36, W * .025);
      palm(g, -W * .08, base, H * .5, W * .05);
    }
    return { far: far[0], mid: mid[0], near: near[0] };
  }

  // ── JUNGLE painting ─────────────────────────────────────────────────────────
  function canopy(g, x0, x1, base, rMin, rMax, r){
    for(let x = x0; x < x1; x += rMin * .9){
      const rad = rMin + r() * (rMax - rMin);
      g.beginPath(); g.arc(x, base - rad * .5 + r() * rad * .4, rad, 0, 6.283); g.fill();
    }
  }
  function stepped(g, cx, base, w, h, tiers){
    for(let i = 0; i < tiers; i++){
      const tw = w * (1 - i / (tiers + .6)), th = h / tiers;
      g.fillRect(cx - tw / 2, base - th * (i + 1), tw, th + 1);
    }
  }
  function buildJungle(){
    const r = rng(733);
    const far = layer(), mid = layer(), near = layer();
    // far: misty canopy line with a pyramid rising out of it
    { const g = far[1], base = H * .72;
      g.fillStyle = 'rgba(58,98,78,.8)';
      stepped(g, W * .48, base + 4, H * .52, H * .27, 5);
      g.fillRect(W * .48 - H * .03, base - H * .31, H * .06, H * .05);
      canopy(g, -PAD, W + PAD, base, H * .025, H * .06, r);
      g.fillRect(-PAD, base, W + PAD * 2, H);
    }
    // mid: the tower, the colossus, and a darker canopy
    { const g = mid[1], base = H * .84, tx = W * .6;
      g.fillStyle = '#132a20';
      canopy(g, -PAD, W + PAD, base - H * .02, H * .04, H * .09, r);
      g.fillRect(-PAD, base, W + PAD * 2, H);
      // the tower: stacked, narrowing, crowned
      const tw = H * .1;
      g.fillRect(tx - tw * .8, base - H * .14, tw * 1.6, H * .14 + 2);
      g.fillRect(tx - tw * .5, base - H * .48, tw, H * .36);
      g.fillRect(tx - tw * .62, base - H * .5, tw * 1.24, H * .025);
      g.fillRect(tx - tw * .58, base - H * .33, tw * 1.16, H * .02);
      g.fillRect(tx - tw * .3, base - H * .55, tw * .6, H * .05);
      // the colossus head
      const hx = W * .38, hr = H * .085;
      g.beginPath(); g.ellipse(hx, base - hr * .9, hr, hr * 1.05, 0, Math.PI, 0); g.fill();
      g.fillRect(hx - hr, base - hr * .9, hr * 2, hr * .9 + 2);
      g.fillStyle = 'rgba(160,200,170,.12)';
      g.fillRect(hx - hr * .95, base - hr * 1.25, hr * 1.9, hr * .12);           // helmet band
      g.beginPath(); g.arc(hx - hr * .98, base - hr * .7, hr * .18, 0, 6.283); g.fill();
      g.beginPath(); g.arc(hx + hr * .98, base - hr * .7, hr * .18, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(10,20,14,.55)';
      g.fillRect(hx - hr * .55, base - hr * .95, hr * .35, hr * .08);           // eyes
      g.fillRect(hx + hr * .2, base - hr * .95, hr * .35, hr * .08);
    }
    // near: vast trunks, ferns
    { const g = near[1], base = H * .95;
      g.fillStyle = '#050d08';
      g.fillRect(-PAD, base, W + PAD * 2, H);
      for(const [x, w] of [[W * .97, W * .07], [W * .86, W * .03], [W * 1.08, W * .1]]){
        g.beginPath();
        g.moveTo(x - w * .5, H); g.lineTo(x - w * .38, 0); g.lineTo(x + w * .38, 0); g.lineTo(x + w * .5, H);
        g.fill();
        for(let i = 0; i < 5; i++){                                       // buttress roots
          const a = (i - 2) * .5;
          g.beginPath(); g.moveTo(x, base - H * .12);
          g.quadraticCurveTo(x + a * w * .8, base - H * .04, x + a * w * 1.6, H); g.lineTo(x, H); g.fill();
        }
      }
      for(let x = W * .3; x < W + PAD; x += 24 + r() * 30){               // fern fans
        const fh = H * (.06 + r() * .08);
        for(let k = 0; k < 7; k++){
          const a = -Math.PI / 2 + (k - 3) * .32;
          g.beginPath(); g.moveTo(x, base + 4);
          g.quadraticCurveTo(x + Math.cos(a) * fh * .5, base - fh * .7,
                             x + Math.cos(a) * fh * 1.1, base + Math.sin(a) * fh * .6 + fh * .3);
          g.lineTo(x + Math.cos(a) * fh * 1.05, base + Math.sin(a) * fh * .6 + fh * .36);
          g.closePath(); g.fill();
        }
      }
    }
    return { far: far[0], mid: mid[0], near: near[0] };
  }

  // ── animated extras ───────────────────────────────────────────────────────
  let dust = [], birds = [], flies = [], leaves = [], vines = [];
  function seedFX(){
    const r = Math.random;
    dust = Array.from({ length: 60 }, () => ({ x: r() * W, y: H * (.35 + r() * .6), s: .6 + r() * 1.6, v: 6 + r() * 14, ph: r() * 6 }));
    birds = Array.from({ length: 5 }, (_, i) => ({ x: r() * W, y: H * (.18 + r() * .22), v: 18 + r() * 14, s: 5 + r() * 5, ph: r() * 6 }));
    flies = Array.from({ length: 46 }, () => ({ x: r() * W, y: H * (.45 + r() * .5), ph: r() * 6, sp: .5 + r() * 1.5, dx: (r() - .5) * 8 }));
    leaves = Array.from({ length: 14 }, () => ({ x: r() * W, y: r() * H, v: 14 + r() * 18, rot: r() * 6, vr: (r() - .5) * 2, s: 4 + r() * 5, ph: r() * 6 }));
    vines = Array.from({ length: 9 }, (_, i) => ({ x: W * (.55 + i * .055 + (r() - .5) * .03), len: H * (.18 + r() * .3), ph: r() * 6 }));
  }

  function drawPalace(dx){
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1032'); g.addColorStop(.32, '#47284a'); g.addColorStop(.56, '#a2503a');
    g.addColorStop(.72, '#e39a4c'); g.addColorStop(.8, '#f5cd80'); g.addColorStop(1, '#c97a40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun
    const sx = W * .3 + dx * .15 - smx * 6, sy = H * .7, sr = H * .09 * (1 + Math.sin(T * .6) * .01);
    const glow = ctx.createRadialGradient(sx, sy, sr * .5, sx, sy, sr * 6);
    glow.addColorStop(0, 'rgba(255,214,140,.55)'); glow.addColorStop(.3, 'rgba(255,150,70,.22)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.283); ctx.fill();
    // birds
    ctx.strokeStyle = 'rgba(40,18,30,.75)'; ctx.lineWidth = 1.6;
    for(const b of birds){
      const flap = Math.sin(T * 6 + b.ph) * .5;
      const bx = b.x + dx * .3, by = b.y + Math.sin(T * .7 + b.ph) * 6;
      ctx.beginPath(); ctx.moveTo(bx - b.s, by - b.s * flap); ctx.lineTo(bx, by); ctx.lineTo(bx + b.s, by - b.s * flap); ctx.stroke();
    }
    // scenery
    ctx.drawImage(P.far,  -PAD + dx * .35 - smx * 8,  smy * 3, W + PAD * 2, H);
    ctx.drawImage(P.mid,  -PAD + dx * .7  - smx * 16, smy * 5, W + PAD * 2, H);
    // heat haze band over the city
    const hz = ctx.createLinearGradient(0, H * .62, 0, H * .86);
    hz.addColorStop(0, 'rgba(255,190,120,0)'); hz.addColorStop(.6, 'rgba(255,180,110,.16)'); hz.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = hz; ctx.fillRect(0, H * .62, W, H * .24);
    ctx.drawImage(P.near, -PAD + dx * 1.0 - smx * 30, smy * 9, W + PAD * 2, H);
    // dust
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(const d of dust){
      const a = .25 + .25 * Math.sin(T * 1.3 + d.ph);
      ctx.fillStyle = `rgba(255,200,140,${a.toFixed(3)})`;
      ctx.fillRect(d.x + dx * .8, d.y + Math.sin(T * .5 + d.ph) * 8, d.s, d.s);
    }
    ctx.restore();
  }

  function drawJungle(dx){
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12332a'); g.addColorStop(.34, '#3a735a'); g.addColorStop(.6, '#94c09b');
    g.addColorStop(.74, '#d2e7c5'); g.addColorStop(1, '#88aa7c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // pale sun through mist, top right
    const sx = W * .8 + dx * .15, sy = H * .16;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * .55);
    sg.addColorStop(0, 'rgba(240,255,220,.55)'); sg.addColorStop(.4, 'rgba(200,235,190,.16)'); sg.addColorStop(1, 'rgba(200,235,190,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // light shafts
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < 5; i++){
      const a = .045 + .03 * Math.sin(T * .4 + i * 1.7);
      const x0 = sx - W * .05 + i * W * .045;
      const lg = ctx.createLinearGradient(sx, sy, sx - W * .3, H);
      lg.addColorStop(0, `rgba(230,255,210,${a.toFixed(3)})`); lg.addColorStop(1, 'rgba(230,255,210,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + W * .025, 0);
      ctx.lineTo(x0 - W * .32 + W * .07, H); ctx.lineTo(x0 - W * .32, H); ctx.fill();
    }
    ctx.restore();
    ctx.drawImage(J.far, -PAD + dx * .35 - smx * 8,  smy * 3, W + PAD * 2, H);
    // rolling mist between the layers
    ctx.save();
    for(let i = 0; i < 4; i++){
      const mxp = ((T * (8 + i * 4) + i * W * .3) % (W * 1.6)) - W * .3;
      const my2 = H * (.68 + i * .05);
      const m = ctx.createRadialGradient(mxp, my2, 0, mxp, my2, W * .28);
      m.addColorStop(0, 'rgba(200,230,205,.22)'); m.addColorStop(1, 'rgba(200,230,205,0)');
      ctx.fillStyle = m; ctx.fillRect(mxp - W * .3, my2 - H * .15, W * .6, H * .3);
    }
    ctx.restore();
    ctx.drawImage(J.mid,  -PAD + dx * .7  - smx * 16, smy * 5, W + PAD * 2, H);
    // swaying vines hanging from the canopy
    ctx.strokeStyle = '#0c1c13'; ctx.lineWidth = 2.2;
    for(const v of vines){
      const vx = v.x + dx, sw = Math.sin(T * .8 + v.ph) * 10;
      ctx.beginPath(); ctx.moveTo(vx, 0);
      ctx.quadraticCurveTo(vx + sw, v.len * .5, vx + sw * 1.6, v.len); ctx.stroke();
      ctx.fillStyle = '#10261a';
      for(let k = 1; k < 6; k++){
        const t = k / 6, lx = vx + sw * 1.6 * t * t, ly = v.len * t;
        ctx.beginPath(); ctx.ellipse(lx + 4, ly, 5, 2.4, .6, 0, 6.283); ctx.fill();
      }
    }
    ctx.drawImage(J.near, -PAD + dx * 1.0 - smx * 30, smy * 9, W + PAD * 2, H);
    // fireflies
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for(const f of flies){
      const on = Math.max(0, Math.sin(T * f.sp * 2 + f.ph));
      if(on < .05) continue;
      const fx = f.x + dx * .9 + Math.sin(T * .6 + f.ph) * 14 + f.dx * Math.sin(T * .2);
      const fy = f.y + Math.cos(T * .5 + f.ph) * 10;
      const gl = ctx.createRadialGradient(fx, fy, 0, fx, fy, 7);
      gl.addColorStop(0, `rgba(230,255,140,${(.9 * on).toFixed(3)})`); gl.addColorStop(1, 'rgba(230,255,140,0)');
      ctx.fillStyle = gl; ctx.fillRect(fx - 7, fy - 7, 14, 14);
    }
    ctx.restore();
    // falling leaves
    ctx.fillStyle = '#2f5a2c';
    for(const l of leaves){
      ctx.save(); ctx.translate(l.x + dx + Math.sin(T + l.ph) * 20, l.y); ctx.rotate(l.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * .45, 0, 0, 6.283); ctx.fill(); ctx.restore();
    }
  }

  function tick(dt){
    for(const d of dust){ d.x += d.v * dt; if(d.x > W + 10) d.x = -10; }
    for(const b of birds){ b.x += b.v * dt; if(b.x > W + 40){ b.x = -40; b.y = H * (.18 + Math.random() * .22); } }
    for(const l of leaves){ l.y += l.v * dt; l.rot += l.vr * dt; if(l.y > H + 10){ l.y = -10; l.x = Math.random() * W; } }
  }

  function frame(now, once){
    const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if(!reduced) T += dt;
    smx += (mx - smx) * Math.min(1, dt * 2.2);
    smy += (my - smy) * Math.min(1, dt * 2.2);
    splitTarget = hoverId ? HOVER[hoverId] : SPLIT[loaded];
    split += (splitTarget - split) * (reduced ? 1 : Math.min(1, dt * 3.2));
    if(!reduced) tick(dt);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sx = split * W, tilt = H * .2;
    // each world slides so its landmark sits in the middle of its share
    const palDx = (sx * .5 - W * .36) * .75;
    // the jungle's landmarks aim for the gap between the seam and the deploy
    // panel (which covers roughly the right third on wide screens)
    const panelL = W > 960 ? W * .67 : W;
    const junDx = ((sx + panelL) * .5 - W * .5) * .75;

    drawPalace(palDx);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx + tilt, 0); ctx.lineTo(W + 2, 0); ctx.lineTo(W + 2, H); ctx.lineTo(sx - tilt, H);
    ctx.closePath(); ctx.clip();
    drawJungle(junDx);
    // a soft shadow along the jungle side of the seam
    const sh = ctx.createLinearGradient(sx, 0, sx + 60, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(sx - tilt, 0, tilt * 2 + 60, H);
    ctx.restore();

    // the seam: a glowing gold edge
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,200,110,.85)'; ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,170,70,.9)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(sx + tilt, 0); ctx.lineTo(sx - tilt, H); ctx.stroke();
    ctx.restore();

    // world names, faded by how much of the screen each world owns
    ctx.save();
    // world names ride the seam, one either side of it, near the bottom
    ctx.font = "800 14px 'Saira Condensed','Arial Narrow',sans-serif";
    ctx.textBaseline = 'middle';
    const ly = H * .115, lx = sx + tilt * (1 - 2 * ly / H);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,226,170,.85)';
    ctx.fillText('P A L A C E   \u25C2', lx - 18, ly);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(220,244,206,.85)';
    ctx.fillText('\u25B8   O V E R G R O W T H', lx + 18, ly);
    ctx.restore();

    // floor fade + grain
    const fl = ctx.createLinearGradient(0, H * .84, 0, H);
    fl.addColorStop(0, 'rgba(3,5,8,0)'); fl.addColorStop(1, 'rgba(3,5,8,.7)');
    ctx.fillStyle = fl; ctx.fillRect(0, H * .84, W, H * .16);
    if(grain){
      ctx.save(); ctx.globalAlpha = .45;
      ctx.fillStyle = ctx.createPattern(grain, 'repeat');
      ctx.translate((Math.random() * 160) | 0, (Math.random() * 160) | 0);
      ctx.fillRect(-160, -160, W + 320, H + 320);
      ctx.restore();
    }
    if(running && !once && !reduced) raf = requestAnimationFrame(frame);
  }

  function build(){
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight; PAD = Math.round(W * .3);
    cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(H * DPR);
    P = buildPalace(); J = buildJungle(); seedFX();
    grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    const gg = grain.getContext('2d'), id = gg.createImageData(160, 160);
    for(let i = 0; i < id.data.length; i += 4){
      const v = Math.random() * 255 | 0;
      id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 20;
    }
    gg.putImageData(id, 0, 0);
    if(!running) frame(performance.now(), true);
  }

  addEventListener('pointermove', e => {
    if(!running) return;
    mx = (e.clientX / (W || 1)) * 2 - 1;
    my = (e.clientY / (H || 1)) * 2 - 1;
  }, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 140); });
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ cancelAnimationFrame(raf); raf = 0; }
    else if(running && !reduced && !raf){ last = 0; raf = requestAnimationFrame(frame); }
  });

  build();

  return {
    start(){
      if(running) return;
      running = true; last = 0;
      if(reduced) frame(performance.now(), true);
      else raf = requestAnimationFrame(frame);
    },
    stop(){ running = false; cancelAnimationFrame(raf); raf = 0; },
    // the lobby's map cards call this on hover; null returns to the loaded map
    hover(id){
      hoverId = (id && HOVER[id] !== undefined) ? id : null;
      if(reduced) frame(performance.now(), true);
    },
  };
})();

// ── TITLE MODE ──────────────────────────────────────────────────────────────
// animate() early-returns without pointer lock and only renders. While the
// title is up that render is invisible under the backdrop, so it is throttled
// to one frame in 15: enough to keep shaders compiled and textures uploaded,
// so the first deployed frame does not hitch, at a fraction of the GPU cost.
let _titleActive = false;

let _titleShouldRun = function(){
  if(document.pointerLockElement) return false;
  if(typeof netInMatch !== 'undefined' && netInMatch) return false;
  return true;
};

(function throttleHiddenRender(){
  if(typeof renderer === 'undefined' || !renderer || typeof renderer.render !== 'function') return;
  const orig = renderer.render.bind(renderer);
  let n = 0;
  renderer.render = function(s, c){
    if(_titleActive && (n++ % 15) !== 0) return;
    return orig(s, c);
  };
})();

let _titleStopT = 0;
function _titleEnter(){
  _titleActive = true;
  clearTimeout(_titleStopT);
  document.body.classList.add('title-mode');
  TTScene.start();
}
function _titleExit(){
  _titleActive = false;
  document.body.classList.remove('title-mode');
  // keep animating through the CSS fade-out, then stop drawing entirely
  clearTimeout(_titleStopT);
  _titleStopT = setTimeout(() => { if(!_titleActive) TTScene.stop(); }, 1000);
}

(function titleFrame(){
  requestAnimationFrame(titleFrame);
  const want = _titleShouldRun();
  if(want && !_titleActive) _titleEnter();
  else if(!want && _titleActive) _titleExit();
})();

console.log('title: two-worlds backdrop (palace / overgrowth)');


// ════════════════════════════════════════════════════════════════════════════
//  SETTINGS + HOW TO PLAY
//
//  These existed only on #instructions, which the lobby now hides — so until
//  this, nothing could reach either. Both live in one modal here, and the solo
//  screen's buttons are rewired to it so there is a single version of each.
//
//  Settings does NOT reimplement anything: it physically moves b0-menu's
//  #set-list node into this panel and calls its renderSettings(). Every option
//  keeps driving the real engine state, and keeps persisting to localStorage.
//
//  The reference tables are generated from GUNS and from the constants they
//  describe, so they cannot drift out of date the way hand-written docs do.
// ════════════════════════════════════════════════════════════════════════════
(function buildTitleModal(){
  // ══════════════════════════════════════════════════════════════════════════
  //  HOW TO PLAY  +  SETTINGS
  //  One overlay (#tt-modal, which d0-net checks so the resume prompt stands
  //  down while it is open), two separate screens. Each has a side menu and
  //  its own sections. ttOpen('settings') opens Settings; any other name opens
  //  How to play at that section ('basics', 'controls', 'weapons', 'round',
  //  'money', 'maps'). Inventory is its own screen in m0-account.js.
  // ══════════════════════════════════════════════════════════════════════════

  const style = document.createElement('style');
  style.textContent = `
  #tt-modal{position:fixed;inset:0;z-index:420;display:none;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 40%,rgba(18,22,30,.78),rgba(4,6,9,.93));backdrop-filter:blur(9px);
    font-family:var(--tt-font);color:var(--tt-cream)}
  #tt-modal.on{display:flex;animation:hpIn .22s ease-out}
  @keyframes hpIn{from{opacity:0}to{opacity:1}}
  @keyframes hpRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  /* transform only: content must never be stuck invisible if an animation stalls */
  @keyframes hpSlide{from{transform:translateY(6px)}to{transform:none}}
  #hp-box{position:relative;width:min(1140px,95vw);height:min(86vh,820px);display:flex;
    background:linear-gradient(180deg,rgba(20,24,32,.97),rgba(13,16,22,.98));
    border:1px solid rgba(255,255,255,.07);box-shadow:0 40px 120px rgba(0,0,0,.7);animation:hpRise .3s ease-out}
  #hp-box::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;z-index:2;
    background:linear-gradient(90deg,var(--tt-t),var(--tt-gold-hi) 50%,var(--tt-ct))}

  /* side menu */
  #hp-side{width:250px;flex:0 0 auto;display:flex;flex-direction:column;padding:28px 0 18px;
    background:rgba(0,0,0,.22);border-right:1px solid rgba(255,255,255,.06)}
  #hp-kick{font:700 11px/1 var(--tt-font);letter-spacing:.34em;text-transform:uppercase;color:var(--tt-gold);padding:0 26px}
  #hp-title{font:900 34px/.95 var(--tt-font);letter-spacing:.04em;text-transform:uppercase;color:var(--tt-cream);
    padding:8px 26px 22px;font-style:italic}
  #hp-nav{display:flex;flex-direction:column;gap:2px;overflow-y:auto;flex:1}
  .hp-nav{display:flex;align-items:center;gap:13px;background:none;border:none;cursor:pointer;text-align:left;
    padding:12px 26px;color:#8f98a6;font:700 14px/1.1 var(--tt-font);letter-spacing:.16em;text-transform:uppercase;
    border-left:3px solid transparent;transition:color .15s,background .15s}
  .hp-nav svg{width:18px;height:18px;flex:0 0 auto;opacity:.75}
  .hp-nav small{display:block;font:500 11.5px/1.2 var(--tt-font);letter-spacing:.04em;text-transform:none;color:#6c7380;margin-top:3px}
  .hp-nav:hover{color:var(--tt-cream);background:rgba(255,255,255,.03)}
  .hp-nav.on{color:var(--tt-gold-hi);border-left-color:var(--tt-gold);background:linear-gradient(90deg,rgba(220,162,76,.12),rgba(220,162,76,0))}
  .hp-nav.on svg{opacity:1}
  .hp-nav.on small{color:#a8977a}
  #hp-foot{padding:14px 26px 0;font:600 11.5px/1.4 var(--tt-font);color:#6c7380;letter-spacing:.06em}
  #hp-foot kbd{font:700 10.5px/1 var(--tt-font);padding:3px 6px;border:1px solid #3a424e;border-bottom-width:2px;color:#b9b2a4;border-radius:3px}

  /* main column */
  #hp-main{flex:1;display:flex;flex-direction:column;min-width:0}
  #hp-top{display:flex;align-items:flex-end;gap:16px;padding:26px 34px 18px;border-bottom:1px solid rgba(255,255,255,.06)}
  #hp-top h2{margin:0;font:800 26px/1 var(--tt-font);letter-spacing:.14em;text-transform:uppercase;color:var(--tt-cream)}
  #hp-top p{margin:7px 0 0;font:500 14px/1.4 var(--tt-font);color:#9a917f;letter-spacing:.02em}
  #hp-top-r{margin-left:auto;display:flex;gap:10px;align-items:center}
  #tt-close{width:40px;height:40px;display:grid;place-items:center;background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.1);color:#b9b2a4;cursor:pointer;font:400 24px/1 sans-serif;transition:all .15s}
  #tt-close:hover{color:#fff;border-color:var(--tt-gold);background:rgba(220,162,76,.12)}
  #hp-body{flex:1;overflow-y:auto;padding:26px 34px 40px;scrollbar-width:thin;scrollbar-color:#3a424e transparent}
  .hp-sec{display:none}
  .hp-sec.on{display:block;animation:hpSlide .25s ease-out}

  .hp-h{display:flex;align-items:center;gap:12px;font:700 12px/1 var(--tt-font);letter-spacing:.26em;
    text-transform:uppercase;color:var(--tt-gold);margin:30px 0 14px}
  .hp-h::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(220,162,76,.3),rgba(220,162,76,0))}
  .hp-sec > .hp-h:first-child{margin-top:0}
  .hp-p{font:500 15px/1.6 var(--tt-font);color:#c4bba9;margin:0 0 14px;max-width:72ch;letter-spacing:.01em}
  .hp-p b,.hp-p strong{color:var(--tt-cream)}
  .hp-note{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(220,162,76,.22);
    background:rgba(220,162,76,.06);padding:13px 16px;margin:18px 0 0;font:500 14px/1.5 var(--tt-font);color:#cdbfa5;max-width:80ch}
  .hp-note::before{content:'!';flex:0 0 auto;width:20px;height:20px;display:grid;place-items:center;
    background:var(--tt-gold);color:#15100a;font:900 13px/1 var(--tt-font);margin-top:1px}
  .hp-t{color:var(--tt-t);font-weight:700}.hp-ct{color:var(--tt-ct);font-weight:700}
  .hp-gold{color:var(--tt-gold-hi)}.hp-good{color:#7ec98f}

  /* basics */
  .hp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .hp-step{position:relative;padding:20px 20px 18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);overflow:hidden}
  .hp-step i{position:absolute;right:12px;top:4px;font:900 italic 64px/1 var(--tt-font);color:rgba(255,255,255,.05)}
  .hp-step b{display:block;font:800 19px/1 var(--tt-font);letter-spacing:.16em;text-transform:uppercase;color:var(--tt-gold-hi);margin-bottom:9px}
  .hp-step span{font:500 14px/1.5 var(--tt-font);color:#bdb4a2}
  .hp-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .hp-fact{padding:14px 16px;border-left:3px solid var(--tt-gold);background:rgba(255,255,255,.025)}
  .hp-fact b{display:block;font:800 28px/1 var(--tt-font);color:var(--tt-cream);font-variant-numeric:tabular-nums}
  .hp-fact span{display:block;margin-top:6px;font:700 11px/1.2 var(--tt-font);letter-spacing:.18em;text-transform:uppercase;color:#8f98a6}
  .hp-sides{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .hp-side{padding:16px 18px;background:rgba(255,255,255,.025);border-top:3px solid}
  .hp-side.t{border-color:var(--tt-t)} .hp-side.ct{border-color:var(--tt-ct)}
  .hp-side b{font:800 16px/1 var(--tt-font);letter-spacing:.18em;text-transform:uppercase}
  .hp-side.t b{color:var(--tt-t)} .hp-side.ct b{color:var(--tt-ct)}
  .hp-side p{margin:8px 0 0;font:500 14px/1.5 var(--tt-font);color:#bdb4a2}

  /* controls */
  .hp-kgroups{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
  .hp-kg{padding:18px 18px 14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}
  .hp-kg h4{margin:0 0 14px;font:700 11px/1 var(--tt-font);letter-spacing:.26em;text-transform:uppercase;color:#8f98a6}
  .hp-kr{display:flex;align-items:center;gap:12px;padding:6px 0;font:600 14.5px/1.2 var(--tt-font);color:#d8cfbd}
  .hp-kr .ks{display:flex;gap:5px;flex:0 0 96px}
  .hp-kr .d{flex:1;min-width:0}
  .hp-kr .d small{color:#7a8290;font-size:13px}
  kbd.hp-k{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 9px;
    background:linear-gradient(180deg,#2a313b,#1d2229);border:1px solid #3e4652;border-bottom:3px solid #12161b;border-radius:4px;
    font:800 13px/1 var(--tt-font);color:var(--tt-cream);letter-spacing:.04em;box-shadow:0 2px 0 rgba(0,0,0,.3)}
  kbd.hp-k.wide{min-width:78px}
  kbd.hp-k.gold{border-color:rgba(220,162,76,.6);color:var(--tt-gold-hi)}
  .hp-wasd{display:grid;grid-template-columns:repeat(3,38px);grid-template-rows:38px 38px;gap:5px;margin:2px 0 12px}
  .hp-wasd kbd{min-width:0;height:auto}
  .hp-wasd kbd:nth-child(1){grid-column:2;grid-row:1}
  .hp-wasd kbd:nth-child(2){grid-column:1;grid-row:2}
  .hp-wasd kbd:nth-child(3){grid-column:2;grid-row:2}
  .hp-wasd kbd:nth-child(4){grid-column:3;grid-row:2}
  .hp-mouse{display:flex;gap:16px;align-items:center;margin-bottom:10px}
  .hp-mouse svg{width:54px;height:78px;flex:0 0 auto}
  .hp-mouse div{font:600 14px/1.9 var(--tt-font);color:#d8cfbd}
  .hp-mouse em{font-style:normal;color:var(--tt-gold-hi);font-weight:800;margin-right:6px}

  /* weapons */
  .hp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .hp-chip{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);color:#9a917f;cursor:pointer;
    padding:8px 15px;font:700 12px/1 var(--tt-font);letter-spacing:.16em;text-transform:uppercase;transition:all .15s}
  .hp-chip:hover{color:var(--tt-cream);border-color:rgba(220,162,76,.4)}
  .hp-chip.on{background:var(--tt-gold);color:#15100a;border-color:var(--tt-gold)}
  .hp-guns{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
  .hp-gun{padding:14px 16px 15px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.07);transition:border-color .15s,transform .15s}
  .hp-gun:hover{border-color:rgba(220,162,76,.45);transform:translateY(-2px)}
  .hp-gun-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .hp-gun-top b{font:800 16px/1 var(--tt-font);letter-spacing:.12em;color:var(--tt-cream)}
  .hp-gun-top span{font:800 15px/1 var(--tt-font);color:var(--tt-gold-hi);font-variant-numeric:tabular-nums}
  .hp-gun-cat{font:700 10.5px/1 var(--tt-font);letter-spacing:.2em;text-transform:uppercase;color:#7a8290;margin-top:5px}
  .hp-gun-ic{height:58px;display:flex;align-items:center;justify-content:center;color:#d8cbb2;margin:6px 0 8px}
  .hp-gun-ic svg{width:150px;height:46px}
  .hp-bar{display:grid;grid-template-columns:78px 1fr 40px;align-items:center;gap:9px;margin-top:6px;
    font:700 10.5px/1 var(--tt-font);letter-spacing:.14em;text-transform:uppercase;color:#8f98a6}
  .hp-bar i{display:block;height:5px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
  .hp-bar i u{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#b9853e,var(--tt-gold-hi))}
  .hp-bar em{font-style:normal;color:#d8cfbd;text-align:right;letter-spacing:.02em;font-size:12px;font-variant-numeric:tabular-nums}
  .hp-gun-foot{display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);
    font:600 12.5px/1 var(--tt-font);color:#9a917f;letter-spacing:.04em}
  .hp-gun-foot b{color:var(--tt-cream)}

  /* round */
  .hp-tl{display:flex;gap:4px;margin:6px 0 10px}
  .hp-tl > div{position:relative;padding:16px 18px;background:rgba(255,255,255,.03);border-top:3px solid}
  .hp-tl b{display:block;font:800 17px/1 var(--tt-font);letter-spacing:.16em;text-transform:uppercase}
  .hp-tl em{display:block;font:800 30px/1.1 var(--tt-font);font-style:normal;color:var(--tt-cream);margin:6px 0 4px;font-variant-numeric:tabular-nums}
  .hp-tl span{font:500 13.5px/1.45 var(--tt-font);color:#b3aa98}
  .hp-wins{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .hp-win{padding:16px 18px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}
  .hp-win svg{width:26px;height:26px;color:var(--tt-gold-hi);margin-bottom:8px}
  .hp-win b{display:block;font:800 14px/1.2 var(--tt-font);letter-spacing:.12em;text-transform:uppercase;color:var(--tt-cream);margin-bottom:6px}
  .hp-win span{font:500 13.5px/1.45 var(--tt-font);color:#b3aa98}

  /* money */
  .hp-loss{display:flex;align-items:flex-end;gap:10px;height:150px;padding:0 4px;margin:4px 0 6px;border-bottom:1px solid rgba(255,255,255,.1)}
  .hp-loss div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}
  .hp-loss u{display:block;width:100%;background:linear-gradient(180deg,var(--tt-gold-hi),#9b6d2e);min-height:4px}
  .hp-loss div.win u{background:linear-gradient(180deg,#9fe0ad,#3f8a51)}
  .hp-loss b{font:800 15px/1 var(--tt-font);color:var(--tt-cream);margin-bottom:7px;font-variant-numeric:tabular-nums}
  .hp-loss-x{display:flex;gap:10px;padding:0 4px}
  .hp-loss-x span{flex:1;text-align:center;font:700 10.5px/1.3 var(--tt-font);letter-spacing:.12em;text-transform:uppercase;color:#8f98a6;padding-top:7px}
  .hp-kills{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
  .hp-kill{display:flex;align-items:center;justify-content:space-between;padding:10px 13px;background:rgba(255,255,255,.025);
    font:700 13px/1 var(--tt-font);letter-spacing:.1em;color:#d8cfbd}
  .hp-kill b{color:var(--tt-gold-hi);font-variant-numeric:tabular-nums}

  /* maps */
  .hp-maptabs{display:flex;gap:10px;margin-bottom:18px}
  .hp-maptab{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);
    padding:8px 16px 8px 8px;cursor:pointer;color:#9a917f;font:800 15px/1 var(--tt-font);letter-spacing:.16em;text-transform:uppercase}
  .hp-maptab:hover{color:var(--tt-cream)}
  .hp-maptab.on{border-color:var(--tt-gold);color:var(--tt-gold-hi);background:rgba(220,162,76,.08)}
  .hp-maptab em{display:block;font:700 10px/1 var(--tt-font);font-style:normal;letter-spacing:.2em;color:#7ec98f;margin-top:5px}
  .hp-map{display:none;gap:28px;align-items:flex-start;flex-wrap:wrap}
  .hp-map.on{display:flex;animation:hpSlide .25s ease-out}
  .hp-map-plan{padding:12px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.07)}
  .hp-legend{flex:1;min-width:260px}
  .hp-legend div{display:flex;gap:11px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font:500 14px/1.45 var(--tt-font);color:#c4bba9}
  .hp-legend i{width:13px;height:13px;flex:0 0 auto;margin-top:4px}
  .hp-legend strong{color:var(--tt-cream)}

  /* settings */
  .hp-set-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:6px}
  .hp-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px}
  .hp-preset{position:relative;text-align:left;cursor:pointer;padding:15px 16px 14px;background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.09);color:#b3aa98;transition:all .15s}
  .hp-preset:hover{border-color:rgba(220,162,76,.45);color:var(--tt-cream)}
  .hp-preset b{display:block;font:800 18px/1 var(--tt-font);letter-spacing:.16em;color:var(--tt-cream)}
  .hp-preset span{display:block;margin-top:7px;font:500 12.5px/1.4 var(--tt-font)}
  .hp-preset u{display:flex;gap:3px;margin-top:11px}
  .hp-preset u i{flex:1;height:4px;background:rgba(255,255,255,.1)}
  .hp-preset u i.f{background:var(--tt-gold)}
  .hp-preset.on{border-color:var(--tt-gold);background:linear-gradient(180deg,rgba(220,162,76,.16),rgba(220,162,76,.04))}
  .hp-preset.on::after{content:'\\2713';position:absolute;top:10px;right:12px;color:var(--tt-gold-hi);font:900 14px/1 sans-serif}
  .hp-custom{font:700 11px/1 var(--tt-font);letter-spacing:.2em;text-transform:uppercase;color:#7a8290;padding:6px 10px;border:1px dashed #3a424e}
  .hp-custom.on{color:var(--tt-gold-hi);border-color:rgba(220,162,76,.55)}
  .hp-srow{display:flex;align-items:center;gap:20px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  .hp-srow:last-child{border-bottom:none}
  .hp-srow-l{flex:1;min-width:0}
  .hp-srow-l b{display:block;font:800 15px/1 var(--tt-font);letter-spacing:.14em;text-transform:uppercase;color:var(--tt-cream)}
  .hp-srow-l span{display:block;margin-top:6px;font:500 13.5px/1.4 var(--tt-font);color:#8f98a6}
  .hp-seg{display:flex;flex:0 0 auto;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);padding:3px;gap:2px;flex-wrap:wrap;justify-content:flex-end;max-width:440px}
  .hp-seg button{background:none;border:none;cursor:pointer;color:#8f98a6;padding:9px 13px;min-width:46px;
    font:700 12.5px/1 var(--tt-font);letter-spacing:.1em;text-transform:uppercase;transition:all .12s}
  .hp-seg button:hover{color:var(--tt-cream);background:rgba(255,255,255,.05)}
  .hp-seg button.on{background:var(--tt-gold);color:#15100a}
  .hp-swatch{display:flex;gap:8px;flex:0 0 auto;align-items:center}
  .hp-swatch button{width:34px;height:34px;cursor:pointer;border:2px solid rgba(255,255,255,.12);background:#11151b;display:grid;place-items:center;transition:all .12s}
  .hp-swatch button:hover{border-color:rgba(255,255,255,.4)}
  .hp-swatch button.on{border-color:var(--tt-gold-hi);box-shadow:0 0 0 2px rgba(220,162,76,.3)}
  .hp-swatch svg{width:22px;height:22px}
  .hp-xprev{width:64px;height:64px;flex:0 0 auto;display:grid;place-items:center;
    background:radial-gradient(circle,#4b5563 0%,#1f252d 70%);border:1px solid rgba(255,255,255,.1);margin-left:8px}
  .hp-xprev svg{width:30px;height:30px}
  .hp-card{padding:4px 20px;background:rgba(255,255,255,.022);border:1px solid rgba(255,255,255,.06)}
  .hp-reset{background:none;border:1px solid rgba(255,255,255,.14);color:#9a917f;cursor:pointer;padding:10px 15px;
    font:700 11.5px/1 var(--tt-font);letter-spacing:.18em;text-transform:uppercase;transition:all .15s}
  .hp-reset:hover{color:#ffb0a3;border-color:rgba(224,120,100,.55)}
  .hp-saved{font:700 11px/1 var(--tt-font);letter-spacing:.2em;text-transform:uppercase;color:#7ec98f;opacity:0;transition:opacity .3s}
  .hp-saved.on{opacity:1}

  @media (max-width:860px){
    #hp-box{flex-direction:column;height:92vh}
    #hp-side{width:auto;padding:16px 0 0;border-right:none;border-bottom:1px solid rgba(255,255,255,.06)}
    #hp-title{font-size:24px;padding-bottom:10px} #hp-foot{display:none}
    #hp-nav{flex-direction:row;overflow-x:auto}
    .hp-nav{border-left:none;border-bottom:3px solid transparent;padding:10px 14px;white-space:nowrap}
    .hp-nav.on{border-bottom-color:var(--tt-gold)} .hp-nav small{display:none}
    #hp-top{padding:16px 18px 12px} #hp-body{padding:18px 18px 30px}
    .hp-steps,.hp-wins{grid-template-columns:1fr} .hp-facts,.hp-presets{grid-template-columns:repeat(2,1fr)}
    .hp-sides{grid-template-columns:1fr} .hp-tl{flex-direction:column}
    .hp-srow{flex-direction:column;align-items:flex-start;gap:10px}
    #hp-box{width:96vw;height:94vh;height:94dvh}
    #hp-main,#hp-body{min-height:0}
    #hp-top{align-items:flex-start} #hp-top h2{font-size:21px} #hp-top p{font-size:13px}
    #hp-top-r{flex-direction:column-reverse;align-items:flex-end;gap:6px} .hp-saved{display:none}
    .hp-reset{padding:7px 9px;font-size:10.5px}
    .hp-seg{max-width:100%;justify-content:flex-start} .hp-seg button{padding:9px 10px;min-width:0}
    .hp-maptabs{flex-wrap:wrap} .hp-map.on{flex-direction:column}
  }
  `;
  document.head.appendChild(style);

  // ── icons (stroke, 24 box) ────────────────────────────────────────────────
  const I = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const IC = {
    basics:   I('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>'),
    controls: I('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    weapons:  I('<path d="M3 10h13l2-2h3v4h-4l-1 2h-4l-1 4H8l1-4H3z"/>'),
    round:    I('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    money:    I('<path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 7s2 3 5 3.5 5 1.5 5 3.7-2.2 3.3-5 3.3-5-1.1-5-3"/>'),
    maps:     I('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    graphics: I('<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>'),
    perf:     I('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    input:    I('<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>'),
    audio:    I('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
    hud:      I('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
    skull:    I('<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/>'),
    clock:    I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
    shield:   I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  };

  // ── data, read from the live config ──────────────────────────────────────
  const KILL = { knife:1500, glock18:300, deagle:300, mac10:600, mp5:600, mp7:600, ump45:600, ak47:300, m4a1:300, awp:100 };
  const CAT_NAME = { melee:'Melee', pistols:'Pistol', smgs:'SMG', rifles:'Rifle', snipers:'Sniper' };
  const gunKeys = Object.keys(GUNS).sort((a,b) => GUNS[a].order - GUNS[b].order);
  const fired = gunKeys.filter(k => !GUNS[k].melee);
  const maxRpm = Math.max(...fired.map(k => 60000 / GUNS[k].fireInterval));
  const bar = (label, frac, val) =>
    '<div class="hp-bar"><span>' + label + '</span><i><u style="width:' + Math.round(Math.max(.04, Math.min(1, frac)) * 100) + '%"></u></i><em>' + val + '</em></div>';
  const gunCard = k => {
    const g = GUNS[k];
    const move = (typeof GUN_MOVE === 'object' && GUN_MOVE[k]) || 1;
    const rpm = Math.round(60000 / g.fireInterval);
    const head = g.zoneDamage ? g.zoneDamage.head : g.damage;
    const icon = (typeof gunIconSVG === 'function' && gunIconSVG(k)) || '';
    return '<div class="hp-gun" data-cat="' + g.category + '">' +
      '<div class="hp-gun-top"><b>' + g.name + '</b><span>' + (g.price ? '$' + g.price.toLocaleString() : 'FREE') + '</span></div>' +
      '<div class="hp-gun-cat">' + (CAT_NAME[g.category] || g.category) + (g.rpm && !g.melee ? ' &middot; ' + g.rpm : '') + '</div>' +
      '<div class="hp-gun-ic">' + icon + '</div>' +
      bar('Damage', g.damage / 100, g.damage) +
      (g.melee ? bar('Range', .06, '&mdash;') : bar('Fire rate', rpm / maxRpm, rpm)) +
      (g.melee ? '' : bar('Accuracy', 1 - (g.spread || 0) / 0.03, Math.round((1 - (g.spread || 0) / 0.03) * 100))) +
      bar('Mobility', (move - .7) / .3, Math.round(move * 100) + '%') +
      '<div class="hp-gun-foot"><span>' + (g.melee ? 'Always carried' : 'Mag <b>' + g.maxAmmo + '</b> &middot; Head <b>' + head + '</b>') +
      '</span><span>Kill <b class="hp-gold">$' + (KILL[k] || 300) + '</b></span></div></div>';
  };

  const key = (k, cls) => '<kbd class="hp-k' + (cls ? ' ' + cls : '') + '">' + k + '</kbd>';
  const krow = (keys, d) => '<div class="hp-kr"><span class="ks">' + keys.map(k => Array.isArray(k) ? key(k[0], k[1]) : key(k)).join('') + '</span><span class="d">' + d + '</span></div>';

  const LOSS = [1400, 1900, 2400, 2900, 3400];
  const lossBars = '<div class="win"><b>$3,250</b><u style="height:' + (3250 / 3400 * 100).toFixed(0) + '%"></u></div>' +
    LOSS.map(v => '<div><b>$' + v.toLocaleString() + '</b><u style="height:' + (v / 3400 * 100).toFixed(0) + '%"></u></div>').join('');

  const mapLegend = {
    alcazar: `
      <p class="hp-p">A walled palace compound, 94 by 94. The layout is <strong>diagonal, not mirrored</strong>:
        spawns and the two open courts alternate around the four corners, so each team starts near one court and far from the other.</p>
      <div><i style="background:#e0a35a"></i><span><strong class="hp-t">Attack spawn</strong> &mdash; north-west</span></div>
      <div><i style="background:#7fa8d8"></i><span><strong class="hp-ct">Defence spawn</strong> &mdash; south-east</span></div>
      <div><i style="background:#6a5a40"></i><span><strong>Great Court</strong> &mdash; north-east. Attack gets there first.</span></div>
      <div><i style="background:#6a5a40"></i><span><strong>Bazaar Court</strong> &mdash; south-west. Defence gets there first.</span></div>
      <div><i style="background:#5d4a2c"></i><span><strong>Curtain wall</strong> &mdash; the hard edge of the map.</span></div>
      <div class="hp-note">Whoever holds mid can rotate to either court faster than the other team.</div>`,
    overgrowth: `
      <p class="hp-p">Temple ruins swallowed by jungle, 90 by 90. Deliberately <strong>asymmetric</strong> with diagonal spawns,
        and a river running the full width through mid.</p>
      <div><i style="background:#e0a35a"></i><span><strong class="hp-t">Attack spawn</strong> &mdash; south-west</span></div>
      <div><i style="background:#6fa3dc"></i><span><strong class="hp-ct">Defence spawn</strong> &mdash; north-east, by the temple</span></div>
      <div><i style="background:#5b5c4a"></i><span><strong>North-west plains</strong> &mdash; open ground around the colossus. Long sightlines: rifles and the AWP.</span></div>
      <div><i style="background:#5b5c4a"></i><span><strong>South-east warren</strong> &mdash; packed ruins, alleys and a torch-lit tunnel. Close range: SMGs.</span></div>
      <div><i style="background:#c9b27a"></i><span><strong>Mid</strong> &mdash; the tower where the diagonal routes meet.</span></div>
      <div class="hp-note">Each team reaches its own side first, so the fight usually starts over mid.</div>`,
  };
  const mapIds = Object.keys(MAPS);

  // ── HOW TO PLAY ──────────────────────────────────────────────────────────
  const HOW = [
    { id:'basics',   label:'Basics',   sub:'What the game is',      title:'The basics',  lead:'Two teams, one round at a time. Buy, fight, and be the last team standing.', html:`
      <div class="hp-steps">
        <div class="hp-step"><i>1</i><b>Buy</b><span>15 seconds frozen in spawn. Press <kbd class="hp-k" style="height:24px;min-width:24px">B</kbd> and spend your money on a weapon.</span></div>
        <div class="hp-step"><i>2</i><b>Fight</b><span>1:55 on the clock. Move as a team, take map control, trade kills.</span></div>
        <div class="hp-step"><i>3</i><b>Win</b><span>Wipe the other team, or have more players alive when time runs out.</span></div>
      </div>
      <div class="hp-h">At a glance</div>
      <div class="hp-facts">
        <div class="hp-fact"><b>5v5</b><span>Up to 10 players</span></div>
        <div class="hp-fact"><b>8</b><span>Round wins to take it</span></div>
        <div class="hp-fact"><b>7</b><span>Rounds, then sides swap</span></div>
        <div class="hp-fact"><b>100</b><span>Health, no armour</span></div>
      </div>
      <div class="hp-h">The two sides</div>
      <div class="hp-sides">
        <div class="hp-side t"><b>Attack &middot; T</b><p>Starts in one corner of the map. Pushes out and takes the fight to Defence.</p></div>
        <div class="hp-side ct"><b>Defence &middot; CT</b><p>Starts in the opposite corner. Holds angles. A dead tie on the clock goes to Defence.</p></div>
      </div>
      <div class="hp-note">Dying is not respawning. You spectate until the round ends, so trading your life for one kill is rarely worth it.</div>` },

    { id:'controls', label:'Controls', sub:'Keys and mouse',        title:'Controls',    lead:'Everything is on the keyboard and mouse. Esc gives you the cursor back.', html:`
      <div class="hp-kgroups">
        <div class="hp-kg"><h4>Movement</h4>
          <div class="hp-wasd">${key('W')}${key('A')}${key('S')}${key('D')}</div>
          ${krow([['Space','wide']], 'Jump')}
        </div>
        <div class="hp-kg"><h4>Combat</h4>
          <div class="hp-mouse">
            <svg viewBox="0 0 54 78" fill="none" stroke="#7a8290" stroke-width="2"><rect x="2" y="2" width="50" height="74" rx="25"/>
              <path d="M27 2v28M2 30h50"/><path d="M4 28V22A23 23 0 0 1 26 3v25z" fill="rgba(220,162,76,.55)" stroke="none"/>
              <path d="M50 28V22A23 23 0 0 0 28 3v25z" fill="rgba(111,163,220,.45)" stroke="none"/></svg>
            <div><div><em>Left</em>Fire</div><div><em style="color:var(--tt-ct)">Right</em>Scope (AWP)</div><div><em style="color:#c4bba9">Move</em>Aim</div></div>
          </div>
          ${krow(['R'], 'Reload')}
        </div>
        <div class="hp-kg"><h4>Weapons</h4>
          ${krow(['1'], 'Knife')}${krow(['2'], 'Pistol')}${krow(['3'], 'Primary')}
          ${krow([['B','gold']], 'Buy menu <small>(buy time)</small>')}
        </div>
        <div class="hp-kg"><h4>Team &amp; view</h4>
          ${krow([['Enter','wide']], 'Chat')}${krow([['Tab','wide']], 'Hold for scoreboard')}
          ${krow(['V'], 'Third person')}${krow([['Esc','wide']], 'Release the mouse')}
        </div>
        <div class="hp-kg"><h4>Performance</h4>
          ${krow(['F3'], 'Performance stats')}${krow(['F4'], 'Cycle quality preset')}
        </div>
      </div>` },

    { id:'weapons',  label:'Weapons',  sub:'Prices and stats',      title:'Weapons',     lead:'You always carry a knife and a pistol. One primary goes in slot 3, and you lose it when you die.', html:`
      <div class="hp-chips">
        <button class="hp-chip on" data-f="all">All</button>
        ${['pistols','smgs','rifles','snipers','melee'].map(c => '<button class="hp-chip" data-f="' + c + '">' + ({pistols:'Pistols',smgs:'SMGs',rifles:'Rifles',snipers:'Sniper',melee:'Melee'})[c] + '</button>').join('')}
      </div>
      <div class="hp-guns">${gunKeys.map(gunCard).join('')}</div>
      <div class="hp-note">Mobility is your running speed with the weapon out, compared with the knife. The AWP drops to 70% while scoped.</div>` },

    { id:'round',    label:'The round', sub:'Phases and winning',   title:'The round',   lead:'Every round runs the same three phases, then straight into the next buy.', html:`
      <div class="hp-tl">
        <div style="flex:15;border-color:var(--tt-gold)"><b class="hp-gold">Buy</b><em>0:15</em><span>Frozen in spawn. Shop open. Look around, plan.</span></div>
        <div style="flex:40;border-color:#e07a5f"><b style="color:#f0a08a">Live</b><em>1:55</em><span>The round is running. Last team standing wins it.</span></div>
        <div style="flex:12;border-color:#7ec98f"><b class="hp-good">Over</b><em>0:05</em><span>Result and payouts.</span></div>
      </div>
      <div class="hp-h">Ways to win a round</div>
      <div class="hp-wins">
        <div class="hp-win">${IC.skull}<b>Elimination</b><span>Take out every player on the other team.</span></div>
        <div class="hp-win">${IC.clock}<b>Time</b><span>When the clock hits zero, the team with more players alive wins.</span></div>
        <div class="hp-win">${IC.shield}<b>Tie</b><span>Same number alive on the clock? <strong class="hp-ct">Defence</strong> takes it.</span></div>
      </div>
      <div class="hp-h">The match</div>
      <p class="hp-p">First to <strong>8 round wins</strong> takes the match. After <strong>7 rounds</strong> the sides swap and
        everyone's money resets to $800, so both teams play both corners.</p>` },

    { id:'money',    label:'Economy',  sub:'How you earn',          title:'Economy',     lead:'Money carries between rounds. You keep it when you die; you only lose the gun.', html:`
      <div class="hp-facts">
        <div class="hp-fact"><b>$800</b><span>Start of each half</span></div>
        <div class="hp-fact"><b>$16,000</b><span>Most you can hold</span></div>
        <div class="hp-fact" style="border-color:#7ec98f"><b>+$3,250</b><span>Round win</span></div>
        <div class="hp-fact"><b>$100&ndash;1,500</b><span>Per kill, by weapon</span></div>
      </div>
      <div class="hp-h">Round payout</div>
      <div class="hp-loss">${lossBars}</div>
      <div class="hp-loss-x"><span style="color:#7ec98f">Win</span><span>1 loss</span><span>2 losses</span><span>3 losses</span><span>4 losses</span><span>5+ losses</span></div>
      <div class="hp-note">The loss bonus climbs every round you lose in a row and resets the moment you win. That is what makes a cheap save round worth it.</div>
      <div class="hp-h">Kill rewards</div>
      <div class="hp-kills">${gunKeys.map(k => '<div class="hp-kill"><span>' + GUNS[k].name + '</span><b>$' + (KILL[k] || 300).toLocaleString() + '</b></div>').join('')}</div>
      <p class="hp-p" style="margin-top:14px">The AWP pays the least and the knife the most. The safest weapon barely pays; the riskiest pays for a full buy.</p>` },

    { id:'maps',     label:'Maps',     sub:mapIds.length + ' battlegrounds', title:'Maps', lead:'Both maps use diagonal spawns, so neither side has a mirror of the other.', html:`
      <div class="hp-maptabs">${mapIds.map(id =>
        '<button class="hp-maptab' + (id === MAP_ID ? ' on' : '') + '" data-map="' + id + '">' + ttPlanSVG(id, 40, false) +
        '<span>' + MAPS[id].name + (id === MAP_ID ? '<em>Loaded</em>' : '') + '</span></button>').join('')}</div>
      ${mapIds.map(id => '<div class="hp-map' + (id === MAP_ID ? ' on' : '') + '" data-map="' + id + '">' +
        '<div class="hp-map-plan">' + ttPlanSVG(id, 340) + '</div>' +
        '<div class="hp-legend">' + (mapLegend[id] || '<p class="hp-p">' + MAPS[id].blurb + '</p>') + '</div></div>').join('')}` },
  ];

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  const DESC = {
    scale:     ['Render scale', 'The biggest frame-rate lever. 75% draws about half the pixels of 100%.'],
    shadows:   ['Shadows', 'Soft looks best. Off is the fastest.'],
    adaptive:  ['Adaptive resolution', 'Lowers render scale for a moment when frames run late. Never goes above Render scale.'],
    fpstarget: ['FPS target', 'The frame rate adaptive resolution tries to hold. Match your screen.'],
    stats:     ['Stats overlay', 'Detailed performance numbers in the corner. Same as F3.'],
    sens:      ['Mouse sensitivity', 'How far the view turns for each mouse movement.'],
    fov:       ['Field of view', 'Wider shows more at the edges of the screen.'],
    volume:    ['Master volume', 'Every sound in the game: guns, footsteps, the UI.'],
    viewmodel: ['Weapon hand', 'Which side your gun is held on, or hide it.'],
    crosshair: ['Crosshair colour', 'Pick whatever stands out best against the map.'],
  };
  const PRESET_INFO = {
    LOW:    ['Fastest. 50% scale, no shadows.', 1],
    MEDIUM: ['75% scale, hard shadows.', 2],
    HIGH:   ['85% scale, soft shadows.', 3],
    ULTRA:  ['Full resolution, everything on.', 4],
  };
  const DEFAULTS = { quality:3, scale:4, shadows:2, fov:1, sens:2, volume:4, viewmodel:2, crosshair:0, stats:0, adaptive:1, fpstarget:1 };
  const SET_GROUPS = [
    { id:'graphics', label:'Graphics',    sub:'Quality and resolution', keys:['scale','shadows'], presets:true,
      lead:'Pick a preset, or tune render scale and shadows yourself.' },
    { id:'perf',     label:'Performance', sub:'Frame rate tools',       keys:['adaptive','fpstarget','stats'],
      lead:'Tools that keep the frame rate steady.' },
    { id:'input',    label:'Mouse & view', sub:'Aim and field of view', keys:['sens','fov'],
      lead:'How aiming feels and how much you can see.' },
    { id:'audio',    label:'Audio',       sub:'Volume',                 keys:['volume'],
      lead:'Sound levels.' },
    { id:'hud',      label:'HUD',         sub:'Crosshair and weapon',   keys:['crosshair','viewmodel'],
      lead:'What sits on your screen while you play.' },
  ];
  const XCOL = (typeof XHAIR === 'object') ? XHAIR : { RED:'#ff2b2b', GREEN:'#39ff6a', CYAN:'#3fe4ff', WHITE:'#ffffff', AMBER:'#ffc23d' };
  const xSVG = c => '<svg viewBox="0 0 30 30"><path d="M15 3v8M15 19v8M3 15h8M19 15h8" stroke="' + c + '" stroke-width="2.6" stroke-linecap="square"/><circle cx="15" cy="15" r="1.4" fill="' + c + '"/></svg>';

  function settingRow(k){
    const s = SET[k]; if(!s) return '';
    const [name, desc] = DESC[k] || [s.label, ''];
    let ctl;
    if(k === 'crosshair'){
      ctl = '<div class="hp-swatch">' + s.opts.map((o, i) =>
        '<button type="button" title="' + o + '" data-k="' + k + '" data-i="' + i + '" class="' + (i === s.i ? 'on' : '') + '" style="background:' + (XCOL[o] || '#fff') + '22">' +
        '<span style="width:14px;height:14px;background:' + (XCOL[o] || '#fff') + ';display:block"></span></button>').join('') +
        '<div class="hp-xprev">' + xSVG(XCOL[s.opts[s.i]] || '#fff') + '</div></div>';
    } else {
      ctl = '<div class="hp-seg">' + s.opts.map((o, i) =>
        '<button type="button" data-k="' + k + '" data-i="' + i + '" class="' + (i === s.i ? 'on' : '') + '">' + o + '</button>').join('') + '</div>';
    }
    return '<div class="hp-srow"><div class="hp-srow-l"><b>' + name + '</b><span>' + desc + '</span></div>' + ctl + '</div>';
  }
  function settingsGroupHTML(g){
    let h = '';
    if(g.presets){
      const q = setVal('quality');
      h += '<div class="hp-set-head"><div class="hp-h" style="margin:0;flex:1">Preset</div>' +
           '<span class="hp-custom' + (q === 'CUSTOM' ? ' on' : '') + '">Custom' + (q === 'CUSTOM' ? ' &middot; active' : '') + '</span></div>' +
           '<div class="hp-presets">' + Object.keys(PRESET_INFO).map(p =>
             '<button type="button" class="hp-preset' + (q === p ? ' on' : '') + '" data-preset="' + p + '"><b>' + p + '</b><span>' + PRESET_INFO[p][0] + '</span>' +
             '<u>' + [1,2,3,4].map(n => '<i class="' + (n <= PRESET_INFO[p][1] ? 'f' : '') + '"></i>').join('') + '</u></button>').join('') +
           '</div><div class="hp-h">Fine tune</div>';
    }
    h += '<div class="hp-card">' + g.keys.map(settingRow).join('') + '</div>';
    return h;
  }

  // ── markup ───────────────────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'tt-modal';
  modal.innerHTML = `
   <div id="hp-box" role="dialog" aria-modal="true">
    <aside id="hp-side">
      <div id="hp-kick">Tactical City</div>
      <div id="hp-title">How to play</div>
      <nav id="hp-nav"></nav>
      <div id="hp-foot"><kbd>Esc</kbd> to close</div>
    </aside>
    <div id="hp-main">
      <div id="hp-top">
        <div><h2 id="hp-h2"></h2><p id="hp-lead"></p></div>
        <div id="hp-top-r"><span class="hp-saved" id="hp-saved">Saved</span>
          <button type="button" class="hp-reset" id="hp-reset" style="display:none">Reset all</button>
          <button type="button" id="tt-close" aria-label="Close">&times;</button></div>
      </div>
      <div id="hp-body"></div>
    </div>
   </div>`;
  document.body.appendChild(modal);

  const $ = s => modal.querySelector(s);
  let mode = 'how', section = 'basics';

  function sections(){ return mode === 'how' ? HOW : SET_GROUPS; }

  function render(){
    const list = sections();
    $('#hp-title').textContent = mode === 'how' ? 'How to play' : 'Settings';
    $('#hp-reset').style.display = mode === 'set' ? '' : 'none';
    $('#hp-nav').innerHTML = list.map(s =>
      '<button type="button" class="hp-nav' + (s.id === section ? ' on' : '') + '" data-s="' + s.id + '">' +
      (IC[s.id] || '') + '<span>' + s.label + '<small>' + s.sub + '</small></span></button>').join('');
    const cur = list.find(s => s.id === section) || list[0];
    section = cur.id;
    $('#hp-h2').textContent = cur.title || cur.label;
    $('#hp-lead').textContent = cur.lead || '';
    $('#hp-body').innerHTML = '<div class="hp-sec on">' + (mode === 'how' ? cur.html : settingsGroupHTML(cur)) + '</div>';
    $('#hp-body').scrollTop = 0;
  }
  // settings re-render that keeps the scroll position
  function refreshSettings(){
    if(mode !== 'set' || !modal.classList.contains('on')) return;
    const st = $('#hp-body').scrollTop;
    const cur = SET_GROUPS.find(s => s.id === section);
    if(cur) $('#hp-body').firstChild.innerHTML = settingsGroupHTML(cur);
    $('#hp-body').scrollTop = st;
  }
  let _savedT = 0;
  function flashSaved(){
    const el = $('#hp-saved'); el.classList.add('on');
    clearTimeout(_savedT); _savedT = setTimeout(() => el.classList.remove('on'), 1100);
  }
  function setOption(k, i){
    const s = SET[k]; if(!s || i < 0 || i >= s.opts.length) return;
    s.i = i;
    if(k === 'scale' || k === 'shadows') SET.quality.i = SET.quality.opts.indexOf('CUSTOM');
    applySetting(k);
    saveSettings();
    if(typeof renderSettings === 'function') renderSettings();   // keeps everything in step
    flashSaved();
  }

  $('#hp-nav').addEventListener('click', e => {
    const b = e.target.closest('.hp-nav'); if(!b) return;
    section = b.dataset.s; render();
  });
  $('#hp-body').addEventListener('click', e => {
    const opt = e.target.closest('[data-k][data-i]');
    if(opt){ setOption(opt.dataset.k, +opt.dataset.i); return; }
    const pre = e.target.closest('[data-preset]');
    if(pre){ setOption('quality', SET.quality.opts.indexOf(pre.dataset.preset)); return; }
    const chip = e.target.closest('.hp-chip');
    if(chip){
      modal.querySelectorAll('.hp-chip').forEach(c => c.classList.toggle('on', c === chip));
      modal.querySelectorAll('.hp-gun').forEach(g => g.style.display = (chip.dataset.f === 'all' || g.dataset.cat === chip.dataset.f) ? '' : 'none');
      return;
    }
    const mt = e.target.closest('.hp-maptab');
    if(mt){
      modal.querySelectorAll('.hp-maptab').forEach(t => t.classList.toggle('on', t === mt));
      modal.querySelectorAll('.hp-map').forEach(m => m.classList.toggle('on', m.dataset.map === mt.dataset.map));
    }
  });
  $('#hp-reset').addEventListener('click', () => {
    for(const k in DEFAULTS) if(SET[k]) SET[k].i = DEFAULTS[k];
    for(const s of SETTINGS) if(s.key !== 'quality') applySetting(s.key);
    applySetting('quality');
    saveSettings();
    if(typeof renderSettings === 'function') renderSettings();
    flashSaved();
  });

  // b0-menu's renderSettings() runs whenever a setting changes elsewhere (F4
  // cycles quality). Wrap it so this screen follows along.
  if(typeof renderSettings === 'function'){
    const _base = renderSettings;
    renderSettings = function(){ _base(); refreshSettings(); };
  }

  const HOW_IDS = HOW.map(s => s.id);
  function open(name){
    if(name === 'inventory'){ if(typeof invOpen === 'function') invOpen(); return; }
    if(name === 'settings' || SET_GROUPS.some(g => g.id === name)){
      mode = 'set'; section = name === 'settings' ? 'graphics' : name;
    } else {
      mode = 'how';
      section = name === 'map' ? 'maps' : (HOW_IDS.includes(name) ? name : 'basics');
    }
    render();
    modal.classList.add('on');
    if(typeof netUpdateResume === 'function') netUpdateResume();
  }
  function close(){
    modal.classList.remove('on');
    if(typeof netUpdateResume === 'function') netUpdateResume();
  }
  $('#tt-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if(e.target === modal) close(); });
  addEventListener('keydown', e => {
    if(e.code === 'Escape' && modal.classList.contains('on')) close();
  });
  window.ttOpen = open;
  window.ttClose = close;

  // ── entry points ──────────────────────────────────────────────────────────
  const panel = document.querySelector('#net-lobby #net-panel');
  if(panel){
    const row = document.createElement('div');
    row.className = 'net-row';
    row.style.marginTop = '2px';
    row.innerHTML =
      '<button class="net-btn ghost" id="tt-open-tut" style="flex:1">How to play</button>' +
      '<button class="net-btn ghost" id="tt-open-set" style="flex:1">Settings</button>';
    panel.appendChild(row);
    row.querySelector('#tt-open-tut').addEventListener('click', () => open('basics'));
    row.querySelector('#tt-open-set').addEventListener('click', () => open('settings'));
  }

  // The solo screen's buttons point at the same screens.
  const bs = document.getElementById('btn-settings');
  const bt = document.getElementById('btn-tutorial');
  if(bs){ const c = bs.cloneNode(true); bs.replaceWith(c);
          c.addEventListener('click', () => open('settings')); }
  if(bt){ const c = bt.cloneNode(true); bt.replaceWith(c);
          c.addEventListener('click', () => open('basics')); }
})();


// ════════════════════════════════════════════════════════════════════════════
//  RETIRING THE OLD #instructions SCREEN
//
//  It is hidden by CSS above, but it was doing three jobs that have to be
//  rehomed or the game becomes unstartable:
//
//    1. START      its PLAY button granted money, equipped a gun and locked
//                  the pointer. "Play solo" now does that directly, with no
//                  screen in between.
//    2. RESUME     90-input reopens it whenever pointer lock drops, which was
//                  the only way back in after Esc. The resume overlay covers
//                  that for a match; this extends it to solo play.
//    3. RESPAWN    resetGame() shows it on death. Unreachable today (there are
//                  no bots, so nothing damages you in solo) but it would strand
//                  a player the moment bots come back — so it is handled too.
//
//  The body class is only added when the lobby actually exists. Delete
//  d0-net.js and the old screen returns, rather than leaving no entry at all.
// ════════════════════════════════════════════════════════════════════════════
(function retireOldMenu(){
  // The parts are loaded by the time this runs, so the loading state is over.
  function bootDone(){
    const b = document.getElementById('boot');
    if(b){ b.classList.add('gone'); setTimeout(() => b.remove(), 700); }
  }
  bootDone();

  const lobby = document.getElementById('net-lobby');
  if(!lobby){
    // d0-net.js is absent, and the old menu no longer exists to fall back on —
    // so put a minimal way into the game on screen rather than nothing at all.
    const fb = document.createElement('button');
    fb.textContent = 'PLAY';
    fb.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
      'z-index:450;padding:16px 46px;border:none;cursor:pointer;' +
      "font:800 15px/1 'Stratum2','Arial Narrow',sans-serif;letter-spacing:.22em;" +
      'color:#20160b;background:linear-gradient(#f0cf7c,#c99a3f)';
    fb.addEventListener('click', () => { fb.remove(); startSolo(); });
    document.body.appendChild(fb);
    return;
  }
  document.body.classList.add('tt-has-lobby');

  // Solo play, without the intermediate screen. Mirrors what #start-btn did.
  // Declared with `function` so the fallback branch above can call it.
  window.ttSoloPlaying = false;
  function startSolo(){
    window.ttSoloPlaying = true;
    // Stop receiving the public game list; we are not shopping any more.
    if(typeof netBrowse === 'function') netBrowse(false);
    lobby.classList.add('net-hide');
    const room = document.getElementById('net-room');
    if(room) room.classList.add('net-hide');
    if(typeof START_MONEY === 'number') money = Math.max(money, START_MONEY);
    if(typeof equipGun === 'function') equipGun(selectedGunKey);
    updateHUD(); updateMoneyUI(); updateSlotUI();
    try { const p = document.body.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); } catch(e){}
  }

  // Replace the node so d0-net's own handler (which reopened #instructions)
  // does not also fire.
  const solo = document.getElementById('net-solo');
  if(solo){
    const c = solo.cloneNode(true);
    c.textContent = 'Play solo';
    solo.replaceWith(c);
    c.addEventListener('click', startSolo);
  }

  // Same for the old PLAY button, in case anything reaches it.
  const start = document.getElementById('start-btn');
  if(start){
    const c = start.cloneNode(true);
    start.replaceWith(c);
    c.addEventListener('click', startSolo);
  }

  // No observer needed: index.html carries
  //   #instructions{ display:none !important; }
  // and a stylesheet !important outranks the plain inline display that
  // resetGame() and the pointerlockchange handler set.
})();

// The cinematic camera must not fly around while a solo game is merely paused —
// you want to see where you are standing, exactly as in a match.
const _ttBaseShouldRun = _titleShouldRun;
_titleShouldRun = function(){
  if(window.ttSoloPlaying) return false;
  return _ttBaseShouldRun();
};