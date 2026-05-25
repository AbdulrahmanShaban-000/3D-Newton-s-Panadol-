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
        frameLeft: -6.5,
        frameRight: 6.5
    },
    colors: {
        studioBg:       0xdcdcdc,
        // ✅ FIX #1: كان 0xaa6aa88 (7 أرقام خاطئ) → صحيح الآن
        ambient:        0x334455,   // إضاءة محيطية هادئة مزرقة قليلاً
        keyLight:       0xffffff,
        fillLight:      0x4466aa,   // أزرق ناعم
        // ✅ FIX #2: لون الكرات → رمادي فولاذي دافئ بدلاً من الأسود الشديد
        steelChrome:    0x888888,
        structuralSteel:0x888899,
        baseWood:       0x150d0a,
        string:         0x999999,
        // ✅ FIX #3: لون احتياطي للجدران → بني دافئ
        wallFallback:   0x7a4a2a
    }
};

// ✅ FIX #4: SPACING = 2.0 بالضبط لضمان تلامس الكرات بصرياً (كان 2.005)
const SPACING = CONFIG.simulation.radius * 2.0;
const MAX_ANGLE = Math.asin(Math.min(
    (CONFIG.simulation.frameRight - (CONFIG.simulation.ballCount - 1) * SPACING / 2 - CONFIG.simulation.radius)
    / CONFIG.simulation.length, 0.999));
const SAFE_MAX_ANGLE = Math.min(MAX_ANGLE * 0.9, Math.PI / 2.2);

// ═══════════════════════════════════════════════════════════════
// 2. CORE SETUP
// ═══════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.studioBg);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6, 17);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// ✅ FIX #5: تقليل التعرض من 1.1 إلى 0.85 لتجنب الإشراق الزائد
renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.minDistance = 8;
orbitControls.maxDistance = 28;
orbitControls.target.set(0, 4.5, 0);

// ═══════════════════════════════════════════════════════════════
// 3. TEXTURE LOADING
// ═══════════════════════════════════════════════════════════════
const textureLoader = new THREE.TextureLoader();

const bricksTexture = textureLoader.load('textures/ram.png',
    // onLoad: التكستشر وُجد
    undefined,
    // onError: التكستشر فشل → سيظهر اللون الاحتياطي البني
    (err) => console.warn('bricks texture not found, using fallback color', err)
);
if (bricksTexture.image) {
    bricksTexture.wrapS = THREE.RepeatWrapping;
    bricksTexture.wrapT = THREE.RepeatWrapping;
    bricksTexture.repeat.set(6, 4);
}
bricksTexture.wrapS = THREE.RepeatWrapping;
bricksTexture.wrapT = THREE.RepeatWrapping;
bricksTexture.repeat.set(6, 4);

const poliTexture = textureLoader.load('textures/poli.png',
    undefined,
    (err) => console.warn('poli texture not found', err)
);

// تكستشر الحديد لأطراف البندول (أعمدة + عوارض + روابط) فقط — بدون القاعدة
const ironTexture = textureLoader.load('textures/iron.png',
    (tex) => {
        // تكرار النمط على طول الأسطوانات
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 4);
    },
    undefined,
    (err) => console.warn('iron texture not found', err)
);

