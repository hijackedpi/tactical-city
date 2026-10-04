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

  const style = document.createElement('style');
  style.textContent = `
  #tt-modal{position:fixed;inset:0;z-index:420;display:none;align-items:center;
    justify-content:center;background:rgba(6,8,12,.82);backdrop-filter:blur(7px);
    font-family:'Stratum2','Arial Narrow','Segoe UI',sans-serif;color:#eee6d6}
  #tt-modal.on{display:flex}
  #tt-box{width:min(940px,94vw);height:min(80vh,760px);display:flex;flex-direction:column;
    background:rgba(15,18,24,.96);border:1px solid rgba(217,178,90,.24);
    border-top:2px solid #c98f4a;box-shadow:0 30px 90px rgba(0,0,0,.62)}
  #tt-head{display:flex;align-items:center;gap:4px;padding:0 8px 0 22px;
    border-bottom:1px solid rgba(217,178,90,.16);flex:0 0 auto;flex-wrap:wrap}
  #tt-head .ttl{font-weight:800;font-size:17px;letter-spacing:.16em;text-transform:uppercase;
    margin-right:14px;color:#f2e6cf;padding:15px 0}
  .tt-tab{background:none;border:none;color:#8a7f6c;cursor:pointer;padding:16px 13px;
    font:700 12px/1 inherit;letter-spacing:.13em;text-transform:uppercase;
    border-bottom:2px solid transparent;transition:color .15s}
  .tt-tab:hover{color:#d8cbb2}
  .tt-tab.on{color:#e8c877;border-bottom-color:#c98f4a}
  #tt-close{margin-left:auto;background:none;border:1px solid #333c48;color:#9aa3b0;
    cursor:pointer;font:700 12px/1 inherit;letter-spacing:.12em;padding:9px 14px}
  #tt-close:hover{color:#fff;border-color:#5a6577}
  #tt-body{overflow-y:auto;padding:24px 26px 30px;flex:1 1 auto;line-height:1.6}
  .tt-pane{display:none}
  .tt-pane.on{display:block;animation:tFade .2s ease-out}
  .tt-h{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#c98f4a;
    font-weight:700;margin:26px 0 10px;padding-bottom:7px;border-bottom:1px solid rgba(217,178,90,.14)}
  .tt-pane > .tt-h:first-child{margin-top:0}
  .tt-p{max-width:74ch;color:#c9bda6;margin:0 0 13px;font-size:14.5px}
  .tt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:7px 20px;margin-bottom:6px}
  .tt-row{display:flex;align-items:center;gap:9px;font-size:14px;color:#ddd3bf;padding:3px 0}
  .tt-row .lbl{color:#9c917f}
  kbd.tt-k{display:inline-block;min-width:26px;text-align:center;padding:4px 7px;
    background:#20262f;border:1px solid #39414d;border-bottom-width:2px;border-radius:3px;
    font:700 11.5px/1 inherit;color:#e9dfc9;letter-spacing:.04em}
  table.tt-t{border-collapse:collapse;width:100%;margin:4px 0 16px;font-size:13.5px}
  table.tt-t th{text-align:left;font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
    color:#8a7f6c;font-weight:700;padding:8px 11px;background:rgba(255,255,255,.03)}
  table.tt-t td{padding:7px 11px;border-top:1px solid rgba(255,255,255,.06);color:#d5cab4;
    font-variant-numeric:tabular-nums}
  table.tt-t tr:hover td{background:rgba(217,178,90,.05)}
  .tt-good{color:#7ec98f}.tt-bad{color:#e08a7e}.tt-gold{color:#e8c877}
  .tt-t-col{color:#e0a35a;font-weight:700}.tt-ct-col{color:#7fa8d8;font-weight:700}
  .tt-note{border-left:2px solid #c98f4a;background:rgba(201,143,74,.07);
    padding:11px 15px;margin:14px 0;font-size:13.5px;color:#cdbfa5;max-width:74ch}
  .tt-map-wrap{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
  .tt-legend{font-size:13.5px;color:#c9bda6;min-width:210px;flex:1}
  .tt-legend div{display:flex;align-items:center;gap:9px;padding:4px 0}
  .tt-legend i{width:12px;height:12px;flex:0 0 auto;border-radius:2px;display:block}
  #tt-body .set-list{max-width:600px;margin-left:0 !important;margin-right:auto !important}
  `;
  document.head.appendChild(style);

  // ── reference tables, generated from the live config ──────────────────────
  const gunRows = Object.keys(GUNS)
    .sort((a,b) => GUNS[a].order - GUNS[b].order)
    .map(k => {
      const g = GUNS[k];
      const kill = { knife:1500, glock18:300, deagle:300, mac10:600, mp5:600,
                     mp7:600, ump45:600, ak47:300, m4a1:300, awp:100 }[k] || 300;
      return '<tr><td>' + g.name + '</td>' +
        '<td>' + (g.price ? '$' + g.price.toLocaleString() : '<span class="tt-good">free</span>') + '</td>' +
        '<td>' + g.damage + '</td>' +
        '<td>' + (g.melee ? '&mdash;' : g.maxAmmo + ' + ' + ((g.spareMags||0) * g.ammo)) + '</td>' +
        '<td>' + g.range + '</td>' +
        '<td class="tt-gold">$' + kill + '</td></tr>';
    }).join('');

  // Keys are arrays, not space-separated strings: "Left click" is ONE key, but
  // W/A/S/D are four, and splitting on spaces cannot tell those apart.
  const KEYS = [
    [['W','A','S','D'],'Move'], [['Space'],'Jump'], [['Mouse'],'Aim'],
    [['Left click'],'Fire'], [['Right click'],'Scope (AWP only)'],
    [['R'],'Reload'], [['1'],'Knife'], [['2'],'Pistol'], [['3'],'Primary weapon'],
    [['B'],'Buy menu (buy time only)'], [['Tab'],'Hold for scoreboard'],
    [['V'],'Third person'], [['Esc'],'Release the mouse'],
    [['F3'],'Performance stats'], [['F4'],'Cycle quality preset'],
  ].map(([keys,d]) =>
    '<div class="tt-row">' +
    keys.map(k => '<kbd class="tt-k">' + k + '</kbd>').join(' ') +
    '<span class="lbl">' + d + '</span></div>').join('');

  // World coords -> a 200x200 top-down plan. +z is north, so it maps to -y.
  const px = x => ((x + 47) / 94 * 200).toFixed(1);
  const py = z => ((47 - z) / 94 * 200).toFixed(1);
  const box = (x0,z0,x1,z1,fill,stroke) =>
    `<rect x="${px(x0)}" y="${py(z1)}" width="${(px(x1)-px(x0)).toFixed(1)}" height="${(py(z0)-py(z1)).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;

  const MAP_PANE = (MAP_ID === 'overgrowth') ? `
        <div class="tt-h">Overgrowth</div>
        <p class="tt-p">Temple ruins swallowed by jungle, 90 by 90 units. Deliberately
          <strong>asymmetric</strong>, with <strong>diagonal spawns</strong>: Attack in the south-west
          corner, Defence in the north-east. Each quarter plays differently, and each team
          starts nearer to one side. A river runs the full width through mid.</p>
        <div class="tt-map-wrap">
          ${ttPlanSVG('overgrowth', 330)}
          <div class="tt-legend">
            <div><i style="background:#e0a35a"></i> <strong class="tt-t-col">Attack spawn</strong> &mdash; south-west corner</div>
            <div><i style="background:#6fa3dc"></i> <strong class="tt-ct-col">Defence spawn</strong> &mdash; north-east corner, by the temple</div>
            <div><i style="background:#5b5c4a"></i> <strong>North-west plains</strong> &mdash; open ground around the colossus and a giant banyan tree. Long sightlines: rifles and the AWP. Closest to Attack.</div>
            <div><i style="background:#5b5c4a"></i> <strong>South-east warren</strong> &mdash; packed ruins, narrow alleys and a torch-lit tunnel. Close range: SMGs. Closest to Defence.</div>
            <div><i style="background:#c9b27a"></i> <strong>Mid</strong> &mdash; the tower at the centre, where the diagonal routes meet. About equally far from both spawns.</div>
            <p class="tt-p" style="margin-top:14px;font-size:13.5px">
              Each team can reach its own side first, so the fight usually starts over
              <strong>mid</strong>. Whoever holds it can rotate to either side faster.</p>
          </div>
        </div>        </div>` : `
        <div class="tt-h">Palace</div>
        <p class="tt-p">A walled palace compound, 94 by 94 units. The layout is
          <strong>diagonal, not mirrored</strong>: the two spawns and two open courts alternate
          around the four corners, so each team begins near one court and far from the other.</p>
        <div class="tt-map-wrap">
          ${ttPlanSVG('alcazar', 330)}
          <div class="tt-legend">
            <div><i style="background:#e0a35a"></i> <strong class="tt-t-col">Attack spawn</strong> &mdash; north-west</div>
            <div><i style="background:#7fa8d8"></i> <strong class="tt-ct-col">Defence spawn</strong> &mdash; south-east</div>
            <div><i style="background:#6a5a40"></i> <strong>Great Court</strong> &mdash; north-east</div>
            <div><i style="background:#6a5a40"></i> <strong>Bazaar Court</strong> &mdash; south-west</div>
            <div><i style="background:#5d4a2c"></i> Curtain wall &mdash; the hard edge of the map</div>
            <p class="tt-p" style="margin-top:14px;font-size:13.5px">
              Attack reaches the Great Court quickly and the Bazaar the long way round;
              Defence is the reverse. Whoever holds <strong>mid</strong> can rotate to either
              side faster than the other team can.</p>
          </div>
        </div>`;

  const modal = document.createElement('div');
  modal.id = 'tt-modal';
  modal.innerHTML = `
   <div id="tt-box">
    <div id="tt-head">
      <span class="ttl">Tactical City</span>
      <button class="tt-tab on" data-p="controls">Controls</button>
      <button class="tt-tab" data-p="round">The round</button>
      <button class="tt-tab" data-p="money">Money</button>
      <button class="tt-tab" data-p="map">The map</button>
      <button class="tt-tab" data-p="settings">Settings</button>
      <button id="tt-close">Close</button>
    </div>
    <div id="tt-body">

      <div class="tt-pane on" data-p="controls">
        <div class="tt-h">Controls</div>
        <div class="tt-grid">${KEYS}</div>
        <div class="tt-h">Weapons</div>
        <p class="tt-p">You always carry a knife and a pistol. A primary goes in slot 3.
          Buy during buy time with <kbd class="tt-k">B</kbd>. Die and you lose your primary,
          so most rounds start with a decision about what you can afford.</p>
        <table class="tt-t">
          <tr><th>Weapon</th><th>Price</th><th>Damage</th><th>Ammo</th><th>Range</th><th>Reward / kill</th></tr>
          ${gunRows}
        </table>
        <div class="tt-note">The AWP kill reward is deliberately low and the knife's is
          the highest in the game. That is the trade: the safest weapon barely pays,
          and the most dangerous one pays for a full buy.</div>
      </div>

      <div class="tt-pane" data-p="round">
        <div class="tt-h">How a match runs</div>
        <p class="tt-p">Two teams, up to ten players. <strong class="tt-t-col">Attack</strong>
          starts in the north-west corner, <strong class="tt-ct-col">Defence</strong> in the
          south-east. First team to <strong>8 round wins</strong> takes the match, and sides
          swap once <strong>7 rounds</strong> have been played, so both halves are played
          from both corners.</p>
        <table class="tt-t">
          <tr><th>Phase</th><th>Length</th><th>What happens</th></tr>
          <tr><td class="tt-gold">Buy</td><td>15s</td><td>Frozen in spawn. Shop open. You can look around but not move.</td></tr>
          <tr><td class="tt-gold">Live</td><td>1:55</td><td>Round is running. Last team standing wins it.</td></tr>
          <tr><td class="tt-gold">Round over</td><td>5s</td><td>Result and payouts, then straight into the next buy.</td></tr>
        </table>
        <div class="tt-h">Winning a round</div>
        <div class="tt-row"><span class="tt-good">&#9656;</span><span>Eliminate every player on the other team.</span></div>
        <div class="tt-row"><span class="tt-good">&#9656;</span><span>Or hold more players alive than they do when the clock runs out.</span></div>
        <div class="tt-row"><span class="lbl">&#9656;</span><span>A dead tie on the clock goes to Defence.</span></div>
        <div class="tt-note">Death is not respawn. Once you are down you spectate until the
          round ends, so trading your life for one kill is rarely worth it.</div>
      </div>

      <div class="tt-pane" data-p="money">
        <div class="tt-h">The economy</div>
        <p class="tt-p">Money carries between rounds and resets to $800 at the swap.
          It is capped at $16,000. You keep your money when you die &mdash; you only lose
          the gun, which is what makes losing an expensive rifle hurt.</p>
        <table class="tt-t">
          <tr><th>Event</th><th>Payout</th></tr>
          <tr><td>Start of each half</td><td class="tt-gold">$800</td></tr>
          <tr><td>Win a round</td><td class="tt-good">+$3,250</td></tr>
          <tr><td>Lose 1 round in a row</td><td>+$1,400</td></tr>
          <tr><td>Lose 2 in a row</td><td>+$1,900</td></tr>
          <tr><td>Lose 3 in a row</td><td>+$2,400</td></tr>
          <tr><td>Lose 4 in a row</td><td>+$2,900</td></tr>
          <tr><td>Lose 5 or more</td><td>+$3,400</td></tr>
          <tr><td>Kill</td><td class="tt-gold">$100 &ndash; $1,500 by weapon</td></tr>
        </table>
        <div class="tt-note">The loss bonus climbs the longer you lose, and resets the
          moment you win one. That is what makes a save round worth playing: go cheap
          now, and the round after next you can afford everything.</div>
      </div>

      <div class="tt-pane" data-p="map">${MAP_PANE}</div>

      <div class="tt-pane" data-p="settings">
        <div class="tt-h">Settings</div>
        <p class="tt-p">Every option here changes real engine state and is remembered
          between sessions. <strong>Render scale</strong> is by far the strongest lever if
          the frame rate is low &mdash; pixels scale with the square, so 75% draws barely
          over half the work. Changing any individual option switches Quality to Custom.</p>
        <div id="tt-set-host"></div>
      </div>

    </div>
   </div>`;
  document.body.appendChild(modal);

  // Move b0-menu's live settings list in, rather than rebuilding it. Its
  // renderSettings() finds the node by id, so everything keeps working.
  const host = modal.querySelector('#tt-set-host');
  const setList = document.getElementById('set-list');
  if(host && setList){
    host.appendChild(setList);
    if(typeof renderSettings === 'function') renderSettings();
  }

  const panes = [...modal.querySelectorAll('.tt-pane')];
  const tabs  = [...modal.querySelectorAll('.tt-tab')];
  function show(name){
    tabs.forEach(t => t.classList.toggle('on', t.dataset.p === name));
    panes.forEach(p => p.classList.toggle('on', p.dataset.p === name));
    modal.querySelector('#tt-body').scrollTop = 0;
  }
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.p)));

  function open(name){ modal.classList.add('on'); show(name || 'controls');
    if(typeof netUpdateResume === 'function') netUpdateResume(); }
  function close(){ modal.classList.remove('on');
    // the resume overlay stands down while the modal is open, so re-evaluate
    if(typeof netUpdateResume === 'function') netUpdateResume(); }
  modal.querySelector('#tt-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if(e.target === modal) close(); });
  addEventListener('keydown', e => {
    if(e.code === 'Escape' && modal.classList.contains('on')) close();
  });
  window.ttOpen = open;

  // ── entry points ──────────────────────────────────────────────────────────
  // The lobby had no way to reach either of these at all.
  const panel = document.querySelector('#net-lobby #net-panel');
  if(panel){
    const row = document.createElement('div');
    row.className = 'net-row';
    row.style.marginTop = '2px';
    row.innerHTML =
      '<button class="net-btn ghost" id="tt-open-tut" style="flex:1">How to play</button>' +
      '<button class="net-btn ghost" id="tt-open-set" style="flex:1">Settings</button>';
    panel.appendChild(row);
    row.querySelector('#tt-open-tut').addEventListener('click', () => open('controls'));
    row.querySelector('#tt-open-set').addEventListener('click', () => open('settings'));
  }

  // Point the solo screen's buttons at the same modal, so there is one version
  // of each rather than two that can drift apart.
  const bs = document.getElementById('btn-settings');
  const bt = document.getElementById('btn-tutorial');
  if(bs){ const c = bs.cloneNode(true); bs.replaceWith(c);
          c.addEventListener('click', () => open('settings')); }
  if(bt){ const c = bt.cloneNode(true); bt.replaceWith(c);
          c.addEventListener('click', () => open('controls')); }
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