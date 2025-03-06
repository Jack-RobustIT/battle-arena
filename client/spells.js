import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

export const spells = [];

export class Spell {
    constructor({ name, range, cooldown, castTime = 0, channel = false, manaCost = 0, effect }) {
        this.name = name;
        this.range = range;
        this.cooldown = cooldown;
        this.castTime = castTime;
        this.channel = channel;
        this.manaCost = manaCost;
        this.effect = effect;
        this.lastCast = -Infinity;
    }

    canCast(currentTime) {
        return currentTime - this.lastCast >= this.cooldown;
    }

    cast(caster, currentTime) {
        if (!this.canCast(currentTime)) {
            console.log(`${this.name} is on cooldown.`);
            return false;
        }
        if (this.castTime > 0) {
            if (caster.currentlyCasting) {
                console.log(`${caster.type} is already casting.`);
                return false;
            }
            if (this.manaCost > 0 && caster.mana < this.manaCost) {
                console.log(`Not enough mana for ${this.name}`);
                return false;
            }
            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost,
                lastManaRestoreTime: currentTime
            };
            console.log(`Started casting ${this.name} for ${caster.type} (${this.castTime} ms)`);
            return true;
        } else {
            if (this.manaCost > 0) {
                caster.mana -= this.manaCost;
            }
            this.lastCast = currentTime;
            this.effect(caster);
            console.log(`${this.name} cast instantly by ${caster.type}`);
            return true;
        }
    }
}

export function updateCasting(caster, currentTime) {
    if (caster.currentlyCasting) {
        const elapsed = currentTime - caster.currentlyCasting.startTime;
        if (caster.currentlyCasting.spell.name === "Innovation") {
            if (currentTime - caster.currentlyCasting.lastManaRestoreTime >= 1000) {
                let restoreAmount = caster.maxMana / 8;
                caster.mana = Math.min(caster.maxMana, caster.mana + restoreAmount);
                caster.currentlyCasting.lastManaRestoreTime = currentTime;
                console.log("Innovation: restored mana, current mana:", caster.mana);
            }
        }
        if (elapsed >= caster.currentlyCasting.castTime) {
            if (caster.currentlyCasting.spell.name !== "Innovation" && caster.currentlyCasting.manaCost > 0) {
                if (caster.mana >= caster.currentlyCasting.manaCost) {
                    caster.mana -= caster.currentlyCasting.manaCost;
                } else {
                    console.log(`Not enough mana to complete ${caster.currentlyCasting.spell.name}, cast canceled.`);
                    caster.currentlyCasting = null;
                    return;
                }
            }
            if (caster.currentlyCasting.spell.name === "Innovation") {
                caster.mana = caster.maxMana;
            }
            caster.currentlyCasting.spell.lastCast = currentTime;
            caster.currentlyCasting.spell.effect(caster);
            console.log(`${caster.currentlyCasting.spell.name} cast by ${caster.type} completed.`);
            if (caster.currentlyCasting.spell.name === "Innovation" && caster.innovationAura) {
                caster.mesh.remove(caster.innovationAura);
                caster.innovationAura = null;
            }
            caster.currentlyCasting = null;
        }
    }
}

// ---- Mage Spells ----

// Fireball: 2s cast; damage + DOT; homes in on target if selected.
export class FireballSpell extends Spell {
    constructor() {
        super({
            name: 'Fireball',
            range: 18,
            cooldown: 3000,
            castTime: 2000,
            channel: false,
            manaCost: 20,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                const fireball = new THREE.Mesh(geometry, material);
                fireball.position.copy(caster.mesh.position);
                // If there's a target, set it; otherwise, use default direction.
                if (window.currentTarget) {
                    fireball.userData.target = window.currentTarget;
                }
                fireball.userData.velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion).multiplyScalar(0.2);
                fireball.userData.damage = 10;
                fireball.userData.dot = 5;
                fireball.userData.dotDuration = 5000;
                fireball.userData.type = 'fireball';
                spells.push(fireball);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(fireball);
                }
            }
        });
    }
}

