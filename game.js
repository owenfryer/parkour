// Game state
let camera, scene, renderer;
let player = {
    velocity: new THREE.Vector3(),
    onGround: false,
    isSliding: false,
    isSprinting: false,
    isWallRunning: false,
    wallRunSide: 0, // -1 left, 1 right
    wallRunTime: 0,
    height: 1.8,
    slideHeight: 0.8,
    currentHeight: 1.8,
    speed: 12,
    sprintSpeed: 16,
    slideSpeed: 16,
    jumpForce: 12,
    wallJumpForce: 14,
    canWallRun: true,
    slideFriction: 0.7
};

let keys = {};
let mouseLocked = false;
let yaw = 0, pitch = 0;
let obstacles = [];
let walls = [];
let platforms = [];
let ramps = [];

// Third person camera
let cameraDistance = 8;
let playerMesh = null;
let playerPosition = new THREE.Vector3(0, 1.8, 0);

// Pause and Tag game state
let isPaused = false;
let tagGameActive = false;
let playerIsIt = true;
let aiMesh = null;
let aiPosition = new THREE.Vector3(20, 1.8, 20);
let aiVelocity = new THREE.Vector3();
let aiSpeed = 10;
let tagCooldown = 0;
let aiTargetPos = new THREE.Vector3();
let aiChangeTargetTime = 0;

// AI parkour state
let aiIsSliding = false;
let aiSlideTime = 0;
let aiIsWallRunning = false;
let aiWallRunTime = 0;
let aiWallNormal = new THREE.Vector3();
let aiJumpCooldown = 0;
let aiParkourMode = false;
let aiParkourTarget = null;
let aiParkourCooldown = 0;

// Time Trial state
let timeTrialActive = false;
let timeTrialTimer = 0;
let timeTrialLimit = 0;
let currentLevel = null;
let goalMesh = null;

// Level definitions
const levels = [
    {
        name: "Beginner Run",
        description: "Learn the basics - jumps and wall runs",
        timeLimit: 50,
        start: { x: 200, y: 2, z: 0 },
        goal: { x: 248, y: 6, z: 47 },
        goalSize: 2.5
    },
    {
        name: "Ramp Rush",
        description: "Master the ramps",
        timeLimit: 45,
        start: { x: -200, y: 2, z: 0 },
        goal: { x: -200, y: 9, z: 76 },
        goalSize: 2.5
    },
    {
        name: "Wall Master",
        description: "Wall run through the zigzag",
        timeLimit: 35,
        start: { x: 0, y: 2, z: 200 },
        goal: { x: 0, y: 8, z: 285 },
        goalSize: 3
    },
    {
        name: "Sky Jumper",
        description: "Precision jumps in the sky",
        timeLimit: 60,
        start: { x: 0, y: 2, z: -200 },
        goal: { x: 0, y: 13, z: -312 },
        goalSize: 2.5
    },
    {
        name: "Slide Sprint",
        description: "Slide through the tunnels",
        timeLimit: 35,
        start: { x: 180, y: 2, z: 180 },
        goal: { x: 180, y: 5, z: 250 },
        goalSize: 2.5
    },
    {
        name: "Tower Ascent",
        description: "Climb the spiral tower",
        timeLimit: 60,
        start: { x: -180, y: 2, z: 180 },
        goal: { x: -180, y: 25, z: 165 },
        goalSize: 2.5
    },
    {
        name: "Combo Master",
        description: "Use all your skills",
        timeLimit: 55,
        start: { x: 180, y: 2, z: -180 },
        goal: { x: 173, y: 11, z: -60 },
        goalSize: 2.5
    },
    {
        name: "Ultimate Challenge",
        description: "The hardest course - good luck!",
        timeLimit: 100,
        start: { x: 300, y: 2, z: 0 },
        goal: { x: 325, y: 11, z: 123 },
        goalSize: 3
    }
];

const GRAVITY = 25;
const WALL_RUN_GRAVITY = 5;
const MAX_WALL_RUN_TIME = 1.5;
const WALL_RUN_MIN_SPEED = 5;

function init() {
    // Scene - realistic sky
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 250);

    // Camera (third person)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, player.height + 5, 10);

    // Player character mesh
    const playerGeo = new THREE.CapsuleGeometry(0.4, 1, 8, 16);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x3498db });
    playerMesh = new THREE.Mesh(playerGeo, playerMat);
    playerMesh.castShadow = true;
    playerMesh.position.set(0, player.height, 0);
    scene.add(playerMesh);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lighting - realistic sunlight
    const ambientLight = new THREE.AmbientLight(0x6688aa, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(60, 100, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    scene.add(sunLight);

    // Hemisphere light for realistic outdoor feel
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3d, 0.3);
    scene.add(hemiLight);

    createLevel();
    setupControls();

    window.addEventListener('resize', onWindowResize);
}

