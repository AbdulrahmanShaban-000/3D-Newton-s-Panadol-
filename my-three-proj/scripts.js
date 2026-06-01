import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════
// 1. CONFIGURATION & VISUAL CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    simulation: {
        ballCount: 5,
        radius: 0.78,
        mass: 1.0,
        length: 7.0,
        gravity: 15.0,
        timeScale: 1.3,
        damping: 0.9996,
        subSteps: 25,
        collisionIterations: 10,
        pivotY: 10.5,
        frameLeft:  -9.0,
        frameRight:  9.0
    },
    colors: {
        studioBg:        0xdcdcdc,
        ambient:         0x334455,
        keyLight:        0xffffff,
        fillLight:       0x4466aa,
        steelChrome:     0x888888,
        structuralSteel: 0x888899,
        baseWood:        0x150d0a,
        string:          0x999999,
        wallFallback:    0x7a4a2a
    }
};

const SPACING        = CONFIG.simulation.radius * 2.0;
const MAX_ANGLE      = Math.asin(Math.min(
    (CONFIG.simulation.frameRight
        - (CONFIG.simulation.ballCount - 1) * SPACING / 2
        - CONFIG.simulation.radius)
    / CONFIG.simulation.length, 0.999));
const SAFE_MAX_ANGLE = Math.min(MAX_ANGLE * 0.9, Math.PI / 2.2);

// ═══════════════════════════════════════════════════════════════
// 2. CORE SETUP
// ═══════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.studioBg);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping  = true;
orbitControls.dampingFactor  = 0.05;
orbitControls.maxPolarAngle  = Math.PI / 2 - 0.05;
orbitControls.minDistance    = 8;
orbitControls.maxDistance    = 32;
orbitControls.target.set(0, 4.5, 0);

// ═══════════════════════════════════════════════════════════════
// 3. TEXTURE LOADING
// ═══════════════════════════════════════════════════════════════
const textureLoader = new THREE.TextureLoader();

const bricksTexture = textureLoader.load('textures/ram.png',
    undefined,
    err => console.warn('bricks texture not found', err)
);
bricksTexture.wrapS = THREE.RepeatWrapping;
bricksTexture.wrapT = THREE.RepeatWrapping;
bricksTexture.repeat.set(6, 4);

const poliTexture = textureLoader.load('textures/poli.png',
    undefined,
    err => console.warn('poli texture not found', err)
);

const ironTexture = textureLoader.load('textures/iron.png',
    tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 4);
    },
    undefined,
    err => console.warn('iron texture not found', err)
);