// ═══════════════════════════════════════════════════════════════
// 4. LIGHTING — مصادر ضوء متوازنة بدون إشراق
// ═══════════════════════════════════════════════════════════════
function initLighting() {
    // ✅ FIX #6: شدة الإضاءة المحيطية من 0.7 إلى 0.45
    const ambient = new THREE.AmbientLight(CONFIG.colors.ambient, 0.45);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(CONFIG.colors.keyLight, 1.4);
    keyLight.position.set(8, 16, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 45;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.normalBias = 0.015;
    scene.add(keyLight);

    // ✅ FIX #7: شدة ضوء الملء من 0.9 إلى 0.5
    const fillLight = new THREE.DirectionalLight(CONFIG.colors.fillLight, 0.5);
    fillLight.position.set(-8, 10, -4);
    scene.add(fillLight);

    // ✅ FIX #8: حُذف floorLight (كان يسبب إشراق من الأسفل غير واقعي)
}

// ═══════════════════════════════════════════════════════════════
// 5. ENVIRONMENT MAP — أقل بياضاً وسطوعاً
// ═══════════════════════════════════════════════════════════════
function generateEnvironmentMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // ✅ FIX #9: تدرج رمادي داكن بدلاً من الأبيض الناصع
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#aabbcc');   // أعلى: رمادي مزرق ناعم
    grad.addColorStop(0.5, '#778899'); // وسط: رمادي متوسط
    grad.addColorStop(1, '#445566');   // أسفل: داكن
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // بقع ضوء خافتة بدل الأبيض الكامل
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(200, 50, 120, 160);
    ctx.fillRect(700, 80, 100, 120);

    const envTex = new THREE.CanvasTexture(canvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;
}

initLighting();
generateEnvironmentMap();

// ═══════════════════════════════════════════════════════════════
// 6. FRAME & WALLS
// ═══════════════════════════════════════════════════════════════
function createFrame() {
    const frameGroup = new THREE.Group();

    // مادة المعدن مع تكستشر iron.png → للأعمدة والعوارض والروابط فقط
    const metalMat = new THREE.MeshStandardMaterial({
        map: ironTexture,                       // ← تكستشر الحديد
        color: new THREE.Color(CONFIG.colors.structuralSteel),
        metalness: 0.92,
        roughness: 0.25,
        envMapIntensity: 1.0
    });
    const woodMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.baseWood,
        metalness: 0.1,
        roughness: 0.6
    });

    // ✅ FIX #10: الجدران → MeshStandardMaterial مع لون بني احتياطي واضح
    // إن وُجدت صورة التكستشر ظهرت، وإن غابت ظهر البني الدافئ
    const wallMat = new THREE.MeshStandardMaterial({
        map: bricksTexture,
        color: new THREE.Color(CONFIG.colors.wallFallback), // بني دافئ احتياطي
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.BackSide,
        // ✅ عدم تأثر الجدار بالإضاءة العاكسة
        envMapIntensity: 0.0
    });

    const roomGeo = new THREE.BoxGeometry(45, 25, 35);
    const surroundingRoom = new THREE.Mesh(roomGeo, wallMat);
    surroundingRoom.position.set(0, 12, 0);
    surroundingRoom.receiveShadow = true;
    scene.add(surroundingRoom);

    [-6.5, 6.5].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 12, 32), metalMat);
        pillar.position.set(x, 6, 0);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        frameGroup.add(pillar);
    });

    const zOffsets = [-0.8, 0.8];
    zOffsets.forEach(z => {
        const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 13.6, 32);
        const beam = new THREE.Mesh(beamGeo, metalMat);
        beam.rotation.z = Math.PI / 2;
        beam.position.set(0, 11.8, z);
        beam.castShadow = true;
        frameGroup.add(beam);
    });

    [-6.5, 6.5].forEach(x => {
        const connector = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.8), metalMat);
        connector.position.set(x, 11.8, 0);
        frameGroup.add(connector);
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.6, 5.0), woodMat);
    base.position.set(0, 0.3, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    frameGroup.add(base);

    scene.add(frameGroup);
}
createFrame();