function createLevel() {
    // Ground - grass/concrete mix
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a5d23,
        roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    platforms.push({ mesh: ground, box: new THREE.Box3().setFromObject(ground) });

    // Realistic Materials
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.85, metalness: 0.1 });
    const concreteDarkMat = new THREE.MeshStandardMaterial({ color: 0x606060, roughness: 0.9, metalness: 0.1 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8, metalness: 0 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7, metalness: 0 });
    const redBrickMat = new THREE.MeshStandardMaterial({ color: 0x9b3b3b, roughness: 0.85, metalness: 0 });
    const whiteConcreteMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.7, metalness: 0.1 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95, metalness: 0 });

    // === CENTRAL PLAZA ===
    createPlatform(0, 0.15, 0, 30, 0.3, 30, asphaltMat);
    createPlatform(0, 1.5, 0, 8, 0.4, 8, concreteMat);
    createPlatform(0, 3.5, 0, 5, 0.4, 5, concreteMat);
    createPlatform(0, 5.5, 0, 3, 0.3, 3, whiteConcreteMat);

    // === RAMP PARK (North) ===
    createRamp(0, 0, 25, 8, 3, 10, Math.PI, concreteMat);
    createRamp(-12, 0, 30, 6, 2.5, 8, Math.PI * 0.8, concreteMat);
    createRamp(12, 0, 30, 6, 2.5, 8, Math.PI * 1.2, concreteMat);
    createPlatform(0, 3, 35, 10, 0.4, 6, concreteDarkMat);
    createRamp(0, 3, 42, 8, 3, 8, Math.PI, concreteMat);
    createPlatform(0, 6, 50, 8, 0.4, 6, concreteMat);

    // Quarter pipes
    createRamp(-20, 0, 35, 10, 4, 8, Math.PI/2, concreteDarkMat);
    createRamp(20, 0, 35, 10, 4, 8, -Math.PI/2, concreteDarkMat);

    // === BUILDING COMPLEX (East) ===
    createWall(40, 5, 0, 2, 10, 25, brickMat);
    createWall(55, 5, 0, 2, 10, 25, brickMat);
    createPlatform(47.5, 3, 0, 13, 0.5, 20, concreteMat);
    createPlatform(47.5, 6, 5, 8, 0.4, 8, concreteMat);
    createRamp(47.5, 0, -10, 6, 3, 8, 0, concreteDarkMat);
    createRamp(47.5, 3, 12, 5, 3, 6, Math.PI, metalMat);

    // === WAREHOUSE (West) ===
    createWall(-40, 6, -5, 2, 12, 30, redBrickMat);
    createWall(-55, 6, -5, 2, 12, 30, redBrickMat);
    createWall(-47.5, 12, -20, 17, 2, 2, metalMat);
    createPlatform(-47.5, 4, 0, 13, 0.5, 25, concreteDarkMat);
    createRamp(-47.5, 0, 15, 8, 4, 10, Math.PI, concreteMat);
    createRamp(-47.5, 4, -12, 6, 3, 8, 0, metalMat);
    createPlatform(-47.5, 7, -18, 8, 0.4, 6, metalMat);

    // === SKATE PARK AREA (South) ===
    createPlatform(0, 0.15, -30, 40, 0.3, 25, asphaltMat);
    createRamp(-15, 0, -25, 8, 2, 6, 0, concreteMat);
    createRamp(15, 0, -25, 8, 2, 6, 0, concreteMat);
    createRamp(0, 0, -40, 10, 3, 8, 0, concreteMat);
    createRamp(-25, 0, -35, 6, 2.5, 6, Math.PI/4, concreteDarkMat);
    createRamp(25, 0, -35, 6, 2.5, 6, -Math.PI/4, concreteDarkMat);

    // Fun box
    createPlatform(0, 1.5, -30, 6, 3, 6, concreteMat);
    createRamp(0, 0, -26, 6, 1.5, 3, Math.PI, concreteDarkMat);
    createRamp(0, 0, -34, 6, 1.5, 3, 0, concreteDarkMat);
    createRamp(-4.5, 0, -30, 6, 1.5, 3, -Math.PI/2, concreteDarkMat);
    createRamp(4.5, 0, -30, 6, 1.5, 3, Math.PI/2, concreteDarkMat);

    // === WALL RUN CORRIDORS ===
    // North-East corridor
    createWall(25, 4, 50, 1, 8, 35, brickMat);
    createWall(33, 4, 50, 1, 8, 35, brickMat);
    createPlatform(29, 5, 70, 6, 0.4, 5, concreteMat);

    // South-West corridor
    createWall(-25, 4, -55, 1, 8, 35, redBrickMat);
    createWall(-33, 4, -55, 1, 8, 35, redBrickMat);
    createPlatform(-29, 5, -75, 6, 0.4, 5, concreteMat);

    // === CONTAINER YARD ===
    // Shipping containers to climb
    createPlatform(70, 1.5, 30, 12, 3, 5, metalMat);
    createPlatform(70, 1.5, 38, 12, 3, 5, new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.4, metalness: 0.7 }));
    createPlatform(70, 4.5, 34, 12, 3, 5, new THREE.MeshStandardMaterial({ color: 0xaa3333, roughness: 0.4, metalness: 0.7 }));
    createPlatform(70, 7.5, 30, 12, 3, 5, new THREE.MeshStandardMaterial({ color: 0x33aa33, roughness: 0.4, metalness: 0.7 }));
    createRamp(60, 0, 30, 5, 3, 8, Math.PI/2, metalMat);

    // === ROOFTOP AREA ===
    createPlatform(-70, 8, 50, 20, 1, 20, concreteMat);
    createWall(-60, 12, 50, 1, 8, 18, brickMat);
    createWall(-80, 12, 50, 1, 8, 18, brickMat);
    createPlatform(-70, 14, 50, 10, 0.4, 10, concreteDarkMat);
    createRamp(-70, 0, 38, 8, 8, 12, Math.PI, concreteMat);

    // === INDUSTRIAL RAMPS ===
    createRamp(80, 0, -20, 10, 5, 15, Math.PI/2, metalMat);
    createRamp(80, 0, -40, 10, 5, 15, Math.PI/2, metalMat);
    createPlatform(90, 5, -30, 8, 0.5, 25, metalMat);
    createRamp(95, 0, -30, 8, 5, 10, -Math.PI/2, metalMat);

    // === PARKOUR TOWERS ===
    // Tower 1
    createPlatform(60, 2, -70, 6, 4, 6, concreteMat);
    createPlatform(60, 5, -70, 5, 2, 5, concreteMat);
    createPlatform(60, 8, -70, 4, 2, 4, concreteMat);
    createPlatform(60, 11, -70, 3, 2, 3, whiteConcreteMat);
    createRamp(54, 0, -70, 4, 2, 6, Math.PI/2, concreteDarkMat);

    // Tower 2
    createPlatform(-60, 2, -70, 6, 4, 6, brickMat);
    createPlatform(-60, 5, -70, 5, 2, 5, brickMat);
    createPlatform(-60, 8, -70, 4, 2, 4, brickMat);
    createRamp(-66, 0, -70, 4, 2, 6, -Math.PI/2, concreteDarkMat);

    // === CONNECTING RAMPS ===
    createRamp(35, 0, -50, 6, 3, 10, Math.PI * 0.75, concreteMat);
    createRamp(-35, 0, 50, 6, 3, 10, -Math.PI * 0.25, concreteMat);
    createRamp(50, 0, 50, 8, 4, 12, Math.PI * 0.6, concreteDarkMat);
    createRamp(-50, 0, -50, 8, 4, 12, -Math.PI * 0.4, concreteDarkMat);

    // === RAIL GRIND LEDGES ===
    createPlatform(10, 0.4, 15, 20, 0.8, 0.8, metalMat);
    createPlatform(-10, 0.4, -15, 20, 0.8, 0.8, metalMat);
    createPlatform(15, 0.4, -10, 0.8, 0.8, 20, metalMat);
    createPlatform(-15, 0.4, 10, 0.8, 0.8, 20, metalMat);

    // === STAIR SETS ===
    for (let i = 0; i < 8; i++) {
        createPlatform(85, i * 0.4 + 0.2, 60 - i * 1.5, 8, 0.4, 1.2, concreteMat);
    }
    for (let i = 0; i < 8; i++) {
        createPlatform(-85, i * 0.4 + 0.2, -60 + i * 1.5, 8, 0.4, 1.2, concreteMat);
    }

    // === SLIDE TUNNEL ===
    createPlatform(0, 0.3, 75, 6, 0.3, 20, asphaltMat);
    createWall(0, 2.2, 75, 6, 0.4, 20, concreteMat);
    createWall(-3.25, 1.25, 75, 0.5, 2, 20, concreteDarkMat);
    createWall(3.25, 1.25, 75, 0.5, 2, 20, concreteDarkMat);

    // === SCATTERED PLATFORMS ===
    createPlatform(30, 1.5, 15, 4, 0.4, 4, woodMat);
    createPlatform(35, 2.5, 20, 3, 0.4, 3, woodMat);
    createPlatform(-30, 1.5, -15, 4, 0.4, 4, woodMat);
    createPlatform(-35, 2.5, -20, 3, 0.4, 3, woodMat);

    // === HALF PIPE ===
    createRamp(-80, 0, 0, 15, 6, 10, Math.PI/2, concreteDarkMat);
    createRamp(-95, 0, 0, 15, 6, 10, -Math.PI/2, concreteDarkMat);
    createPlatform(-87.5, 0.15, 0, 5, 0.3, 15, asphaltMat);

    // === MEGA RAMP ===
    createRamp(100, 0, 50, 12, 10, 25, Math.PI, concreteMat);
    createPlatform(100, 10, 62, 12, 0.5, 8, concreteDarkMat);
    createRamp(100, 10, 70, 12, 5, 10, Math.PI, metalMat);

    // === PYRAMID ===
    createRamp(0, 0, -80, 10, 4, 8, 0, concreteMat);
    createRamp(0, 0, -80, 10, 4, 8, Math.PI, concreteMat);
    createRamp(0, 0, -80, 10, 4, 8, Math.PI/2, concreteMat);
    createRamp(0, 0, -80, 10, 4, 8, -Math.PI/2, concreteMat);
    createPlatform(0, 4, -80, 4, 0.5, 4, whiteConcreteMat);

    // === SCATTERED RAMPS (Far corners) ===
    createRamp(110, 0, -80, 8, 3, 10, Math.PI * 0.25, concreteDarkMat);
    createRamp(120, 0, -70, 8, 3, 10, -Math.PI * 0.25, concreteDarkMat);
    createRamp(-110, 0, 80, 8, 3, 10, Math.PI * 0.75, concreteDarkMat);
    createRamp(-120, 0, 70, 8, 3, 10, -Math.PI * 0.75, concreteDarkMat);

    // === OBSTACLE COURSE (Northeast) ===
    createRamp(90, 0, 80, 6, 2, 8, Math.PI, concreteMat);
    createPlatform(90, 2, 88, 5, 0.4, 4, concreteMat);
    createRamp(90, 2, 93, 5, 2, 6, Math.PI, metalMat);
    createPlatform(90, 4, 100, 4, 0.4, 4, metalMat);
    createPlatform(85, 4, 105, 3, 0.4, 3, woodMat);
    createPlatform(80, 4, 110, 3, 0.4, 3, woodMat);
    createRamp(75, 0, 110, 4, 4, 8, -Math.PI/2, concreteDarkMat);

    // === SPINE RAMP ===
    createRamp(-100, 0, -40, 10, 5, 10, 0, concreteMat);
    createRamp(-100, 0, -40, 10, 5, 10, Math.PI, concreteMat);
    createPlatform(-100, 5, -40, 10, 0.4, 2, metalMat);

    // === LAUNCH RAMPS ===
    createRamp(50, 0, -90, 6, 2.5, 8, 0, metalMat);
    createRamp(-50, 0, 90, 6, 2.5, 8, Math.PI, metalMat);
    createRamp(70, 0, 90, 6, 2.5, 8, -Math.PI/4, metalMat);
    createRamp(-70, 0, -90, 6, 2.5, 8, Math.PI * 0.75, metalMat);

    // === WAVE RAMPS ===
    for (let i = 0; i < 5; i++) {
        createRamp(-120 + i * 12, 0, 30, 5, 2, 6, Math.PI, concreteMat);
        createRamp(-120 + i * 12, 0, 30, 5, 2, 6, 0, concreteMat);
    }

    // === ZIGZAG RAMPS ===
    createRamp(110, 0, 0, 6, 3, 8, Math.PI * 0.3, concreteDarkMat);
    createPlatform(118, 3, 5, 4, 0.4, 4, concreteMat);
    createRamp(125, 0, 10, 6, 3, 8, Math.PI * 0.7, concreteDarkMat);
    createPlatform(130, 3, 18, 4, 0.4, 4, concreteMat);
    createRamp(125, 0, 25, 6, 3, 8, Math.PI * 0.3, concreteDarkMat);

    // === BOWL AREA ===
    createRamp(-30, 0, 100, 8, 3, 8, 0, concreteDarkMat);
    createRamp(-30, 0, 100, 8, 3, 8, Math.PI, concreteDarkMat);
    createRamp(-30, 0, 100, 8, 3, 8, Math.PI/2, concreteDarkMat);
    createRamp(-30, 0, 100, 8, 3, 8, -Math.PI/2, concreteDarkMat);
    createRamp(-22, 0, 100, 6, 2, 6, -Math.PI/2, concreteMat);
    createRamp(-38, 0, 100, 6, 2, 6, Math.PI/2, concreteMat);

    // === KICKER RAMPS ===
    createRamp(20, 0, 60, 4, 1.5, 4, Math.PI, metalMat);
    createRamp(-20, 0, 60, 4, 1.5, 4, Math.PI, metalMat);
    createRamp(20, 0, 70, 4, 1.5, 4, 0, metalMat);
    createRamp(-20, 0, 70, 4, 1.5, 4, 0, metalMat);

    // === DISTANT PLATFORMS WITH RAMPS ===
    createPlatform(130, 2, -50, 10, 4, 10, brickMat);
    createRamp(125, 0, -45, 5, 2, 6, Math.PI * 0.5, concreteMat);
    createPlatform(-130, 2, 50, 10, 4, 10, brickMat);
    createRamp(-125, 0, 45, 5, 2, 6, -Math.PI * 0.5, concreteMat);

    // === STEPS WITH RAMPS ===
    createPlatform(100, 1, -100, 15, 2, 8, concreteMat);
    createPlatform(100, 2.5, -108, 15, 2, 8, concreteMat);
    createPlatform(100, 4, -116, 15, 2, 8, concreteMat);
    createRamp(100, 0, -92, 8, 1, 6, 0, concreteDarkMat);
    createRamp(100, 4, -124, 8, 4, 10, Math.PI, concreteDarkMat);

    // === MINI RAMPS SCATTERED ===
    createRamp(40, 0, 40, 4, 1, 5, Math.PI * 0.5, woodMat);
    createRamp(-40, 0, -40, 4, 1, 5, -Math.PI * 0.5, woodMat);
    createRamp(55, 0, -35, 4, 1, 5, Math.PI * 0.25, woodMat);
    createRamp(-55, 0, 35, 4, 1, 5, -Math.PI * 0.25, woodMat);

    // ============================================
    // TIME TRIAL COURSES
    // ============================================

    const courseMat = new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.6 });
    const courseAccent = new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.5 });
    const courseRed = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.5 });
    const courseGreen = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.5 });

    // === COURSE 1: BEGINNER RUN (East far) ===
    // Start platform
    createPlatform(200, 0.5, 0, 8, 1, 8, courseGreen);
    // Stepping stones
    createPlatform(210, 1, 0, 3, 0.4, 3, courseMat);
    createPlatform(218, 1.5, 3, 3, 0.4, 3, courseMat);
    createPlatform(226, 2, -1, 3, 0.4, 3, courseMat);
    createPlatform(234, 2.5, -4, 3, 0.4, 3, courseMat);
    // Ramp up
    createRamp(242, 0, -4, 5, 3, 8, -Math.PI/2, courseMat);
    createPlatform(248, 3, -4, 6, 0.4, 6, courseMat);
    // Wall run section
    createWall(252, 4, -4, 1, 8, 20, courseMat);
    createPlatform(248, 5, 11, 4, 0.4, 4, courseAccent);
    // Final jumps
    createPlatform(248, 5, 22, 3, 0.4, 3, courseMat);
    createPlatform(248, 5, 34, 3, 0.4, 3, courseMat);
    createPlatform(248, 5, 47, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 2: RAMP RUSH (West far) ===
    createPlatform(-200, 0.5, 0, 8, 1, 8, courseGreen);
    createRamp(-200, 0, 8, 6, 2, 6, Math.PI, courseMat);
    createPlatform(-200, 2, 16, 5, 0.4, 5, courseMat);
    createRamp(-200, 2, 22, 5, 2, 6, Math.PI, courseMat);
    createPlatform(-200, 4, 30, 5, 0.4, 5, courseMat);
    // Side ramps
    createRamp(-194, 4, 30, 4, 2, 5, -Math.PI/2, courseAccent);
    createPlatform(-188, 6, 30, 4, 0.4, 4, courseMat);
    createRamp(-188, 6, 36, 4, 2, 5, Math.PI, courseMat);
    createPlatform(-188, 8, 43, 4, 0.4, 4, courseMat);
    // Jump gaps
    createPlatform(-195, 8, 52, 3, 0.4, 3, courseMat);
    createPlatform(-200, 8, 63, 3, 0.4, 3, courseMat);
    createPlatform(-200, 8, 76, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 3: WALL MASTER (North far) ===
    createPlatform(0, 0.5, 200, 8, 1, 8, courseGreen);
    // Corridor with walls
    createWall(-4, 4, 215, 1, 8, 20, courseMat);
    createWall(4, 4, 215, 1, 8, 20, courseMat);
    createPlatform(0, 6, 228, 4, 0.4, 4, courseMat);
    // Zigzag walls
    createWall(8, 5, 235, 1, 10, 12, courseAccent);
    createPlatform(4, 7, 243, 3, 0.4, 3, courseMat);
    createWall(-4, 5, 250, 1, 10, 12, courseAccent);
    createPlatform(-2, 7, 258, 3, 0.4, 3, courseMat);
    createWall(6, 5, 265, 1, 10, 12, courseAccent);
    createPlatform(3, 7, 273, 3, 0.4, 3, courseMat);
    // Final platform
    createPlatform(0, 7, 285, 6, 0.4, 6, courseRed); // Goal

    // === COURSE 4: SKY JUMPER (South far) ===
    createPlatform(0, 0.5, -200, 8, 1, 8, courseGreen);
    createRamp(0, 0, -208, 6, 4, 8, 0, courseMat);
    createPlatform(0, 4, -215, 4, 0.4, 4, courseMat);
    // Floating platforms (increasing gaps)
    createPlatform(0, 5, -224, 3, 0.4, 3, courseMat);
    createPlatform(5, 6, -235, 2.5, 0.4, 2.5, courseMat);
    createPlatform(-3, 7, -247, 2.5, 0.4, 2.5, courseMat);
    createPlatform(4, 8, -260, 2, 0.4, 2, courseAccent);
    createPlatform(-5, 9, -274, 2, 0.4, 2, courseAccent);
    createPlatform(0, 10, -289, 2, 0.4, 2, courseAccent);
    // Final stretch
    createRamp(0, 10, -300, 4, 2, 6, 0, courseMat);
    createPlatform(0, 12, -312, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 5: SLIDE SPRINT (Northeast) ===
    createPlatform(180, 0.5, 180, 8, 1, 8, courseGreen);
    // Slide tunnels
    createPlatform(180, 0.3, 195, 4, 0.3, 20, courseMat);
    createWall(177.5, 1.2, 195, 0.5, 2, 20, courseMat);
    createWall(182.5, 1.2, 195, 0.5, 2, 20, courseMat);
    createPlatform(180, 2.5, 195, 5, 0.3, 20, courseMat);
    // Exit and jump
    createRamp(180, 0, 210, 5, 3, 6, Math.PI, courseAccent);
    createPlatform(180, 3, 218, 4, 0.4, 4, courseMat);
    // More slides
    createPlatform(180, 2.8, 230, 4, 0.3, 15, courseMat);
    createWall(177.5, 4, 230, 0.5, 2, 15, courseMat);
    createWall(182.5, 4, 230, 0.5, 2, 15, courseMat);
    createRamp(180, 2.5, 242, 4, 2, 5, Math.PI, courseMat);
    createPlatform(180, 4.5, 250, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 6: TOWER ASCENT (Northwest) ===
    createPlatform(-180, 0.5, 180, 10, 1, 10, courseGreen);
    // Spiral tower
    createPlatform(-175, 2, 185, 4, 0.4, 4, courseMat);
    createPlatform(-170, 4, 180, 4, 0.4, 4, courseMat);
    createPlatform(-175, 6, 175, 4, 0.4, 4, courseMat);
    createPlatform(-180, 8, 180, 4, 0.4, 4, courseMat);
    createPlatform(-185, 10, 185, 4, 0.4, 4, courseAccent);
    createPlatform(-180, 12, 190, 4, 0.4, 4, courseMat);
    createPlatform(-175, 14, 185, 4, 0.4, 4, courseMat);
    createPlatform(-180, 16, 180, 4, 0.4, 4, courseMat);
    // Wall runs at top
    createWall(-185, 18, 180, 1, 6, 15, courseAccent);
    createPlatform(-180, 20, 172, 4, 0.4, 4, courseMat);
    createWall(-175, 22, 172, 1, 6, 15, courseAccent);
    createPlatform(-180, 24, 165, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 7: COMBO MASTER (Southeast) ===
    createPlatform(180, 0.5, -180, 8, 1, 8, courseGreen);
    // Ramp start
    createRamp(180, 0, -172, 5, 2, 6, Math.PI, courseMat);
    createPlatform(180, 2, -164, 4, 0.4, 4, courseMat);
    // Wall run corridor
    createWall(176, 4, -150, 1, 8, 25, courseMat);
    createWall(184, 4, -150, 1, 8, 25, courseMat);
    createPlatform(180, 5, -135, 3, 0.4, 3, courseAccent);
    // Platform jumps
    createPlatform(187, 6, -125, 3, 0.4, 3, courseMat);
    createPlatform(180, 7, -114, 3, 0.4, 3, courseMat);
    createPlatform(173, 8, -103, 3, 0.4, 3, courseMat);
    // Slide section
    createRamp(173, 8, -95, 4, 0, 8, Math.PI, courseMat);
    createPlatform(173, 7.5, -83, 4, 0.3, 12, courseMat);
    // Final ramp
    createRamp(173, 7, -70, 5, 3, 6, Math.PI, courseAccent);
    createPlatform(173, 10, -60, 5, 0.4, 5, courseRed); // Goal

    // === COURSE 8: ULTIMATE CHALLENGE (Far far east) ===
    createPlatform(300, 0.5, 0, 10, 1, 10, courseGreen);
    // Section 1: Precision jumps
    createPlatform(312, 1, 0, 2, 0.4, 2, courseMat);
    createPlatform(322, 1.5, 4, 2, 0.4, 2, courseMat);
    createPlatform(333, 2, -2, 2, 0.4, 2, courseMat);
    createPlatform(344, 2.5, -5, 2, 0.4, 2, courseMat);
    createPlatform(356, 3, 0, 3, 0.4, 3, courseAccent);
    // Section 2: Ramp gauntlet
    createRamp(364, 0, 0, 4, 3, 8, -Math.PI/2, courseMat);
    createPlatform(370, 3, 0, 4, 0.4, 4, courseMat);
    createRamp(370, 3, 6, 4, 2, 5, Math.PI, courseMat);
    createPlatform(370, 5, 13, 4, 0.4, 4, courseMat);
    createRamp(370, 5, 19, 4, 2, 5, Math.PI, courseAccent);
    createPlatform(370, 7, 26, 4, 0.4, 4, courseMat);
    // Section 3: Wall run madness
    createWall(374, 8, 40, 1, 10, 25, courseMat);
    createPlatform(370, 10, 55, 3, 0.4, 3, courseMat);
    createWall(366, 11, 65, 1, 10, 15, courseAccent);
    createPlatform(370, 13, 75, 3, 0.4, 3, courseMat);
    createWall(374, 14, 85, 1, 10, 15, courseMat);
    createPlatform(370, 16, 95, 4, 0.4, 4, courseAccent);
    // Section 4: Final stretch
    createPlatform(362, 16, 105, 3, 0.4, 3, courseMat);
    createPlatform(352, 15, 114, 3, 0.4, 3, courseMat);
    createPlatform(342, 14, 123, 3, 0.4, 3, courseMat);
    createRamp(332, 10, 123, 5, 4, 8, Math.PI/2, courseMat);
    createPlatform(325, 10, 123, 6, 0.4, 6, courseRed); // Goal
}

function createRamp(x, y, z, width, height, depth, rotation, material) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(0, height);
    shape.closePath();

    const extrudeSettings = { depth: width, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI / 2);
    geo.translate(-width / 2, 0, -depth / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Store ramp data for slope collision
    ramps.push({
        mesh,
        x, y, z,
        width, height, depth,
        rotation
    });

    return mesh;
}

function createWall(x, y, z, w, h, d, material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    walls.push({ mesh, box, normal: new THREE.Vector3() });
    obstacles.push({ mesh, box });

    return mesh;
}

function createPlatform(x, y, z, w, h, d, material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    platforms.push({ mesh, box });
    obstacles.push({ mesh, box });

    return mesh;
}

function setupControls() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        // Toggle sprint on shift press
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            player.isSprinting = !player.isSprinting;
        }
        // Toggle pause menu on Q
        if (e.code === 'KeyQ') {
            togglePause();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (mouseLocked) {
            yaw -= e.movementX * 0.002;
            pitch -= e.movementY * 0.002;
            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        }
    });

    document.addEventListener('pointerlockchange', () => {
        mouseLocked = document.pointerLockElement === renderer.domElement;
    });

    renderer.domElement.addEventListener('click', () => {
        if (!mouseLocked) {
            renderer.domElement.requestPointerLock();
        }
    });

    // Zoom with scroll wheel
    document.addEventListener('wheel', (e) => {
        if (mouseLocked) {
            camera.fov += e.deltaY * 0.05;
            camera.fov = Math.max(30, Math.min(120, camera.fov)); // Clamp FOV
            camera.updateProjectionMatrix();
        }
    });
}

function update(delta) {
    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));

    // Input
    if (keys['KeyW']) moveDirection.add(forward);
    if (keys['KeyS']) moveDirection.sub(forward);
    if (keys['KeyD']) moveDirection.sub(right);
    if (keys['KeyA']) moveDirection.add(right);


    // Sliding
    const wantsToSlide = keys['KeyE'];
    const isMoving = moveDirection.length() > 0;

    if (wantsToSlide && isMoving && player.onGround && !player.isSliding) {
        player.isSliding = true;
        player.slideStartVelocity = player.velocity.clone();
        player.currentSlideSpeed = player.slideSpeed; // Start at max slide speed
    } else if (!wantsToSlide || !isMoving) {
        player.isSliding = false;
    }

    // Decay slide speed towards walking speed
    if (player.isSliding && player.currentSlideSpeed > player.speed) {
        player.currentSlideSpeed -= delta * 8; // Decay rate
        if (player.currentSlideSpeed < player.speed) {
            player.currentSlideSpeed = player.speed;
        }
    }

    // Calculate speed
    let currentSpeed = player.speed;
    if (player.isSliding) {
        currentSpeed = player.currentSlideSpeed || player.speed;
    } else if (player.isSprinting) {
        currentSpeed = player.sprintSpeed;
    }

    // Adjust height for sliding
    const targetHeight = player.isSliding ? player.slideHeight : player.height;
    player.currentHeight += (targetHeight - player.currentHeight) * 10 * delta;

    // Movement
    if (moveDirection.length() > 0) {
        moveDirection.normalize();

        if (player.onGround || player.isWallRunning) {
            player.velocity.x = moveDirection.x * currentSpeed;
            player.velocity.z = moveDirection.z * currentSpeed;
        } else {
            // Air control
            player.velocity.x += moveDirection.x * currentSpeed * 0.1;
            player.velocity.z += moveDirection.z * currentSpeed * 0.1;

            // Clamp air speed
            const horizontalVel = new THREE.Vector2(player.velocity.x, player.velocity.z);
            if (horizontalVel.length() > currentSpeed) {
                horizontalVel.normalize().multiplyScalar(currentSpeed);
                player.velocity.x = horizontalVel.x;
                player.velocity.z = horizontalVel.y;
            }
        }
    } else if (player.onGround) {
        // MASSIVE Friction - you stop FAST
        player.velocity.x *= 0.2;
        player.velocity.z *= 0.2;
    } else {
        // Air friction - but not during slide boost!
        if (player.slideBoostTime > 0) {
            player.slideBoostTime -= delta;
            // Minimal friction during boost
            player.velocity.x *= 0.99;
            player.velocity.z *= 0.99;
        } else {
            player.velocity.x *= 0.88;
            player.velocity.z *= 0.88;
        }
    }

    // Wall running detection
    checkWallRun(delta, forward, right);

    // Gravity
    if (!player.onGround) {
        const gravityForce = player.isWallRunning ? WALL_RUN_GRAVITY : GRAVITY;
        player.velocity.y -= gravityForce * delta;
    }

    // Jumping
    if (keys['Space']) {
        if (player.onGround) {
            // Slide jump boost - big speed boost!
            if (player.isSliding) {
                // Get direction and apply fixed high speed
                const currentDir = new THREE.Vector2(player.velocity.x, player.velocity.z);
                if (currentDir.length() > 0) {
                    currentDir.normalize();
                    const boostSpeed = 20; // Fast!
                    player.velocity.x = currentDir.x * boostSpeed;
                    player.velocity.z = currentDir.y * boostSpeed;
                }
                player.velocity.y = player.jumpForce * 1.4;
                player.isSliding = false;
                player.slideBoostTime = 0.8; // Preserve momentum for a bit
            } else {
                player.velocity.y = player.jumpForce;
            }
            player.onGround = false;
            keys['Space'] = false;
        } else if (player.isWallRunning) {
            // Wall jump
            const wallJumpDir = right.clone().multiplyScalar(-player.wallRunSide);
            player.velocity.x = wallJumpDir.x * 8 + forward.x * 5;
            player.velocity.z = wallJumpDir.z * 8 + forward.z * 5;
            player.velocity.y = player.wallJumpForce;
            player.isWallRunning = false;
            player.wallRunTime = 0;
            player.canWallRun = false;
            keys['Space'] = false;
            setTimeout(() => { player.canWallRun = true; }, 300);
        }
    }

    // Apply velocity with substeps to prevent clipping
    const speed = player.velocity.length();
    const substeps = Math.max(1, Math.ceil(speed * delta / 0.5));
    const subDelta = delta / substeps;

    for (let i = 0; i < substeps; i++) {
        const movement = player.velocity.clone().multiplyScalar(subDelta);
        camera.position.add(movement);
        checkCollisions();
    }

    // Update camera rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // Camera tilt for wall running
    let targetTilt = 0;
    if (player.isWallRunning) {
        targetTilt = player.wallRunSide * 0.15;
    }
    camera.rotation.z += (targetTilt - camera.rotation.z) * 5 * delta;

    // Update HUD
    updateHUD();
}

