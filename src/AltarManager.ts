import * as BABYLON from '@babylonjs/core';
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import { GridManager } from './GridManager';
import { Game } from './Game';
import * as GUI from '@babylonjs/gui';

// Interface for altar configuration
export interface AltarConfig {
    position: BABYLON.Vector3;
    gridPosition: BABYLON.Vector3;
    scale?: number;
    color?: BABYLON.Color3;
    solved?: boolean;
}

export class AltarManager {
    private scene: BABYLON.Scene;
    private altars: Map<string, BABYLON.Mesh> = new Map();
    private altarConfigs: Map<string, AltarConfig> = new Map();
    private activeAltarId: string | null = null;
    private gridManager: GridManager;
    private interactionDistance: number = 3; // How close player needs to be to interact
    
    // Level management
    private allLevels: any[] = [];
    private solvedLevelIds: string[] = [];
    private currentLevelIndex: number = 0;
    
    // Materials
    private defaultMaterial: BABYLON.StandardMaterial;
    private activeMaterial: BABYLON.StandardMaterial;
    private solvedMaterial: BABYLON.StandardMaterial;
    
    // Callback for altar activation
    private onAltarActivatedCallback: ((altarId: string) => void) | null = null;
    
    private game: Game;
    private isInitialized: boolean = false;
    
    constructor(scene: BABYLON.Scene, gridManager: GridManager, game: Game) {
        this.scene = scene;
        this.gridManager = gridManager;
        this.game = game;
        
        // Load saved progress
        const saved = localStorage.getItem('solvedLevelIds');
        if (saved) {
            this.solvedLevelIds = JSON.parse(saved);
        }
        
        // Create materials
        this.createMaterials();
        
        // Load levels from JSON and mark as initialized when done
        this.loadLevels().then(() => {
            this.isInitialized = true;
            console.log('AltarManager fully initialized');
        });
    }
    
