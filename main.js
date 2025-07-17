// main.js

// Utility function to add a static hint to the map
function addHint(scene, x, y, message) {
    const hint = scene.add.text(x, y, message, {
        fontFamily: 'Graduate, Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        fill: '#ffe066', // bright yellow
        padding: { x: 24, y: 12 },
        align: 'center',
        stroke: '#ff9800',
        strokeThickness: 8,
        shadow: {
            offsetX: 4,
            offsetY: 4,
            color: '#000',
            blur: 8,
            fill: true
        }
    }).setScrollFactor(1);
    hint.setAngle(-35);
    return hint;
}

// Utility function to add a treat that can be collected by the player
function addTreat(scene, x, y, hintMessage, player) {
    // Add the treat sprite using the first frame of DogItems.png (or override in main)
    const treat = scene.physics.add.sprite(x, y, 'dogitems', 0).setOrigin(0.5, 0.5).setScrollFactor(1);
    treat.body.setAllowGravity(false);
    // Overlap detection
    scene.physics.add.overlap(player, treat, function collectTreat() {
        treat.destroy();
        // Play crunch sound
        if (scene.sound && scene.cache.audio.exists('crunch')) {
            scene.sound.play('crunch');
        }
        const hint = addHint(scene, x, y - 30, hintMessage);
        scene.time.delayedCall(1, () => {
            hint.destroy();
        });
        // Update food bar
        food = Math.min(food + 1, maxFood);
        updateFoodBar();
    }, null, scene);
    return treat;
}

document.getElementById('playBtn').onclick = function () {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    // document.getElementById('coin-audio').play();
    // Removed DOM coin-audio play
    startGame();
};