function checkWallRun(delta, forward, right) {
    if (!player.canWallRun || player.onGround) {
        player.isWallRunning = false;
        player.wallRunTime = 0;
        return;
    }

    const horizontalSpeed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);

    if (horizontalSpeed < WALL_RUN_MIN_SPEED) {
        player.isWallRunning = false;
        player.wallRunTime = 0;
        return;
    }

    // Check for walls on left and right - use multiple ray heights
    const rayLength = 1.5;
    const raycaster = new THREE.Raycaster();

    // All surfaces we can wall run on (walls + obstacles + ramps)
    const allMeshes = [
        ...walls.map(w => w.mesh),
        ...obstacles.map(o => o.mesh),
        ...ramps.map(r => r.mesh)
    ];

    // Cast rays at multiple heights for better detection
    const rayHeights = [0, -0.5, -1.0];
    let rightHit = null;
    let leftHit = null;

    for (const heightOffset of rayHeights) {
        const playerPos = camera.position.clone();
        playerPos.y += heightOffset;

        // Check right wall
        if (!rightHit) {
            raycaster.set(playerPos, right);
            const intersects = raycaster.intersectObjects(allMeshes);
            if (intersects.length > 0 && intersects[0].distance < rayLength) {
                rightHit = intersects[0];
            }
        }

        // Check left wall
        if (!leftHit) {
            raycaster.set(playerPos, right.clone().negate());
            const intersects = raycaster.intersectObjects(allMeshes);
            if (intersects.length > 0 && intersects[0].distance < rayLength) {
                leftHit = intersects[0];
            }
        }
    }

    if (rightHit && player.velocity.y < 5) {
        player.isWallRunning = true;
        player.wallRunSide = 1;
        player.wallRunTime += delta;

        // Keep player at wall
        if (rightHit.distance < 1.2) {
            camera.position.x -= right.x * (1.2 - rightHit.distance) * 0.3;
            camera.position.z -= right.z * (1.2 - rightHit.distance) * 0.3;
        }

        // Reduce vertical velocity while wall running
        if (player.velocity.y < 0) {
            player.velocity.y *= 0.92;
        }
    } else if (leftHit && player.velocity.y < 5) {
        player.isWallRunning = true;
        player.wallRunSide = -1;
        player.wallRunTime += delta;

        // Keep player at wall
        if (leftHit.distance < 1.2) {
            camera.position.x += right.x * (1.2 - leftHit.distance) * 0.3;
            camera.position.z += right.z * (1.2 - leftHit.distance) * 0.3;
        }

        // Reduce vertical velocity while wall running
        if (player.velocity.y < 0) {
            player.velocity.y *= 0.92;
        }
    } else {
        player.isWallRunning = false;
        player.wallRunTime = 0;
    }

    // End wall run after max time
    if (player.wallRunTime > MAX_WALL_RUN_TIME) {
        player.isWallRunning = false;
        player.wallRunTime = 0;
    }
}