// Frost Bolt: 1.5s cast; damage + 30% slow for 8s; homes in on target if selected.
export class FrostBoltSpell extends Spell {
    constructor() {
        super({
            name: 'Frost Bolt',
            range: 18,
            cooldown: 2500,
            castTime: 1500,
            channel: false,
            manaCost: 15,
            effect: (caster) => {
                if (!caster.mesh) return;
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xadd8e6 });
                const frostbolt = new THREE.Mesh(geometry, material);
                frostbolt.position.copy(caster.mesh.position);
                if (window.currentTarget) {
                    frostbolt.userData.target = window.currentTarget;
                }
                frostbolt.userData.velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion).multiplyScalar(0.2);
                frostbolt.userData.damage = 8;
                frostbolt.userData.slowAmount = 0.3;
                frostbolt.userData.slowDuration = 8000;
                frostbolt.userData.type = 'frostbolt';
                spells.push(frostbolt);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(frostbolt);
                }
            }
        });
    }
}

// Frost Nova: Instant; AOE freeze for 8s.
export class FrostNovaSpell extends Spell {
    constructor() {
        super({
            name: 'Frost Nova',
            range: 8,
            cooldown: 5000,
            castTime: 0,
            channel: false,
            manaCost: 25,
            effect: (caster) => {
                if (!caster.mesh) return;
                const freezeRadius = 5;
                // Check if target is within freezeRadius:
                if (window.currentTarget && caster.mesh.position.distanceTo(window.currentTarget.position) <= freezeRadius) {
                    window.currentTarget.userData.freezeUntil = Date.now() + 8000;
                    window.currentTarget.material.color.set(0xadd8e6);
                    setTimeout(() => {
                        window.currentTarget.material.color.set(0xff0000);
                        window.currentTarget.userData.freezeUntil = null;
                    }, 8000);
                }
                // Create an expanding ring visual effect.
                const geometry = new THREE.RingGeometry(0.5, 0.6, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xadd8e6, side: THREE.DoubleSide, transparent: true, opacity: 0.7
                });
                const ring = new THREE.Mesh(geometry, material);
                ring.position.copy(caster.mesh.position);
                ring.rotation.x = -Math.PI / 2;
                spells.push(ring);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(ring);
                }
                let scale = 1;
                const interval = setInterval(() => {
                    scale += 0.1;
                    ring.scale.set(scale, scale, scale);
                    if (scale > 3) {
                        clearInterval(interval);
                        if (typeof window.scene !== 'undefined') window.scene.remove(ring);
                    }
                }, 50);
            }
        });
    }
}

// Innovation: 8s channel; every second, restore maxMana/8; on completion, mana full.
export class InnovationSpell extends Spell {
    constructor() {
        super({
            name: 'Innovation',
            range: 0,
            cooldown: 12000,
            castTime: 8000,
            channel: true,
            manaCost: 0,
            effect: (caster) => {
                console.log('Innovation channel complete.');
            }
        });
    }

    cast(caster, currentTime) {
        if (!this.canCast(currentTime)) {
            console.log(`${this.name} is on cooldown.`);
            return false;
        }
        if (this.castTime > 0) {
            if (caster.currentlyCasting) {
                console.log(`${caster.type} is already casting.`);
                return false;
            }
            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost,
                lastManaRestoreTime: currentTime
            };
            // Add an aura for visual feedback.
            const geometry = new THREE.SphereGeometry(1.5, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x800080, transparent: true, opacity: 0.5 });
            const aura = new THREE.Mesh(geometry, material);
            aura.position.set(0, 0, 0);
            caster.mesh.add(aura);
            caster.innovationAura = aura;
            console.log(`Started casting ${this.name} for ${caster.type} (${this.castTime} ms)`);
            return true;
        } else {
            this.lastCast = currentTime;
            this.effect(caster);
            console.log(`${this.name} cast instantly by ${caster.type}`);
            return true;
        }
    }
}

// Sheep: 2s cast; if target selected, transform it to a small cube ("sheep") with random movement for 8s.
export class SheepSpell extends Spell {
    constructor() {
        super({
            name: 'Sheep',
            range: 18,
            cooldown: 10000,
            castTime: 2000,
            channel: false,
            manaCost: 30,
            effect: (caster) => {
                if (window.currentTarget) {
                    console.log('Sheep cast: target transformed into a sheep for 8 seconds.');
                    window.currentTarget.scale.set(0.5, 0.5, 0.5);
                    window.currentTarget.material.color.set(0xffffff);
                    window.currentTarget.userData.sheepVelocity = new THREE.Vector3(
                        (Math.random() - 0.5) * 0.05,
                        0,
                        (Math.random() - 0.5) * 0.05
                    );
                    setTimeout(() => {
                        window.currentTarget.scale.set(1, 1, 1);
                        window.currentTarget.material.color.set(0xff0000);
                        window.currentTarget.userData.sheepVelocity = null;
                    }, 8000);
                } else {
                    console.log('Sheep cast: no target selected.');
                }
            }
        });
    }
}

