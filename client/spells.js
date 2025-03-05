import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

/* ==============================
   Global Array for Spell Effects
   ============================== */
export const spells = [];

/* ==============================
   Base Spell Class (with cast time/channel support and mana cost)
   ============================== */
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

    // For spells with cast time, we delay mana deduction until cast completes.
    cast(caster, currentTime) {
        // Check if the spell is off cooldown.
        if (!this.canCast(currentTime)) {
            console.log(`${this.name} is on cooldown.`);
            return false;
        }
        // For spells with a cast time, check mana but don't deduct until completion.
        if (this.castTime > 0) {
            if (caster.currentlyCasting) {
                console.log(`${caster.type} is already casting.`);
                return false;
            }
            if (this.manaCost > 0 && caster.mana < this.manaCost) {
                console.log(`Not enough mana for ${this.name}`);
                return false;
            }
            // Special case: Innovation (channel spell) – it will restore mana to max if completed.
            if (this.name === "Innovation") {
                // For Innovation, we don't subtract mana at cast start.
            }
            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost
            };
            console.log(`Started casting ${this.name} for ${caster.type} (${this.castTime} ms)`);
            return true;
        } else {
            // Instant cast: subtract mana immediately.
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

// Function to update an ongoing cast; call each frame.
export function updateCasting(caster, currentTime) {
    if (caster.currentlyCasting) {
        const elapsed = currentTime - caster.currentlyCasting.startTime;
        // For Innovation, we restore mana gradually and then at completion, set mana to max.
        if (caster.currentlyCasting.spell.name === "Innovation") {
            // Gradual restoration could be implemented here if desired.
        }
        if (elapsed >= caster.currentlyCasting.castTime) {
            // For Innovation, if the cast completes, restore mana fully.
            if (caster.currentlyCasting.spell.name === "Innovation") {
                caster.mana = caster.maxMana;
            } else if (caster.currentlyCasting.manaCost > 0) {
                // For other spells, subtract mana cost on completion.
                if (caster.mana >= caster.currentlyCasting.manaCost) {
                    caster.mana -= caster.currentlyCasting.manaCost;
                } else {
                    console.log(`Not enough mana to complete ${caster.currentlyCasting.spell.name}, cast canceled.`);
                    caster.currentlyCasting = null;
                    return;
                }
            }
            caster.currentlyCasting.spell.lastCast = currentTime;
            caster.currentlyCasting.spell.effect(caster);
            console.log(`${caster.currentlyCasting.spell.name} cast by ${caster.type} completed.`);
            // For Innovation, remove the aura.
            if (caster.currentlyCasting.spell.name === "Innovation" && caster.innovationAura) {
                caster.mesh.remove(caster.innovationAura);
                caster.innovationAura = null;
            }
            caster.currentlyCasting = null;
        }
    }
}

/* ==============================
   Mage Spells
   ============================== */
// 1. Fireball – 2 sec cast; orange sphere.
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
                if (!caster.mesh) { console.error("Caster has no mesh"); return; }
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xff4500 });
                const fireball = new THREE.Mesh(geometry, material);
                fireball.position.copy(caster.mesh.position);
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion);
                fireball.userData = {
                    velocity: forward.multiplyScalar(0.2),
                    damage: 10,
                    dot: 5,
                    dotDuration: 4000,
                    type: 'fireball'
                };
                spells.push(fireball);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(fireball);
                }
            }
        });
    }
}

// 2. Frost Bolt – 1.5 sec cast; blue sphere.
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
                if (!caster.mesh) { console.error("Caster has no mesh"); return; }
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshStandardMaterial({ color: 0xadd8e6 });
                const frostbolt = new THREE.Mesh(geometry, material);
                frostbolt.position.copy(caster.mesh.position);
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(caster.mesh.quaternion);
                frostbolt.userData = {
                    velocity: forward.multiplyScalar(0.2),
                    damage: 8,
                    slowAmount: 0.5,
                    slowDuration: 3000,
                    type: 'frostbolt'
                };
                spells.push(frostbolt);
                if (typeof window.scene !== 'undefined') {
                    window.scene.add(frostbolt);
                }
            }
        });
    }
}