// ═══════════════════════════════════════════════════════════════
// 4. LIGHTING
// ═══════════════════════════════════════════════════════════════
function initLighting() {
    scene.add(new THREE.AmbientLight(CONFIG.colors.ambient, 0.45));

    const keyLight = new THREE.DirectionalLight(CONFIG.colors.keyLight, 1.4);
    keyLight.position.set(8, 16, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near   =  2;
    keyLight.shadow.camera.far    = 45;
    keyLight.shadow.camera.left   = -18;
    keyLight.shadow.camera.right  =  18;
    keyLight.shadow.camera.top    =  20;
    keyLight.shadow.camera.bottom =  -2;
    keyLight.shadow.bias          = -0.0002;
    keyLight.shadow.normalBias    =  0.015;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(CONFIG.colors.fillLight, 0.5);
    fillLight.position.set(-8, 10, -4);
    scene.add(fillLight);
}

// ═══════════════════════════════════════════════════════════════
// 5. ENVIRONMENT MAP
// ═══════════════════════════════════════════════════════════════
function generateEnvironmentMap() {
    const canvas = document.createElement('canvas');
    canvas.width  = 1024;
    canvas.height = 512;
    const ctx  = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0,   '#aabbcc');
    grad.addColorStop(0.5, '#778899');
    grad.addColorStop(1,   '#445566');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(200,  50, 120, 160);
    ctx.fillRect(700,  80, 100, 120);

    const envTex = new THREE.CanvasTexture(canvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;
}

initLighting();
generateEnvironmentMap();

// ═══════════════════════════════════════════════════════════════
// 6. FRAME — أعمدة مائلة للخارج + قاعدة موسّعة
// ═══════════════════════════════════════════════════════════════
function createFrame() {
    const frameGroup = new THREE.Group();

    // ── مواد ────────────────────────────────────────────────────
    const metalMat = new THREE.MeshStandardMaterial({
        map:             ironTexture,
        color:           new THREE.Color(CONFIG.colors.structuralSteel),
        metalness:       0.92,
        roughness:       0.25,
        envMapIntensity: 1.0
    });
    const woodMat = new THREE.MeshStandardMaterial({
        color:     CONFIG.colors.baseWood,
        metalness: 0.1,
        roughness: 0.6
    });
    const wallMat = new THREE.MeshStandardMaterial({
        map:             bricksTexture,
        color:           new THREE.Color(CONFIG.colors.wallFallback),
        roughness:       0.9,
        metalness:       0.0,
        side:            THREE.BackSide,
        envMapIntensity: 0.0
    });

    // ── غرفة محيطة ──────────────────────────────────────────────
    const room = new THREE.Mesh(new THREE.BoxGeometry(45, 25, 35), wallMat);
    room.position.set(0, 12, 0);
    room.receiveShadow = true;
    scene.add(room);

    // ── ثوابت الهندسة ────────────────────────────────────────────
    //
    //  الأعمدة مائلة: الرأس قريب من مركز العارضة، القدم بعيدة للخارج
    //
    //      topX = ±3.0   (رأس العمود تحت العارضة)
    //      botX = ±9.5   (قدم العمود على القاعدة)
    //      topY = 11.8   (ارتفاع العارضة العلوية)
    //      botY = 0.6    (ارتفاع العارضة السفلية / القاعدة)
    //
    const TOP_X  =  3.0;   // |x| رأس العمود
    const BOT_X  =  9.5;   // |x| قدم العمود
    const TOP_Y  = 11.8;
    const BOT_Y  =  0.6;
    const Z_NEAR =  0.9;   // z الجانب الأمامي
    const Z_FAR  = -0.9;   // z الجانب الخلفي
    const POLE_R =  0.13;  // نصف قطر الأعمدة

    // ── دالة مساعدة: عمود مائل بين نقطتين ──────────────────────
    function addPole(x1, y1, z, x2, y2) {
        const top = new THREE.Vector3(x1, y1, z);
        const bot = new THREE.Vector3(x2, y2, z);
        const dir = new THREE.Vector3().subVectors(bot, top);
        const len = dir.length();
        const mid = top.clone().addScaledVector(dir, 0.5);

        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(POLE_R, POLE_R * 1.1, len, 32),
            metalMat
        );
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.clone().normalize()
        );
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        frameGroup.add(mesh);
    }

    // ── دالة مساعدة: أسطوانة أفقية (عارضة) ─────────────────────
    function addHBeam(x, len, y, z, rScale = 1.0) {
        // x = مركز، len = طول، محور X
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(POLE_R * rScale, POLE_R * rScale, len, 32),
            metalMat
        );
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        frameGroup.add(mesh);
    }

    // ── دالة مساعدة: أسطوانة عرضية (محور Z) ────────────────────
    function addZBeam(x, y, len, rScale = 0.9) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(POLE_R * rScale, POLE_R * rScale, len, 32),
            metalMat
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        frameGroup.add(mesh);
    }

    // ── دالة مساعدة: كرة مفصل ───────────────────────────────────
    function addJoint(x, y, z, r = 1.4) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(POLE_R * r, 20, 20),
            metalMat
        );
        mesh.position.set(x, y, z);
        frameGroup.add(mesh);
    }

    // ════════════════════════════════════════════════════════════
    // الجانب الأمامي  (z = +Z_NEAR)
    // ════════════════════════════════════════════════════════════
    // عمود يسار مائل
    addPole(-TOP_X, TOP_Y, Z_NEAR,  -BOT_X, BOT_Y, Z_NEAR);
    // عمود يمين مائل
    addPole( TOP_X, TOP_Y, Z_NEAR,   BOT_X, BOT_Y, Z_NEAR);
    // عارضة علوية
    addHBeam(0, TOP_X * 2, TOP_Y, Z_NEAR, 0.95);
    // عارضة سفلية
    addHBeam(0, BOT_X * 2, BOT_Y, Z_NEAR, 0.85);

    // ════════════════════════════════════════════════════════════
    // الجانب الخلفي  (z = +Z_FAR)
    // ════════════════════════════════════════════════════════════
    addPole(-TOP_X, TOP_Y, Z_FAR,  -BOT_X, BOT_Y, Z_FAR);
    addPole( TOP_X, TOP_Y, Z_FAR,   BOT_X, BOT_Y, Z_FAR);
    addHBeam(0, TOP_X * 2, TOP_Y, Z_FAR, 0.95);
    addHBeam(0, BOT_X * 2, BOT_Y, Z_FAR, 0.85);

    // ════════════════════════════════════════════════════════════
    // عوارض عرضية تربط الجانبين (محور Z)
    // ════════════════════════════════════════════════════════════
    const zLen = Math.abs(Z_NEAR - Z_FAR); // = 1.8
    // أعلى يسار وأعلى يمين
    addZBeam(-TOP_X, TOP_Y, zLen);
    addZBeam( TOP_X, TOP_Y, zLen);
    // أسفل يسار وأسفل يمين
    addZBeam(-BOT_X, BOT_Y, zLen);
    addZBeam( BOT_X, BOT_Y, zLen);

    // ════════════════════════════════════════════════════════════
    // كرات مفاصل عند الزوايا الثماني
    // ════════════════════════════════════════════════════════════
    [-TOP_X, TOP_X].forEach(x => {
        [Z_NEAR, Z_FAR].forEach(z => {
            addJoint(x, TOP_Y, z, 1.5);
        });
    });
    [-BOT_X, BOT_X].forEach(x => {
        [Z_NEAR, Z_FAR].forEach(z => {
            addJoint(x, BOT_Y, z, 1.3);
        });
    });

    // ════════════════════════════════════════════════════════════
    // القاعدة الخشبية الموسّعة
    // ════════════════════════════════════════════════════════════
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(20.5, 0.7, 4.5),
        woodMat
    );
    base.position.set(0, 0.25, 0);
    base.castShadow    = true;
    base.receiveShadow = true;
    frameGroup.add(base);

    scene.add(frameGroup);
}
createFrame();