// ═══════════════════════════════════════════════════════════════
// 7. BALL CLASS — مواد واقعية بدون توهج فضائي
// ═══════════════════════════════════════════════════════════════
class Ball {
    constructor(idx, px) {
        this.idx = idx;
        this.px = px;
        this.py = CONFIG.simulation.pivotY;
        this.pz = 0;
        this.angle = 0;
        this.omega = 0;
        this.isDragging = false;

        // ✅ FIX #11: مادة الكرات — فولاذ مصقول واقعي بدون توهج
        // - metalness: 0.9 (معدني لكن ليس مبالغاً)
        // - roughness: 0.2 (ناعم لكن يعكس بشكل طبيعي)
        // - clearcoat: 0.2 (طبقة لمعة خفيفة فقط)
        // - envMapIntensity: 0.8 (انعكاس معتدل وليس مبهراً)
        const ballMat = new THREE.MeshPhysicalMaterial({
            map: poliTexture,
            color: new THREE.Color(CONFIG.colors.steelChrome),
            metalness: 0.9,
            roughness: 0.2,
            clearcoat: 0.2,           // ✅ كان 1.0 → الآن 0.2
            clearcoatRoughness: 0.1,
            reflectivity: 0.8,
            envMapIntensity: 0.8,     // ✅ كان 2.0 → الآن 0.8
        });

        const geo = new THREE.SphereGeometry(CONFIG.simulation.radius, 64, 64);
        this.mesh = new THREE.Mesh(geo, ballMat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData = { ball: this, isBall: true };
        scene.add(this.mesh);

        const stringMat = new THREE.LineBasicMaterial({
            color: CONFIG.colors.string,
            transparent: true,
            opacity: 0.75,
            linewidth: 1
        });

        const lineGeo1 = new THREE.BufferGeometry().setAttribute(
            'position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const lineGeo2 = new THREE.BufferGeometry().setAttribute(
            'position', new THREE.BufferAttribute(new Float32Array(6), 3));

        this.stringLeft  = new THREE.Line(lineGeo1, stringMat);
        this.stringRight = new THREE.Line(lineGeo2, stringMat);
        scene.add(this.stringLeft);
        scene.add(this.stringRight);

        const anchorMat = new THREE.MeshStandardMaterial({
            map: ironTexture,                   // ← نفس تكستشر الحديد على نقاط التعليق
            color: new THREE.Color(0x777788),
            metalness: 0.88,
            roughness: 0.3
        });
        const anchorGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16);
        this.anchorF = new THREE.Mesh(anchorGeo, anchorMat);
        this.anchorB = new THREE.Mesh(anchorGeo, anchorMat);
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

    getVelX() {
        return CONFIG.simulation.length * this.omega * Math.cos(this.angle);
    }

    acceleration() {
        return -(CONFIG.simulation.gravity / CONFIG.simulation.length) * Math.sin(this.angle);
    }

    checkBounds() {
        const pos = this.getPos();
        const leftBound  = CONFIG.simulation.frameLeft  + CONFIG.simulation.radius + 0.1;
        const rightBound = CONFIG.simulation.frameRight - CONFIG.simulation.radius - 0.1;

        if (pos.x < leftBound) {
            const maxAngleCalc = Math.asin(Math.max(-1, Math.min(1,
                (leftBound - this.px) / CONFIG.simulation.length)));
            this.angle = Math.max(this.angle, maxAngleCalc);
            if (this.omega < 0) this.omega *= -0.2;
        }
        if (pos.x > rightBound) {
            const maxAngleCalc = Math.asin(Math.max(-1, Math.min(1,
                (rightBound - this.px) / CONFIG.simulation.length)));
            this.angle = Math.min(this.angle, maxAngleCalc);
            if (this.omega > 0) this.omega *= -0.2;
        }

        this.angle = Math.max(-SAFE_MAX_ANGLE, Math.min(SAFE_MAX_ANGLE, this.angle));
    }

    updateVisuals() {
        const pos = this.getPos();
        this.mesh.position.set(pos.x, pos.y, pos.z);

        const p1 = this.stringLeft.geometry.attributes.position.array;
        p1[0] = this.px; p1[1] = 11.8; p1[2] =  0.8;
        p1[3] = pos.x;   p1[4] = pos.y; p1[5] =  pos.z;
        this.stringLeft.geometry.attributes.position.needsUpdate = true;

        const p2 = this.stringRight.geometry.attributes.position.array;
        p2[0] = this.px; p2[1] = 11.8; p2[2] = -0.8;
        p2[3] = pos.x;   p2[4] = pos.y; p2[5] =  pos.z;
        this.stringRight.geometry.attributes.position.needsUpdate = true;
    }
}

const balls = [];
const startX = -((CONFIG.simulation.ballCount - 1) * SPACING) / 2;
for (let i = 0; i < CONFIG.simulation.ballCount; i++) {
    balls.push(new Ball(i, startX + i * SPACING));
}

// ═══════════════════════════════════════════════════════════════
// 8. AUDIO SYSTEM — صوت تصادم واقعي بالـ Web Audio API
// ═══════════════════════════════════════════════════════════════
let audioCtx = null;

// تهيئة AudioContext عند أول تفاعل من المستخدم (متطلب المتصفح)
function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}
document.addEventListener('mousedown', ensureAudioContext, { once: false });

/**
 * يُشغّل صوت ارتطام معدني واقعي
 * @param {number} intensity - شدة الارتطام (0.0 → 1.0)
 */
