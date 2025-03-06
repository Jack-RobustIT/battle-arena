import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';
import { io } from 'https://cdn.socket.io/4.4.1/socket.io.esm.min.js';
import {
    Mage,
    createUI,
    updateUI,
    updateCastBar,
    updateSpellBar,
    updateCasting,
    spells,
    createTargetUI,
    updateTargetUI
} from './spells.js';

// ------------------ POPUP FUNCTION ------------------
function showPopup(message) {
    const popup = document.createElement('div');
    popup.innerText = message;
    popup.style.position = 'absolute';
    popup.style.left = '50%';
    popup.style.top = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.color = '#fff';
    popup.style.fontSize = '24px';
    popup.style.padding = '10px';
    popup.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    popup.style.borderRadius = '5px';
    popup.style.zIndex = '2000';
    document.body.appendChild(popup);

    let opacity = 1;
    let yOffset = 0;
    const fadeInterval = setInterval(() => {
        opacity -= 0.02;
        yOffset -= 1;
        popup.style.opacity = opacity;
        popup.style.transform = `translate(-50%, calc(-50% + ${yOffset}px))`;
        if (opacity <= 0) {
            clearInterval(fadeInterval);
            popup.remove();
        }
    }, 30);
}

// ------------------ HELPER: Check if Facing Target ------------------
function isFacingTarget(casterMesh, targetMesh) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(casterMesh.quaternion).normalize();
    const toTarget = new THREE.Vector3().subVectors(targetMesh.position, casterMesh.position).normalize();
    const angle = forward.angleTo(toTarget);
    return angle < Math.PI / 6; // 30 degrees threshold
}

// ------------------ SOCKET SETUP ------------------
const socket = io();

// ------------------ SCENE SETUP ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
window.scene = scene;
window.spells = spells;

// ------------------ CAMERA SETUP ------------------
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffsetDistance = 5;
const cameraHeightOffset = 2;

// ------------------ RENDERER ------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);
document.body.appendChild(renderer.domElement);

// ------------------ GROUND & GRID ------------------
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const gridHelper = new THREE.GridHelper(100, 100);
scene.add(gridHelper);

// ------------------ LIGHTS ------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// ------------------ MAGE PLAYER ------------------
const mageGeometry = new THREE.BoxGeometry(1, 2, 1);
const mageMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const mageMesh = new THREE.Mesh(mageGeometry, mageMaterial);
mageMesh.position.set(0, 1, 0);
scene.add(mageMesh);

// Add Front Marker ("F")
function createFrontMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = 'Bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const markerGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const markerMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 1, -0.51);
    return marker;
}
mageMesh.add(createFrontMarker());

const magePlayer = new Mage(mageMesh);
window.magePlayer = magePlayer;

// ------------------ DUMMY ENEMY ------------------
const enemyGeometry = new THREE.BoxGeometry(1, 2, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial);
enemyMesh.position.set(5, 1, 0);
enemyMesh.userData = { hp: 100, maxHp: 100, mana: 100, maxMana: 100 };
scene.add(enemyMesh);
let currentTarget = null;
window.currentTarget = currentTarget; // So spells.js can reference

// ------------------ UI ------------------
createUI();

// ------------------ CAMERA & MANUAL OVERRIDE VARIABLES ------------------
let playerYaw = 0;       // Mage facing angle (radians)
let cameraYaw = playerYaw;
let cameraPitch = 0;
const pitchLimit = Math.PI / 3;
let leftMouseDown = false;
let isDragging = false;
let manualCameraYaw = cameraYaw;
let manualCameraPitch = cameraPitch;