// ═══════════════════════════════════════════════════════════════
// 7. BALL CLASS
// ═══════════════════════════════════════════════════════════════
class Ball {
    constructor(idx, px) {
        this.idx  = idx;
        this.px   = px;
        this.py   = CONFIG.simulation.pivotY;
        this.pz   = 0;
        this.angle = 0;
        this.omega = 0;
        this.isDragging = false;

        const ballMat = new THREE.MeshPhysicalMaterial({
            map:               poliTexture,
            color:             new THREE.Color(CONFIG.colors.steelChrome),
            metalness:         0.9,
            roughness:         0.2,
            clearcoat:         0.2,
            clearcoatRoughness: 0.1,
            reflectivity:      0.8,
            envMapIntensity:   0.8
        });

        const geo  = new THREE.SphereGeometry(CONFIG.simulation.radius, 64, 64);
        this.mesh  = new THREE.Mesh(geo, ballMat);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData      = { ball: this, isBall: true };
        scene.add(this.mesh);

        const stringMat = new THREE.LineBasicMaterial({
            color:       CONFIG.colors.string,
            transparent: true,
            opacity:     0.75,
            linewidth:   1
        });
        const lg1 = new THREE.BufferGeometry().setAttribute(
            'position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const lg2 = new THREE.BufferGeometry().setAttribute(
            'position', new THREE.BufferAttribute(new Float32Array(6), 3));
        this.stringLeft  = new THREE.Line(lg1, stringMat);
        this.stringRight = new THREE.Line(lg2, stringMat);
        scene.add(this.stringLeft);
        scene.add(this.stringRight);

        const anchorMat = new THREE.MeshStandardMaterial({
            map:       ironTexture,
            color:     new THREE.Color(0x777788),
            metalness: 0.88,
            roughness: 0.3
        });
        const anchorGeo  = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16);
        this.anchorF     = new THREE.Mesh(anchorGeo, anchorMat);
        this.anchorB     = new THREE.Mesh(anchorGeo, anchorMat);
        this.anchorF.position.set(px, 11.8,  0.8);
        this.anchorB.position.set(px, 11.8, -0.8);
        scene.add(this.anchorF);
        scene.add(this.anchorB);