// 3. Frost Nova – Instant; ring expands outward.
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
                if (!caster.mesh) { console.error("Caster has no mesh"); return; }
                const geometry = new THREE.RingGeometry(0.5, 0.6, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xadd8e6,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.7
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

// 4. Innovation – 8 sec channel; aura active during channel and restores mana to max on completion.
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
                // When the channel finishes, set mana to max.
                caster.mana = caster.maxMana;
                console.log('Innovation channel completed: Mana fully restored.');
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
            // Immediately add aura to indicate channeling.
            const geometry = new THREE.SphereGeometry(1.5, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: 0x800080,
                transparent: true,
                opacity: 0.5
            });
            const aura = new THREE.Mesh(geometry, material);
            aura.position.set(0, 0, 0);
            caster.mesh.add(aura);
            caster.innovationAura = aura;

            caster.currentlyCasting = {
                spell: this,
                startTime: currentTime,
                castTime: this.castTime,
                channel: this.channel,
                manaCost: this.manaCost
            };
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

// 5. Sheep – 2 sec cast; transforms target.
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
                console.log('Sheep cast: target transformed into a sheep for 7 seconds (damage breaks effect).');
            }
        });
    }
}

/* ==============================
   Warrior Spells (Instant)
   ============================== */
// 1. Charge
export class ChargeSpell extends Spell {
    constructor() {
        super({
            name: 'Charge',
            range: 8,
            cooldown: 5000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Charge cast: target stunned for 2 seconds.');
            }
        });
    }
}

// 2. Thunderclap
export class ThunderclapSpell extends Spell {
    constructor() {
        super({
            name: 'Thunderclap',
            range: 8,
            cooldown: 6000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Thunderclap cast: AoE damage and slow applied.');
            }
        });
    }
}

// 3. Hamstring
export class HamstringSpell extends Spell {
    constructor() {
        super({
            name: 'Hamstring',
            range: 8,
            cooldown: 4000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Hamstring cast: target slowed and damaged.');
            }
        });
    }
}

// 4. Berserk
export class BerserkSpell extends Spell {
    constructor() {
        super({
            name: 'Berserk',
            range: 0,
            cooldown: 10000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Berserk cast: increased attack power and speed for 8 seconds.');
            }
        });
    }
}

// 5. Heroic Strike
export class HeroicStrikeSpell extends Spell {
    constructor() {
        super({
            name: 'Heroic Strike',
            range: 8,
            cooldown: 3000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Heroic Strike cast: deals high damage.');
            }
        });
    }
}

/* ==============================
   Hunter Spells (Instant)
   ============================== */
// 1. Slow Shot
export class SlowShotSpell extends Spell {
    constructor() {
        super({
            name: 'Slow Shot',
            range: 20,
            cooldown: 4000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Slow Shot cast: target slowed.');
            }
        });
    }
}

// 2. Poison Shot
export class PoisonShotSpell extends Spell {
    constructor() {
        super({
            name: 'Poison Shot',
            range: 20,
            cooldown: 5000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Poison Shot cast: target afflicted with DOT for 8 seconds.');
            }
        });
    }
}

// 3. Feint Death – 1 minute channel.
export class FeintDeathSpell extends Spell {
    constructor() {
        super({
            name: 'Feint Death',
            range: 0,
            cooldown: 60000,
            castTime: 60000,
            channel: true,
            manaCost: 0,
            effect: (caster) => {
                console.log('Feint Death cast: hunter is untargetable while channeling.');
            }
        });
    }
}

// 4. Ice Trap
export class IceTrapSpell extends Spell {
    constructor() {
        super({
            name: 'Ice Trap',
            range: 20,
            cooldown: 10000,
            castTime: 0,
            channel: false,
            manaCost: 0,
            effect: (caster) => {
                console.log('Ice Trap cast: trap placed, will freeze target on trigger.');
            }
        });
    }
}

/* ==============================
   Character Classes
   ============================== */
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

export class Warrior extends Character {
    constructor(mesh = null) {
        super('Warrior', mesh);
        this.spells.push(new ChargeSpell());
        this.spells.push(new ThunderclapSpell());
        this.spells.push(new HamstringSpell());
        this.spells.push(new BerserkSpell());
        this.spells.push(new HeroicStrikeSpell());
    }
}

export class Hunter extends Character {
    constructor(mesh = null) {
        super('Hunter', mesh);
        this.spells.push(new SlowShotSpell());
        this.spells.push(new PoisonShotSpell());
        this.spells.push(new FeintDeathSpell());
        this.spells.push(new IceTrapSpell());
    }
}

/* ==============================
   UI Functions for HP, Mana, Cast Bar, and Spell Bar
   ============================== */
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

    // Create a square for each spell in the Mage's spell list.
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

            // Label showing key number and spell name
            const label = document.createElement('div');
            label.innerText = `${index + 1}: ${spell.name}`;
            label.style.color = '#fff';
            label.style.fontSize = '10px';
            label.style.textAlign = 'center';
            label.style.pointerEvents = 'none';
            spellDiv.appendChild(label);

            // Cooldown overlay
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