function startGame() {
    const config = {
        type: Phaser.AUTO,
        width: 1080,
        height: 800,
        backgroundColor: '#23272e',
        parent: 'game-container',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scene: {
            preload: preload,
            create: create,
            update: update
        }
    };

    const game = new Phaser.Game(config);
    let player;
    let cursors;
    let moving = false;
    let isDowning = false;
    let food = 0;
    let foodBarBg, foodBarFill, foodBarText;
    const maxFood = 10;
    let autoPoopTimer = null;
    let poopOverlay, poopText;

    function preload() {
        // Use the selected avatar key from the window (set in index.html)
        const avatarKey = window.selectedAvatar || 'san';
        this.load.spritesheet('walk', `assets/${avatarKey}/avatar/Walk.png`, { frameWidth: 48, frameHeight: 48 });
        this.load.spritesheet('idle', `assets/${avatarKey}/avatar/Idle.png`, { frameWidth: 48, frameHeight: 48 });
        this.load.spritesheet('attack', `assets/${avatarKey}/avatar/Attack.png`, { frameWidth: 48, frameHeight: 48 });

        // Load background tiles
        this.load.text('tilemap', 'assets/tilemap.csv');
        this.load.image('grass', 'assets/tiles/grass.png');
        this.load.image('dirt', 'assets/tiles/dirt.png');
        this.load.image('top_wall', 'assets/tiles/top_wall.png');
        this.load.image('left_wall', 'assets/tiles/left_wall.png');
        this.load.image('top_left_corner', 'assets/tiles/top_left_corner.png');
        // Load DogItems.png as a spritesheet for treats
        this.load.spritesheet('dogitems', 'assets/san/DogItems.png', { frameWidth: 32, frameHeight: 32 });
        // Load bark sound for the avatar
        this.load.audio('crunch', 'assets/san/avatar/crunch.mp3');
        this.load.audio('bark', 'assets/san/avatar/dog-bark.mp3');
        // ...load all tile types you use
        // Set world gravity for jumping
        this.physics.world.gravity.y = 1000;
        this.load.image('background', 'assets/background.png');
        this.load.image('dog-bone', 'assets/san/items/dog-bone.png');
        this.load.image('dog-bone2', 'assets/san/items/dog-bone2.png');
        this.load.image('dog-chicken-leg', 'assets/san/items/dog-chicken-leg.png');
        this.load.image('dog-chicken', 'assets/san/items/dog-chicken.png');
        this.load.image('dog-meat', 'assets/san/items/dog-meat.png');
        this.load.image('poop', 'assets/san/items/poop.png');
    }

    function create() {
        // Add repeating background FIRST so it's at the back
        const worldWidth = 3200;
        const worldHeight = 800;
        const bg = this.add.tileSprite(0, 0, worldWidth, worldHeight, 'background')
            .setOrigin(0)
            .setScrollFactor(0.5)
            .setDepth(-100); // Always behind everything

        // Draw the CSV tilemap first, at the very back
        /*
        const tileSize = 64;
        const csv = this.cache.text.get('tilemap');
        const mapRows = csv.trim().split('\n');
        for (let y = 0; y < mapRows.length; y++) {
            const mapCols = mapRows[y].split(',');
            for (let x = 0; x < mapCols.length; x++) {
                const tileType = mapCols[x].trim();
                if (tileType) {
                    this.add.image(x * tileSize, y * tileSize, tileType)
                        .setOrigin(0)
                        .setScrollFactor(1)
                        .setDepth(-2);
                }
            }
        }
        */

        // Add a hint near the starting position
        // addHint(this, 200, 100, 'Welcome to our Interactive Docs!');
        // addHint(this, 200, 100, 'Collect the Treats to learn more!');
        // Start player at bottom left
        const avatarKey = window.selectedAvatar || 'san';
        player = this.physics.add.sprite(0, 800 - 24, 'idle'); // y = 800 - half sprite height
        if (avatarKey === 'san') {
            player.setScale(1.3);
        } else {
            player.setScale(1);
        }
        player.play('idle');
        player.setCollideWorldBounds(true);
        player.body.setAllowGravity(true);
        player.body.setMaxVelocity(400, 800);

        // Create walk animation (frames 0-3)
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'idle',
            frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'attack',
            frames: this.anims.generateFrameNumbers('attack', { start: 0, end: 3 }),
            frameRate: 12,
            repeat: 0
        });
        // Poop animation: Death frames 1-2, Walk frames 3 and 6
        this.anims.create({
            key: 'poop',
            frames: [
                { key: 'death', frame: 1 },
                { key: 'death', frame: 2 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 3 },
                { key: 'walk', frame: 6 }
            ],
            frameRate: 4,
            repeat: 0
        });
        this.anims.create({
            key: 'death',
            frames: this.anims.generateFrameNumbers('death', { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });

        cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.addKeys('W,S,A,D');

        // Set world bounds for a wide, less tall world
        const margin = 16;
        this.physics.world.setBounds(0, 0, 3200, 800 - margin);
        this.cameras.main.setBounds(0, 0, 3200, 800);
        this.cameras.main.startFollow(player, true, 0.08, 0.08);


        // Add a random number of treats with 'YUM!' message at random positions
        const itemKeys = [
            'dog-bone', 'dog-bone2', 'dog-chicken-leg', 'dog-chicken', 'dog-meat' // Replace with actual keys for each image in assets/dogs/items/*
        ];
        const numTreats = 30;
        for (let i = 0; i < numTreats; i++) {
            const x = Phaser.Math.Between(0, 3200); // world width
            const y = Phaser.Math.Between(600, 800); // height between 600 and 800
            const itemKey = Phaser.Utils.Array.GetRandom(itemKeys);
            // Add the treat using the random item image
            const treat = this.physics.add.sprite(x, y, itemKey).setOrigin(0.5, 0.5).setScrollFactor(1);
            treat.body.setAllowGravity(false);
            this.physics.add.overlap(player, treat, function collectTreat() {
                treat.destroy();
                // Play crunch sound using Phaser
                if (this.sound && this.cache.audio.exists('crunch')) {
                    this.sound.play('crunch');
                }
                const hint = addHint(this, x, y - 30, 'YUM!');
                this.time.delayedCall(500, () => {
                    hint.destroy();
                });
                // Update food bar
                food += 1;
                updateFoodBar();
            }, null, this);
        }

        // Food bar UI (yellow pill) at top right
        const barWidth = 200;
        const barHeight = 32;
        const barX = 1080 - barWidth - 32; // 32px from right
        const barY = 32;
        // Background (gray pill)
        foodBarBg = this.add.graphics();
        foodBarBg.fillStyle(0x444444, 0.7);
        foodBarBg.fillRoundedRect(barX, barY, barWidth, barHeight, barHeight / 2);
        foodBarBg.setScrollFactor(0);
        // Fill (yellow pill)
        foodBarFill = this.add.graphics();
        foodBarFill.fillStyle(0xffe066, 1);
        foodBarFill.fillRoundedRect(barX, barY, 0, barHeight, barHeight / 2);
        foodBarFill.setScrollFactor(0);
        // Text
        foodBarText = this.add.text(barX + barWidth / 2, barY + barHeight / 2, `Food: 0/${maxFood}`, {
            font: '20px Graduate, Arial',
            fill: '#222',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0);

        // POOP TIME! overlay (top half of screen)
        poopOverlay = this.add.graphics();
        poopOverlay.fillStyle(0x222c36, 0.85);

        poopOverlay.setScrollFactor(0);
        poopOverlay.setDepth(1000);
        poopOverlay.setVisible(false);
        poopText = this.add.text(540, 200, '', {
            fontFamily: 'Graduate, Arial, sans-serif',
            fontSize: '72px',
            fontStyle: 'bold',
            fill: '#ffe066',
            stroke: '#ff9800',
            strokeThickness: 10,
            shadow: {
                offsetX: 6,
                offsetY: 6,
                color: '#000',
                blur: 12,
                fill: true
            },
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setAngle(-10).setVisible(false);

        // Controls overlay (top left corner)
        const controlsText = [
            'CONTROLS:',
            '←/→ or A/D: Move',
            'W: Bark',
            'S: Poop',
            'SHIFT: Sprint (if not overfed)',
            'Space: Jump',
            '',
            'Eat treats to fill food bar',
            'Over 10 food: auto-poop!'
        ].join('\n');
        this.add.text(24, 24, controlsText, {
            fontFamily: 'Graduate, Arial, sans-serif',
            fontSize: '18px',
            fill: '#cccccc',
            align: 'left',
            backgroundColor: 'rgba(34,44,54,0.3)',
            padding: { x: 12, y: 8 },
        }).setScrollFactor(0).setDepth(2000);
    }

    function updateFoodBar() {
        const barWidth = 200;
        const barHeight = 32;
        const barX = 1080 - barWidth - 32;
        const barY = 32;
        foodBarFill.clear();
        let fillWidth, fillColor;
        if (food <= maxFood) {
            fillWidth = (food / maxFood) * barWidth;
            fillColor = 0xffe066; // yellow
        } else {
            fillWidth = barWidth;
            fillColor = 0xff4444; // red
        }
        foodBarFill.fillStyle(fillColor, 1);
        foodBarFill.fillRoundedRect(barX, barY, fillWidth, barHeight, barHeight / 2);
        foodBarText.setText(`Food: ${food}/${maxFood}`);
    }

    let isAttacking = false;
    let lastDirection = 'right'; // Track last horizontal direction
    let isPooping = false;
    let wasdJumping = false;

    function tryPoop(scene) {
        if (isPooping || isAttacking) return;
        isPooping = true;
        // Random duration between 2 and 5 seconds
        const poopDuration = Phaser.Math.Between(2000, 5000);
        player.anims.play('poop');
        player.anims.chain('poop');
        scene.time.delayedCall(poopDuration, () => {
            isPooping = false;
            // Poop success logic
            const avatarKey = window.selectedAvatar || 'san';
            let poopChance = avatarKey === 'azuki' ? 1.0 : Math.min(0.05 + 0.01 * food, 1.0);
            if (Math.random() < poopChance) {
                food = Math.round(Math.random() * maxFood);
                updateFoodBar();
                scene.add.image(player.x, player.y + player.height / 2, 'poop')
                    .setOrigin(0.5, 1)
                    .setDepth(-1)
                    .setScale(0.7);
            }
            if (moving) {
                player.anims.play('walk', true);
            } else {
                player.anims.play('idle', true);
            }
        });
    }

    function update() {
        let speed = 200;
        const shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        const sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);


        if (food > 10) {
            speed = 100; // half speed
            // Sprint disabled
        } else {
            const avatarKey = window.selectedAvatar || 'san';
            if (shiftKey.isDown) {
                if (avatarKey === 'azuki') {
                    speed = 800;
                } else {
                    speed = 400;
                }
            }
        }
        if (isPooping) {
            speed = 20;
        }
        let vx = 0;
        moving = false;

        // Classic platformer movement: gravity always on
        player.body.setAllowGravity(true);
        if (cursors.left.isDown || this.input.keyboard.keys[65].isDown) {
            vx = -speed;
            moving = true;
            if (lastDirection !== 'left') {
                player.setFlipX(true);
                lastDirection = 'left';
            }
        } else if (cursors.right.isDown || this.input.keyboard.keys[68].isDown) {
            vx = speed;
            moving = true;
            if (lastDirection !== 'right') {
                player.setFlipX(false);
                lastDirection = 'right';
            }
        }
        player.setVelocityX(vx);

        // Jump on Space (only if on ground)
        if (!isPooping && Phaser.Input.Keyboard.JustDown(spaceKey) && player.body.blocked.down) {
            player.setVelocityY(-500);
        }

        // Auto-poop logic
        if (food > 10 && !autoPoopTimer) {
            autoPoopTimer = this.time.addEvent({
                delay: 2000,
                callback: () => tryPoop(this),
                callbackScope: this,
                loop: true
            });
        } else if (food <= 10 && autoPoopTimer) {
            autoPoopTimer.remove();
            autoPoopTimer = null;
        }

        // Poop on S key
        if (!isDowning && Phaser.Input.Keyboard.JustDown(sKey) && !isPooping && !isAttacking) {
            tryPoop(this);
        }

        // Only play idle/walk/attack if not pooping or downing
        if (!isPooping && !isDowning) {
            if (Phaser.Input.Keyboard.JustDown(wKey) && !isAttacking) {
                isAttacking = true;
                // Play bark sound
                if (this.sound && this.cache.audio.exists('bark')) {
                    this.sound.play('bark');
                }
                player.anims.play('attack');
                player.once('animationcomplete', () => {
                    isAttacking = false;
                    if (moving) {
                        player.anims.play('walk', true);
                    } else {
                        player.anims.play('idle', true);
                    }
                });
            } else if (
                Phaser.Input.Keyboard.JustDown(sKey) &&
                !isAttacking &&
                !moving &&
                player.body.blocked.down // not jumping
            ) {
                console.log('Death animation triggered');
                isAttacking = true;
                player.anims.play('death'); // Play death animation once
                player.once('animationcomplete', () => {
                    isAttacking = false;
                    player.anims.play('idle', true);
                });
            } else if (!isAttacking) {
                if (moving) {
                    player.anims.play('walk', true);
                } else {
                    player.anims.play('idle', true);
                }
            }
        }

        // Show/hide POOP TIME! overlay
        if (poopOverlay && poopText) {
            poopOverlay.setVisible(isPooping);
            poopText.setVisible(isPooping);
            if (isPooping) {
                const avatarKey = window.selectedAvatar || 'san';
                poopText.setText(avatarKey === 'azuki' ? 'URESYON!' : 'POOP TIME!');
            }
        }
    }
} 