function checkCollisions() {
    const playerRadius = 0.5;
    const feetY = camera.position.y - player.currentHeight;
    const headY = camera.position.y + 0.2;

    player.onGround = false;

    // Create player bounding box
    const playerMin = new THREE.Vector3(
        camera.position.x - playerRadius,
        feetY,
        camera.position.z - playerRadius
    );
    const playerMax = new THREE.Vector3(
        camera.position.x + playerRadius,
        headY,
        camera.position.z + playerRadius
    );

    // Check all obstacles (multiple passes for stability)
    for (let pass = 0; pass < 3; pass++) {
        // Update player bounds
        playerMin.set(
            camera.position.x - playerRadius,
            camera.position.y - player.currentHeight,
            camera.position.z - playerRadius
        );
        playerMax.set(
            camera.position.x + playerRadius,
            camera.position.y + 0.2,
            camera.position.z + playerRadius
        );

        for (const obstacle of obstacles) {
            const box = obstacle.box;

            // Check AABB overlap
            if (playerMax.x > box.min.x && playerMin.x < box.max.x &&
                playerMax.y > box.min.y && playerMin.y < box.max.y &&
                playerMax.z > box.min.z && playerMin.z < box.max.z) {

                // Calculate overlap on each axis
                const overlapX1 = playerMax.x - box.min.x;
                const overlapX2 = box.max.x - playerMin.x;
                const overlapY1 = playerMax.y - box.min.y;
                const overlapY2 = box.max.y - playerMin.y;
                const overlapZ1 = playerMax.z - box.min.z;
                const overlapZ2 = box.max.z - playerMin.z;

                const overlapX = Math.min(overlapX1, overlapX2);
                const overlapY = Math.min(overlapY1, overlapY2);
                const overlapZ = Math.min(overlapZ1, overlapZ2);

                // Push out along the axis with smallest overlap
                if (overlapY < overlapX && overlapY < overlapZ) {
                    // Vertical collision
                    if (overlapY1 < overlapY2) {
                        // Hit from below
                        camera.position.y = box.min.y - 0.2;
                        if (player.velocity.y > 0) player.velocity.y = 0;
                    } else {
                        // Landing on top
                        camera.position.y = box.max.y + player.currentHeight;
                        if (player.velocity.y < 0) player.velocity.y = 0;
                        player.onGround = true;
                    }
                } else if (overlapX < overlapZ) {
                    // X-axis collision
                    if (overlapX1 < overlapX2) {
                        camera.position.x = box.min.x - playerRadius - 0.01;
                    } else {
                        camera.position.x = box.max.x + playerRadius + 0.01;
                    }
                    player.velocity.x = 0;
                } else {
                    // Z-axis collision
                    if (overlapZ1 < overlapZ2) {
                        camera.position.z = box.min.z - playerRadius - 0.01;
                    } else {
                        camera.position.z = box.max.z + playerRadius + 0.01;
                    }
                    player.velocity.z = 0;
                }
            }
        }
    }

    // Ramp collision (raycast to detect slope)
    if (ramps.length > 0) {
        const rampMeshes = ramps.map(r => r.mesh);
        const raycaster = new THREE.Raycaster();

        // Downward ray for walking on ramps
        const rayStart = new THREE.Vector3(
            camera.position.x,
            camera.position.y,
            camera.position.z
        );
        raycaster.set(rayStart, new THREE.Vector3(0, -1, 0));
        raycaster.far = player.currentHeight + 2;

        const downIntersects = raycaster.intersectObjects(rampMeshes);
        if (downIntersects.length > 0) {
            const hit = downIntersects[0];
            const groundY = hit.point.y + player.currentHeight;

            if (camera.position.y <= groundY + 0.1) {
                camera.position.y = groundY;
                if (player.velocity.y < 0) player.velocity.y = 0;
                player.onGround = true;
            }
        }

        // Horizontal rays for side collision
        const feetPos = new THREE.Vector3(
            camera.position.x,
            camera.position.y - player.currentHeight + 0.3,
            camera.position.z
        );
        const midPos = new THREE.Vector3(
            camera.position.x,
            camera.position.y - player.currentHeight / 2,
            camera.position.z
        );

        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        for (const dir of directions) {
            // Check at feet level
            raycaster.set(feetPos, dir);
            raycaster.far = playerRadius + 0.1;
            let intersects = raycaster.intersectObjects(rampMeshes);

            if (intersects.length === 0) {
                // Check at mid level
                raycaster.set(midPos, dir);
                intersects = raycaster.intersectObjects(rampMeshes);
            }

            if (intersects.length > 0 && intersects[0].distance < playerRadius + 0.05) {
                const pushBack = playerRadius + 0.05 - intersects[0].distance;
                camera.position.x -= dir.x * pushBack;
                camera.position.z -= dir.z * pushBack;

                // Stop velocity in that direction
                if (dir.x !== 0) player.velocity.x = 0;
                if (dir.z !== 0) player.velocity.z = 0;
            }
        }
    }

    // Ground check (main ground plane)
    if (camera.position.y < player.currentHeight) {
        camera.position.y = player.currentHeight;
        player.velocity.y = 0;
        player.onGround = true;
    }

    // Reset if fallen
    if (camera.position.y < -10) {
        camera.position.set(0, player.height, 0);
        player.velocity.set(0, 0, 0);
    }
}

