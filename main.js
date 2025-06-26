import * as THREE from 'three';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Place the camera just above the grass layer (y=2 is grass, so y=3.5 is just above)
camera.position.set(10, 3.5, 10); // Centered and just above the 20x20 map

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#webgl') });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(15, 20, 10);
scene.add(directionalLight);

// --- WORLD GENERATION ---
const worldWidth = 20, worldDepth = 20, worldHeight = 3;
const voxels = new Uint8Array(worldWidth * worldHeight * worldDepth); // 1 = dirt, 2 = grass, 0 = air

// Flat terrain: 2 layers of dirt, 1 layer of grass
for (let x = 0; x < worldWidth; x++) {
    for (let z = 0; z < worldDepth; z++) {
        setVoxel(x, 0, z, 1); // dirt
        setVoxel(x, 1, z, 1); // dirt
        setVoxel(x, 2, z, 2); // grass
    }
}

function getVoxel(x, y, z) {
    if (x < 0 || x >= worldWidth || y < 0 || y >= worldHeight || z < 0 || z >= worldDepth) {
        return 0;
    }
    return voxels[y * worldWidth * worldDepth + z * worldWidth + x];
}

function setVoxel(x, y, z, value) {
    voxels[y * worldWidth * worldDepth + z * worldWidth + x] = value;
}

// Create meshes for the voxels
const geometry = new THREE.BoxGeometry(1, 1, 1);
const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x966F33 }); // Brown
const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x3cb043 }); // Green

const meshes = {}; // To store meshes for easy removal
for (let x = 0; x < worldWidth; x++) {
    for (let z = 0; z < worldDepth; z++) {
        for (let y = 0; y < worldHeight; y++) {
            if (getVoxel(x, y, z)) {
                addVoxelMesh(x, y, z);
            }
        }
    }
}

function addVoxelMesh(x, y, z) {
    let material;
    if (getVoxel(x, y, z) === 2) {
        material = grassMaterial;
    } else {
        material = dirtMaterial;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(mesh);
    meshes[`${x},${y},${z}`] = mesh;
}

function removeVoxelMesh(x, y, z) {
    const mesh = meshes[`${x},${y},${z}`];
    if (mesh) {
        scene.remove(mesh);
        delete meshes[`${x},${y},${z}`];
    }
}

// --- PLAYER PHYSICS AND CONTROLS ---
const player = {
    height: 1.8,
    width: 0.6,
    velocity: new THREE.Vector3(),
    onGround: false
};

const GRAVITY = 30;
const moveSpeed = 10;
const jumpVelocity = 10;
const controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false
};

// --- MOUSE CONTROLS (Pointer Lock) ---
// FPS camera variables
let mouseX = 0;
let mouseY = 0;
let targetRotationX = 0;
let targetRotationY = 0;

const instructions = document.getElementById('instructions');
document.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        instructions.style.display = 'none';
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        instructions.style.display = 'block';
        document.removeEventListener('mousemove', onMouseMove, false);
    }
});

function onMouseMove(event) {
    if (document.pointerLockElement === document.body) {
        // Update target rotations
        targetRotationY -= event.movementX * 0.002;
        targetRotationX -= event.movementY * 0.002;
        
        // Clamp vertical rotation to prevent flipping
        targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotationX));
        
        // Apply rotations using quaternions to avoid gimbal lock
        camera.quaternion.setFromEuler(new THREE.Euler(targetRotationX, targetRotationY, 0, 'YXZ'));
    }
}

// --- KEYBOARD CONTROLS ---
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': controls.moveForward = true; break;
        case 'KeyS': controls.moveBackward = true; break;
        case 'KeyA': controls.moveLeft = true; break;
        case 'KeyD': controls.moveRight = true; break;
        case 'Space': if (player.onGround) { player.velocity.y = jumpVelocity; player.onGround = false; } break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': controls.moveForward = false; break;
        case 'KeyS': controls.moveBackward = false; break;
        case 'KeyA': controls.moveLeft = false; break;
        case 'KeyD': controls.moveRight = false; break;
    }
});

// --- BLOCK PLACEMENT/REMOVAL ---
// REMOVE the entire mousedown event listener block below:
// document.addEventListener('mousedown', (event) => {
//     if (document.pointerLockElement !== document.body) return;
//     raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Ray from center of screen
//     const intersects = raycaster.intersectObjects(Object.values(meshes));
//     if (intersects.length > 0) {
//         const intersection = intersects[0];
//         const position = new THREE.Vector3().copy(intersection.point);
//         const normal = intersection.face.normal;
//         if (event.button === 0) { // Left click: Place block
//             position.add(normal.multiplyScalar(0.5));
//             const [x, y, z] = position.toArray().map(v => Math.floor(v));
//             if (getVoxel(x, y, z) === 0) {
//                 setVoxel(x, y, z, 1);
//                 addVoxelMesh(x, y, z);
//             }
//         } else if (event.button === 2) { // Right click: Remove block
//             position.sub(normal.multiplyScalar(0.5));
//             const [x, y, z] = position.toArray().map(v => Math.floor(v));
//             if (getVoxel(x, y, z) === 1) {
//                 setVoxel(x, y, z, 0);
//                 removeVoxelMesh(x, y, z);
//             }
//         }
//     }
// });

// --- PHYSICS UPDATE ---
function updatePhysics(delta) {
    // Apply gravity
    player.velocity.y -= GRAVITY * delta;

    // Movement direction vector
    const moveDirection = new THREE.Vector3();
    if (controls.moveForward) moveDirection.z -= 1;
    if (controls.moveBackward) moveDirection.z += 1;
    if (controls.moveLeft) moveDirection.x -= 1;
    if (controls.moveRight) moveDirection.x += 1;
    
    moveDirection.normalize().applyQuaternion(camera.quaternion); // Rotate with camera
    
    player.velocity.x = moveDirection.x * moveSpeed;
    player.velocity.z = moveDirection.z * moveSpeed;
    
    // Simple AABB Collision Detection
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        camera.position,
        new THREE.Vector3(player.width, player.height, player.width)
    );

    // Collision on Y axis
    camera.position.y += player.velocity.y * delta;
    player.onGround = false;
    for(let x = Math.floor(playerBox.min.x); x <= Math.floor(playerBox.max.x); x++) {
        for(let z = Math.floor(playerBox.min.z); z <= Math.floor(playerBox.max.z); z++) {
            for(let y = Math.floor(playerBox.min.y); y <= Math.floor(playerBox.max.y); y++) {
                if(getVoxel(x, y, z)) {
                    if (player.velocity.y < 0 && camera.position.y < y + 1.5) {
                        camera.position.y = y + 1.5;
                        player.velocity.y = 0;
                        player.onGround = true;
                    }
                }
            }
        }
    }
    
    // Collision on X and Z axes will be implemented similarly
    camera.position.x += player.velocity.x * delta;
    camera.position.z += player.velocity.z * delta;
}

// Prevent right-click context menu
window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- GAME LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    if (document.pointerLockElement === document.body) {
        updatePhysics(delta);
    }
    
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();