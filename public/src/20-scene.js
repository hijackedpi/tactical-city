// ── SCENE ──────────────────────────────────────────────────────────────────
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87CEEB);
scene.fog=new THREE.FogExp2(0x99aacc,0.018);

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.2,420);
camera.position.set(0,1.7,0);
scene.add(camera);

const renderer=new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
// ── ENVIRONMENT MAP (procedural) — gives metals real reflections ──
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
{
  const _pmrem = new THREE.PMREMGenerator(renderer);
  const _envScene = new THREE.Scene();
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128;
  const cx = cv.getContext('2d');
  const grad = cx.createLinearGradient(0,0,0,128);
  grad.addColorStop(0,'#bcd4ee'); grad.addColorStop(0.5,'#6f7c8c'); grad.addColorStop(1,'#23272e');
  cx.fillStyle = grad; cx.fillRect(0,0,16,128);
  const skyMat = new THREE.MeshBasicMaterial({ side:THREE.BackSide, map:new THREE.CanvasTexture(cv) });
  _envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,24,12), skyMat));
  scene.environment = _pmrem.fromScene(_envScene, 0.04).texture;
}

// ── LIGHTS ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xd0d8e8,0.6));
const sun=new THREE.DirectionalLight(0xfff0d0,1.8);
sun.position.set(60,90,40); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
// Cull tiny shadow casters at scene-build time (invisible micro-shadows, big cost)
const _origMesh = THREE.Mesh;
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
Object.assign(sun.shadow.camera,{near:1,far:400,left:-70,right:70,top:70,bottom:-70});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-0.0003; scene.add(sun);
scene.add(new THREE.HemisphereLight(0x7090c0,0x806050,0.4));
const _interiorFill = new THREE.AmbientLight(0xffe4c0, 0);
scene.add(_interiorFill);