function updateHUD() {
    const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
    const maxDisplaySpeed = 20;
    const speedPercent = Math.min(speed / maxDisplaySpeed * 100, 100);

    document.getElementById('speedfill').style.width = speedPercent + '%';

    let status = '';
    if (player.isWallRunning) {
        status = 'WALL RUN';
        document.getElementById('status').style.color = '#9b59b6';
    } else if (player.isSliding) {
        status = 'SLIDING';
        document.getElementById('status').style.color = '#27ae60';
    } else if (player.isSprinting && speed > 1) {
        status = 'SPRINTING';
        document.getElementById('status').style.color = '#e67e22';
    } else if (!player.onGround) {
        status = 'AIRBORNE';
        document.getElementById('status').style.color = '#3498db';
    }

    document.getElementById('status').textContent = status;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (!isPaused && mouseLocked) {
        update(delta);
        updateAI(delta);
        updateTimeTrial(delta);
    }

    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    isPaused = false;
    renderer.domElement.requestPointerLock();
}

function togglePause() {
    if (document.getElementById('instructions').style.display !== 'none') return;

    isPaused = !isPaused;
    if (isPaused) {
        document.exitPointerLock();
        document.getElementById('pauseMenu').style.display = 'block';
        document.getElementById('crosshair').style.display = 'none';
    } else {
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
        renderer.domElement.requestPointerLock();
    }
}