// Character & Mage classes
export class Character {
    constructor(type, mesh = null) {
        this.type = type;
        this.hp = 100;
        this.maxHp = 100;
        this.mana = 100;
        this.maxMana = 100;
        this.spells = [];
        this.mesh = mesh || new THREE.Object3D();
        this.currentlyCasting = null;
    }

    castSpell(spellName, currentTime) {
        const spell = this.spells.find(s => s.name === spellName);
        if (spell) {
            return spell.cast(this, currentTime);
        } else {
            console.log(`Spell ${spellName} not available for ${this.type}`);
            return false;
        }
    }
}

export class Mage extends Character {
    constructor(mesh = null) {
        super('Mage', mesh);
        this.spells.push(new FireballSpell());
        this.spells.push(new FrostBoltSpell());
        this.spells.push(new FrostNovaSpell());
        this.spells.push(new InnovationSpell());
        this.spells.push(new SheepSpell());
    }
}

// Warrior and Hunter classes remain unchanged for now.
export class Warrior extends Character {
    constructor(mesh = null) {
        super('Warrior', mesh);
    }
}
export class Hunter extends Character {
    constructor(mesh = null) {
        super('Hunter', mesh);
    }
}

// ------------------ UI FUNCTIONS ------------------
export function createUI() {
    // HP Bar (top left)
    const hpContainer = document.createElement('div');
    hpContainer.id = 'hpContainer';
    hpContainer.style.position = 'absolute';
    hpContainer.style.top = '10px';
    hpContainer.style.left = '10px';
    hpContainer.style.width = '200px';
    hpContainer.style.height = '20px';
    hpContainer.style.backgroundColor = '#555';
    hpContainer.style.border = '2px solid #fff';
    hpContainer.style.zIndex = '1000';
    document.body.appendChild(hpContainer);

    const hpBar = document.createElement('div');
    hpBar.id = 'hpBar';
    hpBar.style.height = '100%';
    hpBar.style.width = '100%';
    hpBar.style.backgroundColor = '#f00';
    hpContainer.appendChild(hpBar);

    // Mana Bar (below HP, top left)
    const manaContainer = document.createElement('div');
    manaContainer.id = 'manaContainer';
    manaContainer.style.position = 'absolute';
    manaContainer.style.top = '40px';
    manaContainer.style.left = '10px';
    manaContainer.style.width = '200px';
    manaContainer.style.height = '20px';
    manaContainer.style.backgroundColor = '#555';
    manaContainer.style.border = '2px solid #fff';
    manaContainer.style.zIndex = '1000';
    document.body.appendChild(manaContainer);

    const manaBar = document.createElement('div');
    manaBar.id = 'manaBar';
    manaBar.style.height = '100%';
    manaBar.style.width = '100%';
    manaBar.style.backgroundColor = '#00f';
    manaContainer.appendChild(manaBar);

    // Cast Bar (bottom center)
    const castContainer = document.createElement('div');
    castContainer.id = 'castContainer';
    castContainer.style.position = 'absolute';
    castContainer.style.bottom = '10px';
    castContainer.style.left = '50%';
    castContainer.style.transform = 'translateX(-50%)';
    castContainer.style.width = '300px';
    castContainer.style.height = '20px';
    castContainer.style.backgroundColor = '#333';
    castContainer.style.border = '2px solid #fff';
    castContainer.style.zIndex = '1000';
    document.body.appendChild(castContainer);

    const castBar = document.createElement('div');
    castBar.id = 'castBar';
    castBar.style.height = '100%';
    castBar.style.width = '0%';
    castBar.style.backgroundColor = '#ff0';
    castContainer.appendChild(castBar);

    // Spell Bar (under cast bar)
    const spellBarContainer = document.createElement('div');
    spellBarContainer.id = 'spellBarContainer';
    spellBarContainer.style.position = 'absolute';
    spellBarContainer.style.bottom = '40px';
    spellBarContainer.style.left = '50%';
    spellBarContainer.style.transform = 'translateX(-50%)';
    spellBarContainer.style.display = 'flex';
    spellBarContainer.style.gap = '10px';
    spellBarContainer.style.zIndex = '1000';
    document.body.appendChild(spellBarContainer);

    if (window.magePlayer) {
        window.magePlayer.spells.forEach((spell, index) => {
            const spellDiv = document.createElement('div');
            spellDiv.className = 'spellSquare';
            spellDiv.id = `spellSquare-${index}`;
            spellDiv.style.width = '50px';
            spellDiv.style.height = '50px';
            spellDiv.style.border = '2px solid #fff';
            spellDiv.style.position = 'relative';
            spellDiv.style.display = 'flex';
            spellDiv.style.alignItems = 'center';
            spellDiv.style.justifyContent = 'center';
            spellDiv.style.backgroundColor = '#333';

            const label = document.createElement('div');
            label.innerText = `${index + 1}: ${spell.name}`;
            label.style.color = '#fff';
            label.style.fontSize = '10px';
            label.style.textAlign = 'center';
            label.style.pointerEvents = 'none';
            spellDiv.appendChild(label);

            const cooldownOverlay = document.createElement('div');
            cooldownOverlay.className = 'cooldownOverlay';
            cooldownOverlay.style.position = 'absolute';
            cooldownOverlay.style.top = '0';
            cooldownOverlay.style.left = '0';
            cooldownOverlay.style.width = '100%';
            cooldownOverlay.style.height = '100%';
            cooldownOverlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
            cooldownOverlay.style.color = '#fff';
            cooldownOverlay.style.fontSize = '12px';
            cooldownOverlay.style.display = 'flex';
            cooldownOverlay.style.alignItems = 'center';
            cooldownOverlay.style.justifyContent = 'center';
            cooldownOverlay.innerText = '';
            spellDiv.appendChild(cooldownOverlay);

            spellBarContainer.appendChild(spellDiv);
        });
    }
}