        this.updateVisuals();
    }

    getPos() {
        return {
            x: this.px + CONFIG.simulation.length * Math.sin(this.angle),
            y: this.py - CONFIG.simulation.length * Math.cos(this.angle),
            z: this.pz
        };
    }

    getVelX()     { return CONFIG.simulation.length * this.omega * Math.cos(this.angle); }
    acceleration(){ return -(CONFIG.simulation.gravity / CONFIG.simulation.length) * Math.sin(this.angle); }

    checkBounds() {
        const pos        = this.getPos();
        const leftBound  = CONFIG.simulation.frameLeft  + CONFIG.simulation.radius + 0.1;
        const rightBound = CONFIG.simulation.frameRight - CONFIG.simulation.radius - 0.1;

        if (pos.x < leftBound) {
            const maxA = Math.asin(Math.max(-1, Math.min(1, (leftBound - this.px) / CONFIG.simulation.length)));
            this.angle = Math.max(this.angle, maxA);
            if (this.omega < 0) this.omega *= -0.2;
        }
        if (pos.x > rightBound) {
            const maxA = Math.asin(Math.max(-1, Math.min(1, (rightBound - this.px) / CONFIG.simulation.length)));
            this.angle = Math.min(this.angle, maxA);
            if (this.omega > 0) this.omega *= -0.2;
        }
        this.angle = Math.max(-SAFE_MAX_ANGLE, Math.min(SAFE_MAX_ANGLE, this.angle));
    }

    updateVisuals() {
        const pos = this.getPos();
        this.mesh.position.set(pos.x, pos.y, pos.z);

        const p1 = this.stringLeft.geometry.attributes.position.array;
        p1[0] = this.px;  p1[1] = 11.8; p1[2] =  0.8;
        p1[3] = pos.x;    p1[4] = pos.y; p1[5] =  pos.z;
        this.stringLeft.geometry.attributes.position.needsUpdate = true;

        const p2 = this.stringRight.geometry.attributes.position.array;
        p2[0] = this.px;  p2[1] = 11.8; p2[2] = -0.8;
        p2[3] = pos.x;    p2[4] = pos.y; p2[5] =  pos.z;
        this.stringRight.geometry.attributes.position.needsUpdate = true;
    }
}

const balls  = [];
const startX = -((CONFIG.simulation.ballCount - 1) * SPACING) / 2;
for (let i = 0; i < CONFIG.simulation.ballCount; i++) {
    balls.push(new Ball(i, startX + i * SPACING));
}

// ═══════════════════════════════════════════════════════════════
// 8. AUDIO SYSTEM
// ═══════════════════════════════════════════════════════════════
let audioCtx = null;

function ensureAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('mousedown', ensureAudioContext, { once: false });

function playCollisionSound(intensity = 1.0) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const vol = Math.min(1.0, Math.max(0.05, intensity));

    const clickBuf  = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++)
        clickData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clickData.length, 12);

    const clickSrc    = audioCtx.createBufferSource();
    clickSrc.buffer   = clickBuf;
    const clickGain   = audioCtx.createGain();
    clickGain.gain.setValueAtTime(vol * 0.9, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    const clickFilter = audioCtx.createBiquadFilter();
    clickFilter.type  = 'highpass';
    clickFilter.frequency.value = 2800;
    clickFilter.Q.value         = 0.8;
    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickSrc.start(now);

    const ringFreq = 820 + Math.random() * 380;
    const osc      = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(ringFreq, now);
    osc.frequency.exponentialRampToValueAtTime(ringFreq * 0.85, now + 0.35);
    const ringGain = audioCtx.createGain();
    ringGain.gain.setValueAtTime(vol * 0.35, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(ringGain);
    ringGain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(ringFreq * 2.76, now);
    osc2.frequency.exponentialRampToValueAtTime(ringFreq * 2.2, now + 0.2);
    const ring2Gain = audioCtx.createGain();
    ring2Gain.gain.setValueAtTime(vol * 0.12, now);
    ring2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(ring2Gain);
    ring2Gain.connect(audioCtx.destination);
    osc2.start(now);
    osc2.stop(now + 0.25);
}

let lastSoundTime = 0;
const MIN_SOUND_INTERVAL = 0.07;

function triggerCollisionSound(relativeVelocity) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastSoundTime < MIN_SOUND_INTERVAL) return;
    if (Math.abs(relativeVelocity) < 0.3) return;
    lastSoundTime = now;
    playCollisionSound(Math.min(1.0, Math.abs(relativeVelocity) / 8.0));
}