function resumeGame() {
    isPaused = false;
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    renderer.domElement.requestPointerLock();
}

function backToTitle() {
    // Stop tag game if active
    if (tagGameActive) {
        stopTagGame();
    }
    // Stop time trial if active
    if (timeTrialActive) {
        exitLevel();
    }

    // Hide pause menu, show title screen
    isPaused = true;
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('instructions').style.display = 'block';
    document.exitPointerLock();
}

function showLevelSelect() {
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('levelSelect').style.display = 'block';

    // Populate level list
    const levelList = document.getElementById('levelList');
    levelList.innerHTML = '';
    levels.forEach((level, index) => {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerHTML = `${level.name}<span class="time">${level.timeLimit}s</span><br><small style="color:#aaa">${level.description}</small>`;
        btn.onclick = () => startLevel(index);
        levelList.appendChild(btn);
    });
}

function hideLevelSelect() {
    document.getElementById('levelSelect').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'block';
}

function startLevel(index) {
    currentLevel = levels[index];
    timeTrialActive = true;
    timeTrialTimer = 0;
    timeTrialLimit = currentLevel.timeLimit;

    // Hide menus
    document.getElementById('levelSelect').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';

    // Teleport player to start
    camera.position.set(currentLevel.start.x, currentLevel.start.y, currentLevel.start.z);
    player.velocity.set(0, 0, 0);
    yaw = 0;
    pitch = 0;

    // Create goal marker
    if (goalMesh) {
        scene.remove(goalMesh);
    }
    const goalGeo = new THREE.CylinderGeometry(currentLevel.goalSize, currentLevel.goalSize, 0.3, 32);
    const goalMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
    });
    goalMesh = new THREE.Mesh(goalGeo, goalMat);
    goalMesh.position.set(currentLevel.goal.x, currentLevel.goal.y, currentLevel.goal.z);
    scene.add(goalMesh);

    // Show timer
    document.getElementById('timerDisplay').style.display = 'block';
    document.getElementById('timerDisplay').className = '';
    updateTimerDisplay();

    // Resume game
    isPaused = false;
    document.getElementById('crosshair').style.display = 'block';
    renderer.domElement.requestPointerLock();
}