export function updateUI(character) {
    const hpBar = document.getElementById('hpBar');
    const manaBar = document.getElementById('manaBar');
    if (hpBar) {
        hpBar.style.width = (character.hp / character.maxHp * 100) + '%';
    }
    if (manaBar) {
        manaBar.style.width = (character.mana / character.maxMana * 100) + '%';
    }
}

export function updateCastBar(character, currentTime) {
    const castBar = document.getElementById('castBar');
    if (character.currentlyCasting && castBar) {
        const elapsed = currentTime - character.currentlyCasting.startTime;
        const percent = Math.min((elapsed / character.currentlyCasting.castTime) * 100, 100);
        castBar.style.width = percent + '%';
    } else if (castBar) {
        castBar.style.width = '0%';
    }
}

export function updateSpellBar(character, currentTime) {
    character.spells.forEach((spell, index) => {
        const spellDiv = document.getElementById(`spellSquare-${index}`);
        if (spellDiv) {
            const overlay = spellDiv.querySelector('.cooldownOverlay');
            const timeSinceCast = currentTime - spell.lastCast;
            if (timeSinceCast < spell.cooldown) {
                const remaining = ((spell.cooldown - timeSinceCast) / 1000).toFixed(1);
                overlay.innerText = remaining + 's';
            } else {
                overlay.innerText = '';
            }
        }
    });
}

export function createTargetUI() {
    if (document.getElementById('targetContainer')) return;
    const targetContainer = document.createElement('div');
    targetContainer.id = 'targetContainer';
    targetContainer.style.position = 'absolute';
    targetContainer.style.top = '10px';
    targetContainer.style.left = '220px';
    targetContainer.style.width = '200px';
    targetContainer.style.height = '40px';
    targetContainer.style.backgroundColor = '#333';
    targetContainer.style.border = '2px solid #fff';
    targetContainer.style.zIndex = '1000';
    document.body.appendChild(targetContainer);

    const targetHp = document.createElement('div');
    targetHp.id = 'targetHp';
    targetHp.style.height = '20px';
    targetHp.style.width = '100%';
    targetHp.style.backgroundColor = '#f00';
    targetContainer.appendChild(targetHp);

    const targetMana = document.createElement('div');
    targetMana.id = 'targetMana';
    targetMana.style.height = '20px';
    targetMana.style.width = '100%';
    targetMana.style.backgroundColor = '#00f';
    targetContainer.appendChild(targetMana);
}

export function updateTargetUI(target) {
    const targetHp = document.getElementById('targetHp');
    const targetMana = document.getElementById('targetMana');
    if (targetHp && targetMana) {
        const hp = target.userData.hp || 100;
        const maxHp = target.userData.maxHp || 100;
        const mana = target.userData.mana || 100;
        const maxMana = target.userData.maxMana || 100;
        targetHp.style.width = (hp / maxHp * 100) + '%';
        targetMana.style.width = (mana / maxMana * 100) + '%';
    }
}