// ═══════════════════════════════════════════════════════════════
// 9-A. PHYSICS — RK4 + COLLISION
// ═══════════════════════════════════════════════════════════════
function rk4Step(ball, dt) {
    const k1w = ball.acceleration(),   k1a = ball.omega;
    const a2  = ball.angle + k1a*dt*0.5, w2 = ball.omega + k1w*dt*0.5;
    const k2w = -(CONFIG.simulation.gravity/CONFIG.simulation.length)*Math.sin(a2), k2a = w2;
    const a3  = ball.angle + k2a*dt*0.5, w3 = ball.omega + k2w*dt*0.5;
    const k3w = -(CONFIG.simulation.gravity/CONFIG.simulation.length)*Math.sin(a3), k3a = w3;
    const a4  = ball.angle + k3a*dt,     w4 = ball.omega + k3w*dt;
    const k4w = -(CONFIG.simulation.gravity/CONFIG.simulation.length)*Math.sin(a4), k4a = w4;
    ball.omega += (k1w + 2*k2w + 2*k3w + k4w) * dt / 6;
    ball.angle += (k1a + 2*k2a + 2*k3a + k4a) * dt / 6;
}

function resolveCollisions() {
    for (let iter = 0; iter < CONFIG.simulation.collisionIterations; iter++) {
        let hadCollision = false;
        for (let i = 0; i < CONFIG.simulation.ballCount - 1; i++) {
            const a = balls[i], b = balls[i+1];
            const pA = a.getPos(), pB = b.getPos();
            const dx = pB.x - pA.x, dy = pB.y - pA.y;
            const dist    = Math.sqrt(dx*dx + dy*dy);
            const minDist = 2 * CONFIG.simulation.radius;
            if (dist < minDist * 0.999) {
                hadCollision = true;
                const overlap = minDist - dist;
                const vA = a.getVelX(), vB = b.getVelX();
                if (vB < vA - 0.001) {
                    const cA = Math.cos(a.angle), cB = Math.cos(b.angle);
                    if (Math.abs(cA) > 0.01 && Math.abs(cB) > 0.01) {
                        a.omega = vB / (CONFIG.simulation.length * cA);
                        b.omega = vA / (CONFIG.simulation.length * cB);
                        triggerCollisionSound(vA - vB);
                    }
                }
                const sep = (overlap * 0.505) / CONFIG.simulation.length;
                a.angle -= sep * 0.5;
                b.angle += sep * 0.5;
            }
        }
        if (!hadCollision) break;
    }
}

// ═══════════════════════════════════════════════════════════════
// 9-B. INTERACTION — MOUSE & TOUCH
// ═══════════════════════════════════════════════════════════════
const raycaster    = new THREE.Raycaster();
const mouse        = new THREE.Vector2();
const draggedBalls = new Map();
let isMultiDragging = false;

function updateMouseCoordinates(e) {
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function findBallsUnderCursor() {
    raycaster.setFromCamera(mouse, camera);
    const found = new Set();
    for (const h of raycaster.intersectObjects(scene.children, true))
        if (h.object.userData.isBall) found.add(h.object.userData.ball);
    return found;
}

function handleDragStart() {
    isMultiDragging = true;
    orbitControls.enabled = false;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const grabPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, grabPoint);
    findBallsUnderCursor().forEach(ball => {
        ball.isDragging = true;
        ball.omega = 0;
        const bp = ball.getPos();
        draggedBalls.set(ball, {
            startAngle:  ball.angle,
            grabOffsetX: grabPoint.x - bp.x,
            grabOffsetY: grabPoint.y - bp.y
        });
    });
}