// ------------------ MOUSE EVENTS (CAMERA & TARGET SELECTION) ------------------
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        leftMouseDown = true;
        isDragging = false;
        manualCameraYaw = cameraYaw;
        manualCameraPitch = cameraPitch;
    }
});
document.addEventListener('mousemove', (event) => {
    if (leftMouseDown) {
        if (Math.abs(event.movementX) > 2 || Math.abs(event.movementY) > 2) {
            isDragging = true;
        }
        manualCameraYaw -= event.movementX * 0.002;
        manualCameraPitch += event.movementY * 0.002; // Inverted up/down: dragging up increases pitch.
        manualCameraPitch = Math.max(-pitchLimit, Math.min(manualCameraPitch, pitchLimit));
    }
});
document.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
        leftMouseDown = false;
        // Only treat as target selection if not dragging.
        if (!isDragging) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects([enemyMesh]);
            if (intersects.length > 0) {
                console.log("Dummy enemy selected!");
                currentTarget = enemyMesh;
                window.currentTarget = currentTarget;
                createTargetUI();
                enemyMesh.material.emissive = new THREE.Color(0x00ffff);
                setTimeout(() => {
                    enemyMesh.material.emissive = new THREE.Color(0x000000);
                }, 500);
            } else {
                currentTarget = null;
                window.currentTarget = null;
                const targetContainer = document.getElementById('targetContainer');
                if (targetContainer) targetContainer.remove();
            }
        }
    }
});

// ------------------ MOVEMENT (WASD) ------------------
const move = { forward: false, backward: false, left: false, right: false };
const moveSpeed = 0.1;
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': move.forward = true; break;
        case 'KeyS': move.backward = true; break;
        case 'KeyA': move.left = true; break;
        case 'KeyD': move.right = true; break;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': move.forward = false; break;
        case 'KeyS': move.backward = false; break;
        case 'KeyA': move.left = false; break;
        case 'KeyD': move.right = false; break;
    }
});

// ------------------ SPELL CASTING (Digits 1-5) ------------------
const offensiveSpells = ['Fireball', 'Frost Bolt', 'Frost Nova'];
document.addEventListener('keydown', (event) => {
    const currentTime = Date.now();
    let spellName = "";
    switch (event.code) {
        case 'Digit1': spellName = 'Fireball'; break;
        case 'Digit2': spellName = 'Frost Bolt'; break;
        case 'Digit3': spellName = 'Frost Nova'; break;
        case 'Digit4': spellName = 'Innovation'; break;
        case 'Digit5': spellName = 'Sheep'; break;
    }
    // For offensive spells, check that a target is selected and that the mage is facing the target.
    if (offensiveSpells.includes(spellName)) {
        if (!window.currentTarget) {
            showPopup("No target selected!");
            return;
        }
        if (!isFacingTarget(mageMesh, window.currentTarget)) {
            showPopup("Not facing target!");
            return;
        }
    }
    magePlayer.castSpell(spellName, currentTime);
    showPopup(`${spellName} cast!`);
});

// ------------------ WEBSOCKET EVENTS (Placeholders) ------------------
socket.on('currentPlayers', (serverPlayers) => { });
socket.on('newPlayer', (data) => { });
socket.on('updatePlayer', (data) => { });
socket.on('removePlayer', (id) => { });
socket.on('spellCast', (data) => { });

