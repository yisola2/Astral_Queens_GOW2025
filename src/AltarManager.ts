import * as BABYLON from '@babylonjs/core';
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import { GridManager } from './GridManager';

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
    
    // Materials
    private defaultMaterial: BABYLON.StandardMaterial;
    private activeMaterial: BABYLON.StandardMaterial;
    private solvedMaterial: BABYLON.StandardMaterial;
    
    // Callback for altar activation
    private onAltarActivatedCallback: ((altarId: string) => void) | null = null;
    
    constructor(scene: BABYLON.Scene, gridManager: GridManager) {
        this.scene = scene;
        this.gridManager = gridManager;
        
        // Create materials
        this.createMaterials();
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
        // Create a plane to hold the text
        const plane = BABYLON.MeshBuilder.CreatePlane(
            `label_${id}`,
            { width: 1, height: 0.3 },
            this.scene
        );

        // Position the plane above the altar
        plane.parent = altar;
        plane.position = new BABYLON.Vector3(0, 1.5, 0);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create dynamic texture for the text
        const texture = new BABYLON.DynamicTexture(
            `labelTexture_${id}`,
            { width: 256, height: 64 },
            this.scene,
            true
        );
        const textContext = texture.getContext();

        // Create material for the plane
        const material = new BABYLON.StandardMaterial(`labelMaterial_${id}`, this.scene);
        material.diffuseTexture = texture;
        material.specularColor = BABYLON.Color3.Black();
        material.emissiveColor = BABYLON.Color3.White();
        material.backFaceCulling = false;
        plane.material = material;

        // Draw the text
        texture.drawText(
            id.replace('altar_', 'Altar '),
            null,
            50,
            "bold 40px Arial",
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
    // In AltarManager.ts or Game.ts
    private puzzleConfigurations = [
        {
        id: "altar_1",
        gridSize: 7,
        // The region layout - each number represents a region ID
        regions: [
            [0, 0, 0, 1, 1, 1, 1],
            [2, 2, 0, 1, 1, 1, 1],
            [2, 2, 0, 0, 3, 3, 3],
            [2, 3, 3, 3, 4, 4, 3],
            [2, 3, 5, 5, 3, 3, 3],
            [2, 5, 5, 5, 6, 3, 3],
            [2, 5, 5, 5, 6, 6, 6]
        ]
        },
        {
        id: "altar_2",
        gridSize: 5,
        regions: [
            [0, 0, 2, 2, 2],
            [0, 0, 2, 2, 2],
            [3, 1, 1, 6, 6],
            [3, 1, 1, 6, 6],
            [3, 3, 1, 1, 6]
        ]
        },
        {
        id: "altar_3",
        gridSize: 8,
        regions: [
            [0, 0, 0, 0, 5, 5, 5, 5],
            [0, 1, 1, 0, 5, 6, 6, 5],
            [0, 0, 1, 1, 6, 6, 7, 5],
            [0, 0, 0, 2, 6, 7, 7, 5],
            [0, 0, 3, 3, 3, 3, 7, 5],
            [0, 0, 3, 4, 4, 3, 7, 5],
            [7, 7, 3, 3, 3, 3, 7, 5],
            [7, 7, 7, 7, 7, 7, 7, 5]
        ]
        },
        {
        id: "altar_4",
        gridSize: 7,
        regions: [
            [0, 0, 0, 0, 2, 2, 2],
            [0, 1, 0, 2, 2, 2, 2],
            [0, 1, 2, 2, 3, 3, 2],
            [2, 2, 2, 4, 4, 3, 2],
            [2, 5, 5, 4, 4, 4, 4],
            [2, 5, 5, 6, 4, 4, 4],
            [5, 5, 6, 6, 4, 4, 4]
        ]
        },
        {
        id: "altar_5",
        gridSize: 5,
        regions: [
            [0, 0, 0, 2, 2],
            [0, 0, 2, 2, 2],
            [3, 1, 1, 6, 6],
            [3, 1, 1, 6, 6],
            [3, 3, 1, 1, 6]
        ]
        },
        {
        id: "altar_6",
        gridSize: 6,
        regions: [
            [0, 0, 1, 1, 1, 1],
            [0, 0, 1, 2, 2, 1],
            [3, 3, 1, 2, 2, 1],
            [3, 4, 4, 4, 1, 1],
            [3, 4, 5, 5, 5, 7],
            [3, 3, 5, 6, 6, 7]
        ]
        }
  
        // More puzzle configurations...
    ];
    
    // Activate an altar (show the grid)
    // In AltarManager.ts
    public activateAltar(id: string): boolean {
        // Make sure the altar exists
        if (!this.altars.has(id)) {
            console.error(`Altar ${id} does not exist`);
            return false;
        }
        
        // Deactivate any currently active altar
        if (this.activeAltarId) {
            this.deactivateAltar();
        }
        
        // Get the altar and its config
        const altar = this.altars.get(id)!;
        const config = this.altarConfigs.get(id)!;
        
        // Skip if already solved
        if (config.solved) {
            console.log(`Altar ${id} is already solved`);
            return false;
        }

        // Special handling for altar_5 (dark level)
        if (id === 'altar_5') {
            this.scene.lights.forEach(light => {
                if (light instanceof BABYLON.HemisphericLight) {
                    light.intensity = 0.0001; // Dim the ambient light
                }
            });
            
            // Create a point light attached to the player if it doesn't exist
            if (!this.scene.getLightByName('playerLight')) {
                const playerLight = new BABYLON.PointLight(
                    'playerLight',
                    new BABYLON.Vector3(0, 2, 0),
                    this.scene
                );
                playerLight.intensity = 0.99;
                playerLight.range = 5;
                playerLight.diffuse = new BABYLON.Color3(0.7, 0.7, 1.0);
                playerLight.specular = new BABYLON.Color3(0.3, 0.3, 0.6);
                
                // Find the player mesh and parent the light to it
                const player = this.scene.getMeshByName('player');
                if (player) {
                    playerLight.parent = player;
                }
            }
        }
        
        // Highlight the altar
        altar.material = this.activeMaterial.clone(`altar_${id}_activeMat`);
        
        // Create and show the grid with this altar's specific configuration
        const puzzleConfig = this.puzzleConfigurations.find(config => config.id === id);
        if (!puzzleConfig) {
            console.error(`No puzzle configuration found for altar ${id}`);
            return false;
        }

        // Map altar index to platform mesh name (altar_1 -> IslandPlatform_1, etc.)
        const altarIndex = parseInt(id.replace('altar_', ''));
        const platformMeshName = `IslandPlatform_${altarIndex}`;

        this.gridManager.createGrid(
            config.gridPosition,
            puzzleConfig.gridSize,
            puzzleConfig.regions,
            platformMeshName
        );
        this.gridManager.setVisible(true);
        
        // Store the active altar
        this.activeAltarId = id;
        
        // Trigger the callback
        if (this.onAltarActivatedCallback) {
            this.onAltarActivatedCallback(id);
        }
        
        // Find the GlowRing child mesh
        const glowRing = altar.getChildMeshes().find(m => m.name.includes('GlowRing'));

        if (glowRing && glowRing.material) {
            const mat = glowRing.material as BABYLON.PBRMaterial;

            // Animate the emissiveColor to double its brightness
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
            // Store the original color for reset
            (glowRing as any)._originalEmissive = original;
        }
        
        return true;
    }
    
    // Deactivate the current altar (hide the grid)
    // Update the deactivateAltar method in AltarManager.ts

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
        
        // Mark the altar as solved
        this.markAltarSolved(this.activeAltarId);
        
        // Deactivate it (hides the grid)
        this.deactivateAltar();
    }
    
    // Set callback for altar activation
    public setOnAltarActivatedCallback(callback: (altarId: string) => void): void {
        this.onAltarActivatedCallback = callback;
    }
}