    private createMaterials(): void {
        // Default altar material
        this.defaultMaterial = new BABYLON.StandardMaterial("altarDefaultMat", this.scene);
        this.defaultMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.6); // Bluish-gray
        this.defaultMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        
        // Active altar material
        this.activeMaterial = new BABYLON.StandardMaterial("altarActiveMat", this.scene);
        this.activeMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.9); // Bright blue
        this.activeMaterial.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        this.activeMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5); // Slight glow
        
        // Solved altar material
        this.solvedMaterial = new BABYLON.StandardMaterial("altarSolvedMat", this.scene);
        this.solvedMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.2); // Golden
        this.solvedMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.3);
        this.solvedMaterial.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.1); // Stronger glow
    }
    
    private async loadLevels(): Promise<void> {
        try {
            const response = await fetch('levels/levels.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.allLevels = await response.json();
            console.log(`Loaded ${this.allLevels.length} levels from JSON`);
            console.log('First few level IDs:', this.allLevels.slice(0, 5).map(l => l.id));
            console.log('Currently solved level IDs:', this.solvedLevelIds);
        } catch (error) {
            console.error('Failed to load levels from JSON:', error);
            // Fallback to empty array or hardcoded levels if needed
            this.allLevels = [];
        }
    }

    private pickRandomUnsolvedLevel(): any | null {
        console.log(`pickRandomUnsolvedLevel called. Total levels: ${this.allLevels.length}, Solved: ${this.solvedLevelIds.length}`);
        
        const unsolvedLevels = this.allLevels.filter(level => 
            this.solvedLevelIds.indexOf(level.id) === -1
        );
        
        console.log(`Unsolved levels found: ${unsolvedLevels.length}`);
        
        if (unsolvedLevels.length === 0) {
            console.log('All levels completed!');
            console.log('Solved level IDs:', this.solvedLevelIds);
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * unsolvedLevels.length);
        const selectedLevel = unsolvedLevels[randomIndex];
        console.log(`Selected random level: ${selectedLevel.id}`);
        return selectedLevel;
    }

    private markLevelSolved(levelId: string): void {
        if (this.solvedLevelIds.indexOf(levelId) === -1) {
            this.solvedLevelIds.push(levelId);
            // Save progress
            localStorage.setItem('solvedLevelIds', JSON.stringify(this.solvedLevelIds));
        }
    }
    
    // Create an altar with the given configuration
    public createAltar(id: string, config: AltarConfig): void {
        // Store the configuration
        this.altarConfigs.set(id, {
            ...config,
            scale: config.scale || 1,
            color: config.color || new BABYLON.Color3(0.4, 0.4, 0.6),
            solved: config.solved || false
        });

        // Define a color palette for GlowRings
        const glowColors = [
            new BABYLON.Color3(1, 0.2, 0.2), // Red
            new BABYLON.Color3(0.2, 1, 0.2), // Green
            new BABYLON.Color3(0.2, 0.4, 1), // Blue
            new BABYLON.Color3(1, 1, 0.2),   // Yellow
            new BABYLON.Color3(0.8, 0.2, 1)  // Purple
        ];
        // Pick color based on altar index (id is altar_1, altar_2, ...)
        const altarIndex = parseInt(id.replace('altar_', '')) - 1;
        const glowColor = glowColors[altarIndex % glowColors.length];

        // Load altar_beta.glb model
        BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "models/",
            "altar_beta.glb",
            this.scene
        ).then(result => {
            console.log(`Loaded altar model for ${id}, meshes:`, result.meshes.length);
            
            const altar = result.meshes[0] as BABYLON.Mesh;
            if (!altar) {
                console.error(`No mesh found in altar model for ${id}`);
                return;
            }

            console.log(`Altar mesh vertices:`, altar.getTotalVertices());
            
            altar.name = `altar_${id}`;
            altar.position = config.position.clone();
            altar.scaling = new BABYLON.Vector3(
                config.scale || 1,
                config.scale || 1,
                config.scale || 1
            );
            altar.rotation = new BABYLON.Vector3(0, Math.PI / 6, 0);

            // Set GlowRing color (clone PBR material and set both albedoColor and emissiveColor)
            const glowRing = altar.getChildMeshes().find(m => m.name.includes('GlowRing'));
            if (glowRing && glowRing.material) {
                glowRing.material = glowRing.material.clone(`altar_${id}_glowMat`);
                const mat = glowRing.material as BABYLON.PBRMaterial;
                mat.albedoColor = glowColor;
                mat.emissiveColor = glowColor;
            }

            // Apply material based on solved state (optional, if you want to keep this logic)
            if (config.solved) {
                altar.material = this.solvedMaterial.clone(`altar_${id}_solvedMat`);
            } else {
                altar.material = this.defaultMaterial.clone(`altar_${id}_defaultMat`);
                if (config.color) {
                    (altar.material as BABYLON.StandardMaterial).diffuseColor = config.color;
                }
            }

            // Add metadata for interaction
            altar.metadata = {
                type: 'altar',
                id: id,
                interactionRadius: this.interactionDistance
            };

            try {
                // Add physics to the main altar mesh using BOX shape
                const aggregate = new PhysicsAggregate(
                    altar,
                    PhysicsShapeType.BOX,
                    { 
                        mass: 0,
                        friction: 0.5,
                        restitution: 0.2
                    },
                    this.scene
                );

                // Add physics to child meshes using BOX shape
                altar.getChildMeshes().forEach(childMesh => {
                    if (childMesh instanceof BABYLON.Mesh) {
                        try {
                            const childAggregate = new PhysicsAggregate(
                                childMesh,
                                PhysicsShapeType.BOX,
                                { 
                                    mass: 0,
                                    friction: 0.5,
                                    restitution: 0.2
                                },
                                this.scene
                            );
                        } catch (childError) {
                            console.warn(`Failed to add physics to child mesh ${childMesh.name}:`, childError);
                        }
                    }
                });

                console.log(`Successfully added physics to altar ${id}`);
            } catch (physicsError) {
                console.error(`Failed to add physics to altar ${id}:`, physicsError);
            }

            // Create text label
            this.createAltarLabel(id, altar);

            // Store the altar
            this.altars.set(id, altar);

            // Create a subtle particle system for the altar
            this.createAltarParticles(id, altar, config.solved);
        }).catch(error => {
            console.error(`Failed to load altar model for ${id}:`, error);
        });
    }
    
    private createAltarParticles(id: string, altar: BABYLON.Mesh, solved: boolean): void {
        // Create a particle system
        const particleSystem = new BABYLON.ParticleSystem(`altar_${id}_particles`, 100, this.scene);
        
        // Particle texture (optional, can be a simple dot or removed)
        // particleSystem.particleTexture = new BABYLON.Texture("textures/flare.png", this.scene);
        
        // Where the particles come from
        particleSystem.emitter = altar.position.clone();
        particleSystem.emitter.y += 1; // From the top of the altar
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);
        
        // Colors
        if (solved) {
            particleSystem.color1 = new BABYLON.Color4(0.9, 0.8, 0.1, 1);
            particleSystem.color2 = new BABYLON.Color4(0.8, 0.7, 0.2, 1);
        } else {
            particleSystem.color1 = new BABYLON.Color4(0.3, 0.5, 0.8, 1);
            particleSystem.color2 = new BABYLON.Color4(0.2, 0.4, 0.7, 1);
        }
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        // Size and lifetime
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        particleSystem.minLifeTime = 1;
        particleSystem.maxLifeTime = 2;
        
        // Emission rate
        particleSystem.emitRate = 10;
        
        // Blend mode
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        // Direction and gravity
        particleSystem.direction1 = new BABYLON.Vector3(-0.1, 1, -0.1);
        particleSystem.direction2 = new BABYLON.Vector3(0.1, 1, 0.1);
        particleSystem.gravity = new BABYLON.Vector3(0, -0.1, 0);
        
        // Start the particle system
        particleSystem.start();
    }
    
    // Create a text label for the altar
    private createAltarLabel(id: string, altar: BABYLON.Mesh): void {
        const plane = BABYLON.MeshBuilder.CreatePlane(
            `label_${id}`,
            { width: 3, height: 1 },
            this.scene
        );
        plane.parent = altar;
        plane.position = new BABYLON.Vector3(0, 2.2, 0);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        const texture = new BABYLON.DynamicTexture(
            `labelTexture_${id}`,
            { width: 1024, height: 256 },
            this.scene,
            true
        );
        const material = new BABYLON.StandardMaterial(`labelMaterial_${id}`, this.scene);
        material.diffuseTexture = texture;
        material.specularColor = BABYLON.Color3.Black();
        material.emissiveColor = BABYLON.Color3.White();
        material.backFaceCulling = false;
        plane.material = material;
        const labelText = id.replace('altar_', 'Altar ');
        texture.drawText(
            labelText,
            null,
            180,
            "bold 120px Arial",
            "white",
            "transparent",
            true
        );
    }
    
    // Check if player is close enough to interact with any altar
    public checkPlayerInteraction(playerPosition: BABYLON.Vector3): string | null {
        let closestAltarId: string | null = null;
        let closestDistance: number = this.interactionDistance;
        
        // Check each altar
        for (const [id, altar] of this.altars.entries()) {
            const distance = BABYLON.Vector3.Distance(altar.position, playerPosition);
            
            // If this altar is closer than our current closest and within interaction distance
            if (distance < closestDistance) {
                closestDistance = distance;
                closestAltarId = id;
            }
        }
        
        return closestAltarId;
    }
    
    // Activate an altar (show the grid)
    public activateAltar(id: string): boolean {
        if (!this.altars.has(id)) {
            console.error(`Altar ${id} does not exist`);
            return false;
        }
        
        if (this.activeAltarId) {
            this.deactivateAltar();
        }
        
        const altar = this.altars.get(id)!;
        const config = this.altarConfigs.get(id)!;
        
        if (config.solved) {
            console.log(`Altar ${id} is already solved`);
            return false;
        }

        // Check if levels are loaded
        if (this.allLevels.length === 0) {
            console.log('Levels not loaded yet, waiting...');
            // Try to reload levels and then activate
            this.loadLevels().then(() => {
                this.activateAltar(id);
            });
            return false;
        }

        // Pick a random unsolved level instead of using hardcoded puzzle configs
        const selectedLevel = this.pickRandomUnsolvedLevel();
        if (!selectedLevel) {
            console.log('No more levels available');
            return false;
        }

        console.log(`Selected level: ${selectedLevel.id} for altar ${id}`);

        if (id === 'altar_5') {
            // Turn off all lights except playerLight
            this.scene.lights.forEach(light => {
                if (light.name !== 'playerLight') {
                    light.intensity = 0;
                }
            });

            // Remove environment texture/skybox
            this.scene.environmentTexture = null;

            // Make altar 5 almost black
            if (altar.material && altar.material instanceof BABYLON.StandardMaterial) {
                altar.material.diffuseColor = new BABYLON.Color3(0.01, 0.01, 0.02);
                altar.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
                altar.material.specularColor = new BABYLON.Color3(0, 0, 0);
            }

            if (!this.scene.getLightByName('playerLight')) {
                const playerLight = new BABYLON.PointLight(
                    'playerLight',
                    new BABYLON.Vector3(0, 2, 0),
                    this.scene
                );
                playerLight.intensity = 4.0;
                playerLight.range = 4;
                playerLight.diffuse = new BABYLON.Color3(0.7, 0.7, 1.0);
                playerLight.specular = new BABYLON.Color3(0.3, 0.3, 0.6);

                const player = this.scene.getMeshByName('player');
                if (player) {
                    playerLight.parent = player;
                }
            }
        }
        
        altar.material = this.activeMaterial.clone(`altar_${id}_activeMat`);
        
        // Use the selected level data instead of hardcoded puzzle config
        const altarIndex = parseInt(id.replace('altar_', ''));
        const platformMeshName = `IslandPlatform_${altarIndex}`;

        this.gridManager.createGrid(
            config.gridPosition,
            selectedLevel.gridSize,
            selectedLevel.regions,
            platformMeshName
        );
        this.gridManager.setVisible(true);
        
        this.activeAltarId = id;
        
        // Store the current level ID for when it's solved
        (altar as any)._currentLevelId = selectedLevel.id;
        
        if (this.onAltarActivatedCallback) {
            this.onAltarActivatedCallback(id);
        }
        
        const glowRing = altar.getChildMeshes().find(m => m.name.includes('GlowRing'));
        if (glowRing && glowRing.material) {
            const mat = glowRing.material as BABYLON.PBRMaterial;
            const anim = new BABYLON.Animation(
                `glowPulse_${id}`,
                "emissiveColor",
                60,
                BABYLON.Animation.ANIMATIONTYPE_COLOR3,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            const original = mat.emissiveColor.clone();
            const keys = [
                { frame: 0, value: original },
                { frame: 20, value: original.scale(2) }
            ];
            anim.setKeys(keys);
            mat.animations = [];
            mat.animations.push(anim);
            this.scene.beginAnimation(mat, 0, 20, false);
            (glowRing as any)._originalEmissive = original;
        }
        
        this.game.focusOnPuzzle(config.gridPosition);
        
        return true;
    }
    
    // Deactivate the current altar (hide the grid)
    public deactivateAltar(): void {
        if (!this.activeAltarId) return;
        
        // Get the altar and its config
        const altar = this.altars.get(this.activeAltarId)!;
        const config = this.altarConfigs.get(this.activeAltarId)!;
        
        // If we're deactivating altar_5, restore normal lighting
        if (this.activeAltarId === 'altar_5') {
            this.scene.lights.forEach(light => {
                if (light instanceof BABYLON.HemisphericLight) {
                    light.intensity = 1; // Restore normal light intensity
                }
            });
            
            // Remove the player light
            const playerLight = this.scene.getLightByName('playerLight');
            if (playerLight) {
                playerLight.dispose();
            }
        }
        
        // Reset the altar material
        if (config.solved) {
            altar.material = this.solvedMaterial.clone(`altar_${this.activeAltarId}_solvedMat`);
        } else {
            altar.material = this.defaultMaterial.clone(`altar_${this.activeAltarId}_defaultMat`);
            if (config.color) {
                (altar.material as BABYLON.StandardMaterial).diffuseColor = config.color;
            }
        }
        
        // Hide and reset the grid
        this.gridManager.resetGrid();
        this.gridManager.setVisible(false);
        
        // Clear the active altar
        this.activeAltarId = null;

        // Find the GlowRing child mesh
        const glowRing = altar.getChildMeshes().find(m => m.name.includes('GlowRing'));

        if (glowRing && glowRing.material) {
            const mat = glowRing.material as BABYLON.PBRMaterial;

            // Animate back to original
            const anim = new BABYLON.Animation(
                `glowReset_${this.activeAltarId}`,
                "emissiveColor",
                60,
                BABYLON.Animation.ANIMATIONTYPE_COLOR3,
                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
            );

            const original = (glowRing as any)._originalEmissive || mat.emissiveColor.clone();

            const keys = [
                { frame: 0, value: mat.emissiveColor.clone() },
                { frame: 20, value: original }
            ];

            anim.setKeys(keys);

            mat.animations = [];
            mat.animations.push(anim);
            this.scene.beginAnimation(mat, 0, 20, false);
        }

        // Switch caméra pour l'exploration
        const player = this.scene.getMeshByName('player');
        if (player) {
            this.game.focusOnPlayer(player.position);
        }
    }
    
    // Mark an altar as solved
    public markAltarSolved(id: string): void {
        // Make sure the altar exists
        if (!this.altars.has(id)) {
            console.error(`Altar ${id} does not exist`);
            return;
        }
        
        // Get the altar and its config
        const altar = this.altars.get(id)!;
        const config = this.altarConfigs.get(id)!;
        
        // Update config
        config.solved = true;
        this.altarConfigs.set(id, config);
        
        // Update material
        altar.material = this.solvedMaterial.clone(`altar_${id}_solvedMat`);
        
        // Create celebration particles
        this.createSolvedEffect(altar);
    }
    
    // Create visual effects when an altar is solved
    private createSolvedEffect(altar: BABYLON.Mesh): void {
        // Create a bigger particle burst
        const particleSystem = new BABYLON.ParticleSystem("solvedParticles", 500, this.scene);
        // particleSystem.particleTexture = new BABYLON.Texture("textures/flare.png", this.scene);
        
        // Position
        particleSystem.emitter = altar.position.clone();
        particleSystem.emitter.y += 1; // Top of altar
        
        // Appearance
        particleSystem.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1);
        particleSystem.color2 = new BABYLON.Color4(0.9, 0.7, 0.2, 1);
        particleSystem.colorDead = new BABYLON.Color4(0.5, 0.4, 0.1, 0);
        
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;
        
        particleSystem.minLifeTime = 1;
        particleSystem.maxLifeTime = 3;
        
        // Behavior
        particleSystem.emitRate = 200;
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        
        particleSystem.direction1 = new BABYLON.Vector3(-1, 5, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 5, 1);
        
        particleSystem.minEmitPower = 3;
        particleSystem.maxEmitPower = 5;
        
        particleSystem.updateSpeed = 0.01;
        
        particleSystem.gravity = new BABYLON.Vector3(0, -9.8, 0);
        
        // Start emitting with auto-stop
        particleSystem.start();
        particleSystem.targetStopDuration = 2;
        
        // Add a subtle glow to the altar (can be done with a highlight layer)
        const highlightLayer = new BABYLON.HighlightLayer("highlightLayer", this.scene);
        highlightLayer.addMesh(altar, new BABYLON.Color3(1, 0.8, 0.1));
        
        // Remove highlight after a while
        setTimeout(() => {
            highlightLayer.dispose();
        }, 5000);
    }
    
    // Get the active altar ID
    public getActiveAltarId(): string | null {
        return this.activeAltarId;
    }
    
    // Check if puzzle is solved for a specific altar
    public isAltarSolved(id: string): boolean {
        const config = this.altarConfigs.get(id);
        return config ? config.solved : false;
    }
    
    // Notify that a puzzle was solved (used by Game.ts)
    public onPuzzleSolved(): void {
        if (!this.activeAltarId) return;
        
        const altar = this.altars.get(this.activeAltarId)!;
        const currentLevelId = (altar as any)._currentLevelId;
        
        if (currentLevelId) {
            this.markLevelSolved(currentLevelId);
            console.log(`Level ${currentLevelId} marked as solved`);
        }
        
        this.markAltarSolved(this.activeAltarId);
        this.deactivateAltar();
    }
    
    // Set callback for altar activation
    public setOnAltarActivatedCallback(callback: (altarId: string) => void): void {
        this.onAltarActivatedCallback = callback;
    }
    
    // Method to clear all progress (useful for debugging)
    public clearProgress(): void {
        this.solvedLevelIds = [];
        localStorage.removeItem('solvedLevelIds');
        console.log('Progress cleared!');
    }
}