function updateTimerDisplay() {
    const remaining = Math.max(0, timeTrialLimit - timeTrialTimer);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    const ms = Math.floor((remaining % 1) * 100);
    document.getElementById('timerDisplay').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    // Warning when low on time
    if (remaining <= 5 && remaining > 0) {
        document.getElementById('timerDisplay').className = 'warning';
    }
}

function updateTimeTrial(delta) {
    if (!timeTrialActive) return;

    timeTrialTimer += delta;
    updateTimerDisplay();

    // Animate goal
    if (goalMesh) {
        goalMesh.rotation.y += delta * 2;
        goalMesh.position.y = currentLevel.goal.y + Math.sin(Date.now() * 0.003) * 0.3;
    }

    // Check if reached goal
    const distToGoal = camera.position.distanceTo(
        new THREE.Vector3(currentLevel.goal.x, currentLevel.goal.y, currentLevel.goal.z)
    );
    if (distToGoal < currentLevel.goalSize + 1) {
        levelSuccess();
        return;
    }

    // Check if time ran out
    if (timeTrialTimer >= timeTrialLimit) {
        levelFailed();
    }
}

function levelSuccess() {
    timeTrialActive = false;
    isPaused = true;
    document.exitPointerLock();

    const finalTime = timeTrialTimer.toFixed(2);
    document.getElementById('levelResultTitle').textContent = 'LEVEL COMPLETE!';
    document.getElementById('levelResultTime').textContent = `Time: ${finalTime}s`;
    document.getElementById('levelComplete').className = 'success';
    document.getElementById('levelComplete').style.display = 'block';
    document.getElementById('timerDisplay').style.display = 'none';
    document.getElementById('crosshair').style.display = 'none';
}

function levelFailed() {
    timeTrialActive = false;
    isPaused = true;
    document.exitPointerLock();

    document.getElementById('levelResultTitle').textContent = 'TIME\'S UP!';
    document.getElementById('levelResultTime').textContent = 'You ran out of time';
    document.getElementById('levelComplete').className = 'failure';
    document.getElementById('levelComplete').style.display = 'block';
    document.getElementById('timerDisplay').style.display = 'none';
    document.getElementById('crosshair').style.display = 'none';
}

function restartLevel() {
    document.getElementById('levelComplete').style.display = 'none';
    const index = levels.indexOf(currentLevel);
    startLevel(index);
}

function exitLevel() {
    timeTrialActive = false;
    currentLevel = null;

    if (goalMesh) {
        scene.remove(goalMesh);
        goalMesh = null;
    }

    document.getElementById('levelComplete').style.display = 'none';
    document.getElementById('timerDisplay').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'block';

    // Reset player position
    camera.position.set(0, 2, 0);
    player.velocity.set(0, 0, 0);
}

function createAI() {
    // Create AI character (a capsule shape using cylinder + spheres for r128 compatibility)
    const bodyMat = new THREE.MeshStandardMaterial({
        color: playerIsIt ? 0x2ecc71 : 0xe74c3c,
        roughness: 0.5
    });

    // Create a group to hold the capsule parts
    aiMesh = new THREE.Group();

    // Cylinder body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    aiMesh.add(body);

    // Top sphere
    const sphereGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const topSphere = new THREE.Mesh(sphereGeo, bodyMat);
    topSphere.position.y = 0.6;
    topSphere.castShadow = true;
    aiMesh.add(topSphere);

    // Bottom sphere
    const bottomSphere = new THREE.Mesh(sphereGeo, bodyMat);
    bottomSphere.position.y = -0.6;
    bottomSphere.castShadow = true;
    aiMesh.add(bottomSphere);

    aiMesh.position.copy(aiPosition);
    scene.add(aiMesh);

    // Add eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.4, 0.3);
    aiMesh.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.4, 0.3);
    aiMesh.add(rightEye);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, 0.06);
    leftEye.add(leftPupil);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0, 0, 0.06);
    rightEye.add(rightPupil);
}

function startTagGame() {
    tagGameActive = true;
    playerIsIt = Math.random() > 0.5;
    tagCooldown = 3;

    // Spawn AI away from player
    aiPosition.set(
        camera.position.x + (Math.random() - 0.5) * 40,
        1.8,
        camera.position.z + (Math.random() - 0.5) * 40
    );
    aiVelocity.set(0, 0, 0);

    if (!aiMesh) {
        createAI();
    } else {
        aiMesh.visible = true;
        setAIColor(playerIsIt ? 0x2ecc71 : 0xe74c3c);
    }

    updateTagUI();
    document.getElementById('tagStatus').style.display = 'block';
    document.getElementById('tagBtn').style.display = 'none';
    document.getElementById('stopTagBtn').style.display = 'block';

    resumeGame();
}

function stopTagGame() {
    tagGameActive = false;
    if (aiMesh) {
        aiMesh.visible = false;
    }
    document.getElementById('tagStatus').style.display = 'none';
    document.getElementById('tagBtn').style.display = 'block';
    document.getElementById('stopTagBtn').style.display = 'none';
}

function setAIColor(hex) {
    if (!aiMesh) return;
    aiMesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.color) {
            child.material.color.setHex(hex);
        }
    });
}

function updateTagUI() {
    const tagStatus = document.getElementById('tagStatus');
    if (playerIsIt) {
        tagStatus.textContent = "YOU'RE IT! Chase the AI!";
        tagStatus.className = 'it';
        setAIColor(0x2ecc71);
    } else {
        tagStatus.textContent = "RUN! The AI is chasing you!";
        tagStatus.className = 'notit';
        setAIColor(0xe74c3c);
    }
}

