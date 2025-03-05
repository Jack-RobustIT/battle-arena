import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';
import { io } from 'https://cdn.socket.io/4.4.1/socket.io.esm.min.js';
import { Mage, createUI, updateUI, updateCastBar, updateSpellBar, updateCasting, spells } from './spells.js';

// Connect to the WebSocket server
const socket = io();

// Setup Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
window.scene = scene;
window.spells = spells;

// Create Camera – it will automatically follow behind the player.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffsetDistance = 5;  // Distance behind the player
const cameraHeightOffset = 2;    // Height above the player

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Add Grid Helper
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// Add Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Utility: Create a Front Marker that displays an "F"
function createFrontMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.font = 'Bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('F', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const marker = new THREE.Mesh(geometry, material);
    // Position the marker in front of the cube (assuming the cube depth is 1)
    marker.position.set(0, 1, -0.51);
    return marker;
}

// Create Mage Player Mesh and Instance
const mageGeometry = new THREE.BoxGeometry(1, 2, 1);
const mageMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const mageMesh = new THREE.Mesh(mageGeometry, mageMaterial);
mageMesh.position.set(0, 1, 0);
scene.add(mageMesh);

// Add the Front Marker to the mage mesh.
mageMesh.add(createFrontMarker());

const magePlayer = new Mage(mageMesh);
window.magePlayer = magePlayer; // For UI creation

// Create a dummy enemy for target selection (a red cube)
const enemyGeometry = new THREE.BoxGeometry(1, 2, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial);
enemyMesh.position.set(5, 1, 0);
scene.add(enemyMesh);
window.dummyEnemy = enemyMesh;

// Create UI: HP, Mana, Cast Bar, and Spell Bar
createUI();

// Movement Variables (WASD for movement; A/D now also rotate the mage)
const playerSpeed = 0.1;
const movement = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

let playerYaw = 0; // Mage's facing angle (radians)

// Key Event Listeners for Movement (W, A, S, D)
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': movement.forward = true; break;
        case 'KeyS': movement.backward = true; break;
        case 'KeyA': movement.left = true; break;
        case 'KeyD': movement.right = true; break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': movement.forward = false; break;
        case 'KeyS': movement.backward = false; break;
        case 'KeyA': movement.left = false; break;
        case 'KeyD': movement.right = false; break;
    }
});

// Since we want the mouse to be visible for clicking, we do not lock pointer.
// Instead, we add a raycaster to detect clicks on objects.
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (event) => {
    // Calculate normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([enemyMesh]);
    if (intersects.length > 0) {
        console.log("Dummy enemy selected!");
        // For example, highlight the enemy
        enemyMesh.material.emissive = new THREE.Color(0x00ffff);
        setTimeout(() => {
            enemyMesh.material.emissive = new THREE.Color(0x000000);
        }, 500);
    }
});

// Key Event for Casting Mage Spells (Digits 1-5)
document.addEventListener('keydown', (event) => {
    const currentTime = Date.now();
    switch (event.code) {
        case 'Digit1': magePlayer.castSpell('Fireball', currentTime); break;
        case 'Digit2': magePlayer.castSpell('Frost Bolt', currentTime); break;
        case 'Digit3': magePlayer.castSpell('Frost Nova', currentTime); break;
        case 'Digit4': magePlayer.castSpell('Innovation', currentTime); break;
        case 'Digit5': magePlayer.castSpell('Sheep', currentTime); break;
    }
});

// WebSocket events (for multi-player; extend as needed)
socket.on('currentPlayers', (serverPlayers) => { });
socket.on('newPlayer', (data) => { });
socket.on('updatePlayer', (data) => { });
socket.on('removePlayer', (id) => { });
socket.on('spellCast', (data) => { });

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    const currentTime = Date.now();

    // If moving while casting, cancel the cast.
    if (magePlayer.currentlyCasting && (movement.forward || movement.backward || movement.left || movement.right)) {
        console.log("Cast canceled due to movement.");
        if (magePlayer.currentlyCasting.spell.name === "Innovation" && magePlayer.innovationAura) {
            mageMesh.remove(magePlayer.innovationAura);
            magePlayer.innovationAura = null;
        }
        magePlayer.currentlyCasting = null;
    }

    // Update Mage rotation: Using left/right movement to rotate the mage.
    if (movement.left) { playerYaw += 0.03; }
    if (movement.right) { playerYaw -= 0.03; }
    mageMesh.rotation.y = playerYaw;

    // Move Mage forward/backward based on facing.
    const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
    if (movement.forward) { mageMesh.position.add(forwardVector.clone().multiplyScalar(playerSpeed)); }
    if (movement.backward) { mageMesh.position.add(forwardVector.clone().multiplyScalar(-playerSpeed)); }

    // Update Camera: Automatically follow behind the mage.
    camera.position.x = mageMesh.position.x - cameraOffsetDistance * Math.sin(playerYaw);
    camera.position.z = mageMesh.position.z - cameraOffsetDistance * Math.cos(playerYaw);
    camera.position.y = mageMesh.position.y + cameraHeightOffset;
    camera.lookAt(mageMesh.position.x, mageMesh.position.y + 1, mageMesh.position.z);

    // Update UI: HP, Mana, Cast Bar, and Spell Bar.
    updateUI(magePlayer);
    updateCastBar(magePlayer, currentTime);
    updateSpellBar(magePlayer, currentTime);
    if (magePlayer.currentlyCasting) {
        updateCasting(magePlayer, currentTime);
    }

    // Update active spells: Only update spells that have a velocity.
    for (let i = spells.length - 1; i >= 0; i--) {
        const spellObj = spells[i];
        if (spellObj.userData.velocity) {
            spellObj.position.add(spellObj.userData.velocity);
        }
        if (spellObj.position.distanceTo(mageMesh.position) > 50) {
            window.scene.remove(spellObj);
            spells.splice(i, 1);
        }
    }

    // Optionally, send player movement to server.
    socket.emit('playerMove', {
        x: mageMesh.position.x,
        y: mageMesh.position.y,
        z: mageMesh.position.z,
        yaw: playerYaw
    });

    renderer.render(scene, camera);
}

animate();