// ---------- HELPER: Linear Interpolation ----------
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ------------------ ANIMATION LOOP ------------------
function animate() {
    requestAnimationFrame(animate);
    const currentTime = Date.now();

    // Cancel cast if moving.
    if (magePlayer.currentlyCasting && (move.forward || move.backward || move.left || move.right)) {
        console.log("Cast canceled due to movement.");
        if (magePlayer.currentlyCasting.spell.name === "Innovation" && magePlayer.innovationAura) {
            mageMesh.remove(magePlayer.innovationAura);
            magePlayer.innovationAura = null;
        }
        magePlayer.currentlyCasting = null;
    }

    // Update mage rotation: left/right keys rotate the mage.
    if (move.left) { playerYaw += 0.03; }
    if (move.right) { playerYaw -= 0.03; }
    mageMesh.rotation.y = playerYaw;

    // Move mage: Use forward vector = (0, 0, -1) (since "F" is at -Z).
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
    if (move.forward) { mageMesh.position.add(forwardVec.clone().multiplyScalar(moveSpeed)); }
    if (move.backward) { mageMesh.position.add(forwardVec.clone().multiplyScalar(-moveSpeed)); }

    // CAMERA CONTROL:
    // If left mouse is held (manual override), use manual angles.
    // Otherwise, if movement keys are pressed, smoothly snap camera back behind mage.
    if (!leftMouseDown && (move.forward || move.backward || move.left || move.right)) {
        cameraYaw = lerp(cameraYaw, playerYaw, 0.1);
        cameraPitch = lerp(cameraPitch, 0, 0.1);
    } else if (leftMouseDown) {
        cameraYaw = manualCameraYaw;
        cameraPitch = manualCameraPitch;
    }
    // Otherwise, maintain current cameraYaw/cameraPitch.

    // Position camera behind the mage.
    camera.position.x = mageMesh.position.x + Math.sin(cameraYaw) * cameraOffsetDistance;
    camera.position.z = mageMesh.position.z + Math.cos(cameraYaw) * cameraOffsetDistance;
    camera.position.y = mageMesh.position.y + cameraHeightOffset + Math.sin(cameraPitch) * 2;
    camera.lookAt(mageMesh.position.x, mageMesh.position.y + 1, mageMesh.position.z);

    // UI Updates
    updateUI(magePlayer);
    updateCastBar(magePlayer, currentTime);
    updateSpellBar(magePlayer, currentTime);
    if (magePlayer.currentlyCasting) { updateCasting(magePlayer, currentTime); }

    // Update active spells (projectiles)
    for (let i = spells.length - 1; i >= 0; i--) {
        const spellObj = spells[i];
        // Homing behavior: if projectile has a target, adjust its velocity toward target.
        if (spellObj.userData.target) {
            const direction = new THREE.Vector3().subVectors(spellObj.userData.target.position, spellObj.position).normalize();
            spellObj.userData.velocity.copy(direction.multiplyScalar(0.2));
        }
        if (spellObj.userData.velocity) {
            spellObj.position.add(spellObj.userData.velocity);
        }
        // Collision detection for Fireball & Frost Bolt
        if (spellObj.userData.target && spellObj.position.distanceTo(spellObj.userData.target.position) < 0.5) {
            if (spellObj.userData.type === 'fireball') {
                console.log("Fireball hit target!");
                spellObj.userData.target.userData.hp -= spellObj.userData.damage;
                showPopup(`Fireball hit! -${spellObj.userData.damage} HP`);
                // Start DOT on target (reduce HP every second for dotDuration)
                let dotTime = 0;
                const dotInterval = setInterval(() => {
                    dotTime += 1000;
                    spellObj.userData.target.userData.hp -= spellObj.userData.dot;
                    showPopup(`DOT: -${spellObj.userData.dot} HP`);
                    if (dotTime >= spellObj.userData.dotDuration) {
                        clearInterval(dotInterval);
                    }
                }, 1000);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            } else if (spellObj.userData.type === 'frostbolt') {
                console.log("Frost Bolt hit target!");
                spellObj.userData.target.userData.hp -= spellObj.userData.damage;
                showPopup(`Frost Bolt hit! -${spellObj.userData.damage} HP`);
                // Apply slow for 8 seconds.
                spellObj.userData.target.userData.slowUntil = currentTime + 8000;
                spellObj.userData.target.material.color.set(0xadd8e6);
                setTimeout(() => {
                    spellObj.userData.target.material.color.set(0xff0000);
                    spellObj.userData.target.userData.slowUntil = null;
                }, 8000);
                scene.remove(spellObj);
                spells.splice(i, 1);
                continue;
            }
        }
        if (spellObj.position.distanceTo(mageMesh.position) > 50) {
            scene.remove(spellObj);
            spells.splice(i, 1);
        }
    }

    // (Optional) Update target UI if a target is selected.
    if (currentTarget) { updateTargetUI(currentTarget); }

    // Send player movement to server.
    socket.emit('playerMove', {
        x: mageMesh.position.x,
        y: mageMesh.position.y,
        z: mageMesh.position.z,
        yaw: playerYaw
    });

    renderer.render(scene, camera);
}

animate();