function handleDragMove() {
    if (!isMultiDragging || draggedBalls.size === 0) return;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const cur   = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, cur);
    draggedBalls.forEach((data, ball) => {
        let newAngle = Math.atan2(cur.x - data.grabOffsetX - ball.px,
                                -(cur.y - data.grabOffsetY - ball.py));
        newAngle = Math.max(-SAFE_MAX_ANGLE, Math.min(SAFE_MAX_ANGLE, newAngle));
        ball.angle = newAngle;
        ball.omega = 0;
        ball.updateVisuals();
    });
    const sorted = Array.from(draggedBalls.keys()).sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i+1];
        if (b.idx === a.idx + 1) {
            const dist = Math.hypot(b.getPos().x - a.getPos().x, b.getPos().y - a.getPos().y);
            if (dist < 2 * CONFIG.simulation.radius) {
                const mid = (a.angle + b.angle) / 2;
                const off = Math.asin(Math.min(1, CONFIG.simulation.radius / CONFIG.simulation.length));
                a.angle = mid - off * 0.5;
                b.angle = mid + off * 0.5;
            }
        }
    }
}

function handleDragEnd() {
    if (!isMultiDragging) return;
    draggedBalls.forEach((_, ball) => { ball.isDragging = false; });
    draggedBalls.clear();
    isMultiDragging = false;
    orbitControls.enabled = true;
}

window.addEventListener('mousedown', e => { updateMouseCoordinates(e); if (findBallsUnderCursor().size > 0) handleDragStart(); });
window.addEventListener('mousemove', e => { updateMouseCoordinates(e); handleDragMove(); });
window.addEventListener('mouseup',       handleDragEnd);

// ═══════════════════════════════════════════════════════════════
// 10. MOTION TRAILS
// ═══════════════════════════════════════════════════════════════
let showTrails = false;
const trails   = [];

function createTrail(colorHex) {
    const maxPoints = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat  = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    scene.add(line);
    return { line, positions, maxPoints, count: 0, idx: 0 };
}
for (let i = 0; i < CONFIG.simulation.ballCount; i++) trails.push(createTrail(0x888888));

function updateTrails() {
    trails.forEach((trail, i) => {
        const pos = balls[i].getPos();
        trail.positions[trail.idx*3]   = pos.x;
        trail.positions[trail.idx*3+1] = pos.y;
        trail.positions[trail.idx*3+2] = pos.z;
        trail.idx   = (trail.idx + 1) % trail.maxPoints;
        trail.count = Math.min(trail.count + 1, trail.maxPoints);
        trail.line.geometry.setDrawRange(0, trail.count);
        trail.line.geometry.attributes.position.needsUpdate = true;
    });
}

// ═══════════════════════════════════════════════════════════════
// 11. PHYSICS TICK
// ═══════════════════════════════════════════════════════════════
function physicsStep(dt) {
    const h = (dt * CONFIG.simulation.timeScale) / CONFIG.simulation.subSteps;
    for (let s = 0; s < CONFIG.simulation.subSteps; s++) {
        balls.forEach(b => { if (!b.isDragging) rk4Step(b, h); });
        resolveCollisions();
        balls.forEach(b => {
            if (!b.isDragging) {
                b.checkBounds();
                b.omega *= Math.pow(CONFIG.simulation.damping, h * 60);
            }
            b.updateVisuals();
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// 12. UI CONTROLS
// ═══════════════════════════════════════════════════════════════
let paused = false;

function resetSim() {
    balls.forEach(b => { b.angle = 0; b.omega = 0; b.isDragging = false; b.updateVisuals(); });
    draggedBalls.clear();
    isMultiDragging = false;
    trails.forEach(t => { t.count = 0; t.idx = 0; });
}

function togglePause() {
    paused = !paused;
    const btn = document.getElementById('btnPause');
    if (btn) btn.innerText = paused ? 'start' : 'pause';
}

const btnReset = document.getElementById('btnReset');
const btnPause = document.getElementById('btnPause');
if (btnReset) btnReset.addEventListener('click', resetSim);
if (btnPause) btnPause.addEventListener('click', togglePause);

// ═══════════════════════════════════════════════════════════════
// 13. RENDER LOOP
// ═══════════════════════════════════════════════════════════════
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!paused) {
        physicsStep(dt);
        if (showTrails) updateTrails();
    }
    orbitControls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();