function playCollisionSound(intensity = 1.0) {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const vol = Math.min(1.0, Math.max(0.05, intensity));

    // ── طبقة 1: نقرة معدنية حادة (impact click) ──────────────────
    const clickBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) {
        // ضوضاء متناقصة بسرعة تُشبه ارتطام المعدن
        clickData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clickData.length, 12);
    }
    const clickSrc = audioCtx.createBufferSource();
    clickSrc.buffer = clickBuf;

    const clickGain = audioCtx.createGain();
    clickGain.gain.setValueAtTime(vol * 0.9, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    // فلتر عالي التردد → يُعطي طابع المعدن
    const clickFilter = audioCtx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 2800;
    clickFilter.Q.value = 0.8;

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickSrc.start(now);

    // ── طبقة 2: رنين معدني (metallic ring) ──────────────────────
    // تردد أساسي لكرة فولاذية ~800-1200 Hz
    const ringFreq = 820 + Math.random() * 380;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(ringFreq, now);
    // تناقص طفيف في التردد يُشبه اهتزاز المعدن
    osc.frequency.exponentialRampToValueAtTime(ringFreq * 0.85, now + 0.35);

    const ringGain = audioCtx.createGain();
    ringGain.gain.setValueAtTime(vol * 0.35, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(ringGain);
    ringGain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // ── طبقة 3: هارمونيك ثاني (يُضيف ثراءً للصوت) ────────────────
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

// حماية من تكرار الصوت المتتالي السريع
let lastSoundTime = 0;
const MIN_SOUND_INTERVAL = 0.07; // ثانية

function triggerCollisionSound(relativeVelocity) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastSoundTime < MIN_SOUND_INTERVAL) return;
    // الحد الأدنى للسرعة النسبية لتشغيل الصوت (تجاهل اللمسات الخفيفة جداً)
    if (Math.abs(relativeVelocity) < 0.3) return;
    lastSoundTime = now;
    const intensity = Math.min(1.0, Math.abs(relativeVelocity) / 8.0);
    playCollisionSound(intensity);
}

// ═══════════════════════════════════════════════════════════════
// 9‑A. PHYSICS — RK4 + COLLISION
// ═══════════════════════════════════════════════════════════════
function rk4Step(ball, dt) {
    const k1_omega = ball.acceleration();
    const k1_angle = ball.omega;

    const angle2 = ball.angle + k1_angle * dt * 0.5;
    const omega2  = ball.omega + k1_omega * dt * 0.5;
    const k2_omega = -(CONFIG.simulation.gravity / CONFIG.simulation.length) * Math.sin(angle2);
    const k2_angle = omega2;

    const angle3 = ball.angle + k2_angle * dt * 0.5;
    const omega3  = ball.omega + k2_omega * dt * 0.5;
    const k3_omega = -(CONFIG.simulation.gravity / CONFIG.simulation.length) * Math.sin(angle3);
    const k3_angle = omega3;

    const angle4 = ball.angle + k3_angle * dt;
    const omega4  = ball.omega + k3_omega * dt;
    const k4_omega = -(CONFIG.simulation.gravity / CONFIG.simulation.length) * Math.sin(angle4);
    const k4_angle = omega4;

    ball.omega += (k1_omega + 2*k2_omega + 2*k3_omega + k4_omega) * dt / 6;
    ball.angle += (k1_angle + 2*k2_angle + 2*k3_angle + k4_angle) * dt / 6;
}

function resolveCollisions() {
    for (let iter = 0; iter < CONFIG.simulation.collisionIterations; iter++) {
        let hadCollision = false;

        for (let i = 0; i < CONFIG.simulation.ballCount - 1; i++) {
            const a = balls[i];
            const b = balls[i + 1];

            const posA = a.getPos();
            const posB = b.getPos();
            const dx   = posB.x - posA.x;
            const dy   = posB.y - posA.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = 2 * CONFIG.simulation.radius;

            if (dist < minDist * 0.999) {
                hadCollision = true;
                const overlap = minDist - dist;
                const vA = a.getVelX();
                const vB = b.getVelX();

                if (vB < vA - 0.001) {
                    const cosA = Math.cos(a.angle);
                    const cosB = Math.cos(b.angle);
                    if (Math.abs(cosA) > 0.01 && Math.abs(cosB) > 0.01) {
                        a.omega = vB / (CONFIG.simulation.length * cosA);
                        b.omega = vA / (CONFIG.simulation.length * cosB);
                        // ✅ تشغيل صوت الارتطام بشدة تتناسب مع الفرق في السرعة
                        triggerCollisionSound(vA - vB);
                    }
                }

                const sepAngle = (overlap * 0.505) / CONFIG.simulation.length;
                a.angle -= sepAngle * 0.5;
                b.angle += sepAngle * 0.5;
            }
        }
        if (!hadCollision) break;
    }
}