function updateAI(delta) {
    if (!tagGameActive || !aiMesh) return;

    // Update cooldowns
    if (tagCooldown > 0) tagCooldown -= delta;
    if (aiJumpCooldown > 0) aiJumpCooldown -= delta;
    if (aiParkourCooldown > 0) aiParkourCooldown -= delta;

    const playerPos = camera.position.clone();
    const distToPlayer = aiPosition.distanceTo(playerPos);
    const aiOnGround = aiPosition.y <= 1.85;

    // Update slide timer
    if (aiIsSliding) {
        aiSlideTime -= delta;
        if (aiSlideTime <= 0) {
            aiIsSliding = false;
        }
    }

    // Update wall run timer
    if (aiIsWallRunning) {
        aiWallRunTime += delta;
        if (aiWallRunTime > MAX_WALL_RUN_TIME) {
            aiIsWallRunning = false;
            aiWallRunTime = 0;
            // Wall jump off
            aiVelocity.y = 12;
            aiVelocity.x += aiWallNormal.x * 8;
            aiVelocity.z += aiWallNormal.z * 8;
            aiParkourCooldown = 2;
        }
    }

    // Decide to do parkour randomly
    if (!aiParkourMode && aiOnGround && aiParkourCooldown <= 0 && Math.random() < 0.02) {
        aiParkourTarget = findParkourTarget();
        if (aiParkourTarget) {
            aiParkourMode = true;
        }
    }

    // Parkour mode - go to wall/platform and do moves
    if (aiParkourMode && aiParkourTarget) {
        const targetPos = aiParkourTarget.position.clone();
        const distToTarget = aiPosition.distanceTo(targetPos);

        if (distToTarget < 3) {
            // Reached target - jump at it!
            if (aiOnGround && aiJumpCooldown <= 0) {
                aiVelocity.y = 14;
                aiJumpCooldown = 0.5;
                // Jump towards the wall/platform
                const jumpDir = targetPos.clone().sub(aiPosition).normalize();
                aiVelocity.x = jumpDir.x * 10;
                aiVelocity.z = jumpDir.z * 10;
            }
            aiParkourMode = false;
            aiParkourTarget = null;
            aiParkourCooldown = 3;
        } else if (distToTarget > 50) {
            // Too far, cancel
            aiParkourMode = false;
            aiParkourTarget = null;
        } else {
            // Run towards parkour target
            aiTargetPos.copy(targetPos);
            aiSpeed = 14;

            // Do a slide approach
            if (distToTarget < 8 && distToTarget > 4 && aiOnGround && !aiIsSliding && Math.random() < 0.05) {
                aiIsSliding = true;
                aiSlideTime = 0.5;
            }
        }
    }
    // Normal behavior when not in parkour mode
    else if (playerIsIt) {
        // AI runs away from player
        aiChangeTargetTime -= delta;
        if (aiChangeTargetTime <= 0 || aiTargetPos.distanceTo(aiPosition) < 3) {
            const escapeDir = aiPosition.clone().sub(playerPos).normalize();
            const randomAngle = (Math.random() - 0.5) * Math.PI;
            escapeDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);
            aiTargetPos.copy(aiPosition).add(escapeDir.multiplyScalar(30 + Math.random() * 20));
            aiTargetPos.y = 1.8;
            aiTargetPos.x = Math.max(-140, Math.min(140, aiTargetPos.x));
            aiTargetPos.z = Math.max(-140, Math.min(140, aiTargetPos.z));
            aiChangeTargetTime = 2 + Math.random() * 2;
        }

        // If player is close, panic mode - run faster, maybe slide or jump
        if (distToPlayer < 15) {
            const escapeDir = aiPosition.clone().sub(playerPos).normalize();
            aiTargetPos.copy(aiPosition).add(escapeDir.multiplyScalar(30));
            aiSpeed = aiIsSliding ? 18 : 14;

            // Slide to escape when player is very close
            if (distToPlayer < 8 && aiOnGround && !aiIsSliding && Math.random() < 0.03) {
                aiIsSliding = true;
                aiSlideTime = 0.8;
            }

            // Jump to escape
            if (aiOnGround && !aiIsSliding && aiJumpCooldown <= 0 && Math.random() < 0.04) {
                aiVelocity.y = 12;
                aiJumpCooldown = 1.5;
            }
        } else {
            aiSpeed = 10;

            // Random parkour jumps when not being chased closely
            if (aiOnGround && aiJumpCooldown <= 0 && Math.random() < 0.015) {
                aiVelocity.y = 10 + Math.random() * 4;
                aiJumpCooldown = 2;
            }

            // Random slides for fun
            if (aiOnGround && !aiIsSliding && Math.random() < 0.01) {
                aiIsSliding = true;
                aiSlideTime = 0.6;
            }
        }
    } else {
        // AI chases player
        aiTargetPos.copy(playerPos);
        aiSpeed = aiIsSliding ? 18 : 14;

        // Slide attack when close
        if (distToPlayer < 10 && distToPlayer > 3 && aiOnGround && !aiIsSliding && Math.random() < 0.02) {
            aiIsSliding = true;
            aiSlideTime = 0.6;
        }

        // Jump to chase or show off
        if (aiOnGround && !aiIsSliding && aiJumpCooldown <= 0 && Math.random() < 0.04) {
            aiVelocity.y = 11;
            aiJumpCooldown = 1.2;
        }
    }

    // Move AI towards target
    const moveDir = aiTargetPos.clone().sub(aiPosition);
    moveDir.y = 0;
    if (moveDir.length() > 0.5) {
        moveDir.normalize();
        aiVelocity.x = moveDir.x * aiSpeed;
        aiVelocity.z = moveDir.z * aiSpeed;
    }

    // Check for wall running (only when in air and moving fast)
    if (!aiOnGround && !aiIsWallRunning) {
        const horizontalSpeed = Math.sqrt(aiVelocity.x * aiVelocity.x + aiVelocity.z * aiVelocity.z);
        if (horizontalSpeed > 5) {
            checkAIWallRun();
        }
    }

    // Apply gravity (reduced during wall run)
    const gravityForce = aiIsWallRunning ? WALL_RUN_GRAVITY : GRAVITY;
    aiVelocity.y -= gravityForce * delta;

    // Move AI
    aiPosition.add(aiVelocity.clone().multiplyScalar(delta));

    // Ground collision
    if (aiPosition.y < 1.8) {
        aiPosition.y = 1.8;
        aiVelocity.y = 0;
        aiIsWallRunning = false;
        aiWallRunTime = 0;
    }

    // Keep AI in bounds
    aiPosition.x = Math.max(-145, Math.min(145, aiPosition.x));
    aiPosition.z = Math.max(-145, Math.min(145, aiPosition.z));

    // Update mesh position and rotation
    aiMesh.position.copy(aiPosition);

    // Face movement direction
    if (aiVelocity.x !== 0 || aiVelocity.z !== 0) {
        aiMesh.rotation.y = Math.atan2(aiVelocity.x, aiVelocity.z);
    }

    // Visual effects for parkour moves
    let targetScaleY = 1;
    let targetTilt = 0;
    if (aiIsSliding) {
        targetScaleY = 0.5; // Crouch down
    }
    if (aiIsWallRunning) {
        targetTilt = 0.3; // Tilt during wall run
    }
    aiMesh.scale.y += (targetScaleY - aiMesh.scale.y) * 10 * delta;
    aiMesh.rotation.z += (targetTilt - aiMesh.rotation.z) * 5 * delta;

    // Check for tag
    if (tagCooldown <= 0 && distToPlayer < 2) {
        playerIsIt = !playerIsIt;
        tagCooldown = 2;
        updateTagUI();

        const pushDir = aiPosition.clone().sub(playerPos).normalize();
        if (playerIsIt) {
            aiPosition.add(pushDir.multiplyScalar(5));
        } else {
            aiVelocity.y = 8;
            aiPosition.add(pushDir.multiplyScalar(5));
        }
    }
}

function checkAIWallRun() {
    // Cast rays to detect walls
    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    const raycaster = new THREE.Raycaster();
    raycaster.far = 1.5;

    for (const dir of directions) {
        raycaster.set(aiPosition, dir);
        const intersects = raycaster.intersectObjects(walls.map(w => w.mesh));

        if (intersects.length > 0 && intersects[0].distance < 1.2) {
            aiIsWallRunning = true;
            aiWallNormal.copy(dir).negate();
            aiVelocity.y = Math.max(aiVelocity.y, 2); // Boost up slightly
            return;
        }
    }
}

function findParkourTarget() {
    // Find nearby walls or platforms to do parkour on
    let bestTarget = null;
    let bestDist = Infinity;
    const maxRange = 40;
    const minRange = 5;

    // Check walls
    for (const wall of walls) {
        const wallPos = wall.mesh.position.clone();
        const dist = aiPosition.distanceTo(wallPos);

        if (dist > minRange && dist < maxRange && dist < bestDist) {
            // Prefer walls that are roughly in the direction we're moving
            bestDist = dist;
            bestTarget = { position: wallPos, type: 'wall' };
        }
    }

    // Check platforms (obstacles that are elevated)
    for (const obs of obstacles) {
        const obsPos = obs.mesh.position.clone();
        const dist = aiPosition.distanceTo(obsPos);

        // Only target platforms that are elevated (good for jumping on)
        if (obsPos.y > 1 && dist > minRange && dist < maxRange) {
            if (!bestTarget || Math.random() < 0.3) {
                bestTarget = { position: obsPos, type: 'platform' };
                bestDist = dist;
            }
        }
    }

    return bestTarget;
}

init();
animate(0);