// ═══════════════════════════════════════════════════════════════
// 9. INTERACTION — MOUSE & TOUCH
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const draggedBalls = new Map();
let isMultiDragging = false;

function updateMouseCoordinates(e) {
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function findBallsUnderCursor() {
    raycaster.setFromCamera(mouse, camera);
    const hits  = raycaster.intersectObjects(scene.children, true);
    const found = new Set();
    for (const h of hits) {
        if (h.object.userData.isBall) found.add(h.object.userData.ball);
    }
    return found;
}

function handleDragStart() {
    isMultiDragging = true;
    orbitControls.enabled = false;

    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const grabPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, grabPoint);

    const found = findBallsUnderCursor();
    found.forEach(ball => {
        ball.isDragging = true;
        ball.omega = 0;
        const ballPos = ball.getPos();
        draggedBalls.set(ball, {
            startAngle: ball.angle,
            grabOffsetX: grabPoint.x - ballPos.x,
            grabOffsetY: grabPoint.y - ballPos.y
        });
    });
}

function handleDragMove() {
    if (!isMultiDragging || draggedBalls.size === 0) return;

    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const currentPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, currentPoint);

    draggedBalls.forEach((data, ball) => {
        const targetX = currentPoint.x - data.grabOffsetX;
        const targetY = currentPoint.y - data.grabOffsetY;
        let newAngle = Math.atan2(targetX - ball.px, -(targetY - ball.py));
        newAngle = Math.max(-SAFE_MAX_ANGLE, Math.min(SAFE_MAX_ANGLE, newAngle));
        ball.angle = newAngle;
        ball.omega = 0;
        ball.updateVisuals();
    });

    const sorted = Array.from(draggedBalls.keys()).sort((a, b) => a.idx - b.idx);
    for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i+1];
        if (b.idx === a.idx + 1) {
            const posA = a.getPos(), posB = b.getPos();
            const dist = Math.hypot(posB.x - posA.x, posB.y - posA.y);
            if (dist < 2 * CONFIG.simulation.radius) {
                const mid    = (a.angle + b.angle) / 2;
                const offset = Math.asin(Math.min(1, CONFIG.simulation.radius / CONFIG.simulation.length));
                a.angle = mid - offset * 0.5;
                b.angle = mid + offset * 0.5;
            }
        }
    }
}

function handleDragEnd() {
    if (isMultiDragging) {
        draggedBalls.forEach((_, ball) => { ball.isDragging = false; });
        draggedBalls.clear();
        isMultiDragging = false;
        orbitControls.enabled = true;
    }
}

window.addEventListener('mousedown', e => {
    updateMouseCoordinates(e);
    if (findBallsUnderCursor().size > 0) handleDragStart();
});
window.addEventListener('mousemove', e => {
    updateMouseCoordinates(e);
    handleDragMove();
});
window.addEventListener('mouseup', handleDragEnd);

// ═══════════════════════════════════════════════════════════════
// 10. MOTION TRAILS
// ═══════════════════════════════════════════════════════════════
let showTrails = false;
const trails = [];

function createTrail(colorHex) {
    const maxPoints = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.35, linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    scene.add(line);
    return { line, positions, maxPoints, count: 0, idx: 0 };
}

for (let i = 0; i < CONFIG.simulation.ballCount; i++) {
    trails.push(createTrail(0x888888));
}

function updateTrails() {
    trails.forEach((trail, i) => {
        const pos = balls[i].getPos();
        const arr = trail.positions;
        arr[trail.idx*3]   = pos.x;
        arr[trail.idx*3+1] = pos.y;
        arr[trail.idx*3+2] = pos.z;
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
    const scaledDt = dt * CONFIG.simulation.timeScale;
    const h = scaledDt / CONFIG.simulation.subSteps;
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
    if (btn) btn.innerText = paused ? 'تشغيل' : 'إيقاف مؤقت';
}

function toggleTrails() {
    showTrails = !showTrails;
    trails.forEach(t => t.line.visible = showTrails);
}

const btnReset  = document.getElementById('btnReset');
const btnPause  = document.getElementById('btnPause');
const btnTrails = document.getElementById('btnTrails');
if (btnReset)  btnReset.addEventListener('click', resetSim);
if (btnPause)  btnPause.addEventListener('click', togglePause);
if (btnTrails) btnTrails.addEventListener('click', toggleTrails);

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