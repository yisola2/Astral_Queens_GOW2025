import * as BABYLON from '@babylonjs/core';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { InputManager } from './InputManager'; 
import { GridManager, GridCell } from './GridManager';
import { AltarManager } from './AltarManager';
import { UIManager } from './UIManager';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Game } from './Game';


export class PlayerController {
    public mesh: BABYLON.Mesh;
    public body: BABYLON.PhysicsBody;
    private modelMesh: BABYLON.Mesh | null = null;
    private skeleton: BABYLON.Skeleton | null = null;
    private idleAnimation: BABYLON.AnimationGroup | null = null;
    private walkAnimation: BABYLON.AnimationGroup | null = null;
    private currentAnimation: BABYLON.AnimationGroup | null = null;

    private scene: BABYLON.Scene;
    private camera: BABYLON.ArcRotateCamera; 
    private inputManager: InputManager;
    private gridManager?: GridManager;
    private altarManager?: AltarManager;
    private uiManager?: UIManager;
    private game: Game;


    // Grid interaction state
    private currentCell: GridCell | null = null;
    private nearbyAltarId: string | null = null;

    // Configurable parameters
    private moveSpeed: number = 5.0;
    private rotationSpeedFactor: number = 10.0;
    private groundCheckDistance: number = 0.1;
    private isOnGround: boolean = false;
    private lastMarkTime: number = 0;  // Track last time mark was toggled
    private markCooldown: number = 0.2;  // Cooldown in seconds
    private lastFootstepTime: number = 0;  // Track last footstep sound
    private footstepCooldown: number = 0.3;  // Cooldown between footsteps

    constructor(scene: BABYLON.Scene, camera: BABYLON.ArcRotateCamera, inputManager: InputManager, game: Game) {
        this.scene = scene;
        this.camera = camera;
        this.inputManager = inputManager;
        this.game = game;

        // Create fallback capsule mesh
        this.mesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
        this.mesh.position = new BABYLON.Vector3(3, 0.2, 0); // Start higher above the ground
        this.mesh.isVisible = false; // Hide the capsule initially

        // Add material to make player visible
        const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
        playerMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Red color
        playerMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.mesh.material = playerMat;

        // Create Physics Aggregate
        const aggregate = new PhysicsAggregate(
            this.mesh,
            PhysicsShapeType.CAPSULE,
            { mass: 1, restitution: 0.1, friction: 0.8 },
            scene
        );
        this.body = aggregate.body;
        this.body.setMassProperties({ inertia: BABYLON.Vector3.ZeroReadOnly });
        this.body.disablePreStep = false;
        this.body.setLinearDamping(0.5);
        this.body.setAngularDamping(0.5);

        // Ensure the mesh starts with a quaternion
        if (!this.mesh.rotationQuaternion) {
            this.mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
        }

        // Load the character model
        this.loadCharacterModel();

        // Set up action input handlers
        this.setupActionInputs();
    }

    private async loadCharacterModel(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "models/", "Aj.glb", this.scene);
            
            if (result.meshes.length > 0) {
                this.modelMesh = result.meshes[0] as BABYLON.Mesh;
                
                // Parent the model to the physics capsule
                this.modelMesh.parent = this.mesh;
                
                // Reset the model's local position and rotation
                this.modelMesh.position = new BABYLON.Vector3(0, -0.8, 0);
                this.modelMesh.rotation = BABYLON.Vector3.Zero();
                
                // Get the skeleton and animations
                this.skeleton = result.skeletons[0];
                
                // Find and store the animations
                result.animationGroups.forEach(animationGroup => {
                    if (animationGroup.name.toLowerCase().includes("idle")) {
                        this.idleAnimation = animationGroup;
                    } else if (animationGroup.name.toLowerCase().includes("walk")) {
                        this.walkAnimation = animationGroup;
                    }
                });

                // Start with idle animation
                if (this.idleAnimation) {
                    this.playAnimation(this.idleAnimation);
                }
                
                console.log("Character model loaded successfully");
            }
        } catch (error) {
            console.error("Failed to load character model:", error);
            this.mesh.isVisible = true;
        }
    }

    private playAnimation(animation: BABYLON.AnimationGroup): void {
        if (this.currentAnimation === animation) return;
        
        // Stop current animation
        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }
        
        // Play new animation
        animation.play(true);
        this.currentAnimation = animation;
    }

    // Set the GridManager reference
    public setGridManager(gridManager: GridManager): void {
        this.gridManager = gridManager;
    }

    // Set the AltarManager reference
    public setAltarManager(altarManager: AltarManager): void {
        this.altarManager = altarManager;
    }

    // Set the UIManager reference
    public setUIManager(uiManager: UIManager): void {
        this.uiManager = uiManager;
    }



    // Setup input handlers for actions like placing queens
    private setupActionInputs(): void {
        // Use action manager for more complex interactions
        this.scene.actionManager = this.scene.actionManager || new BABYLON.ActionManager(this.scene);

        // Register key actions
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                const key = kbInfo.event.key.toLowerCase();
                
                // Handle 'E' key for interactions (place queen or activate altar)
                if (key === 'e') {
                    this.handleInteractionKey();
                }
                
                // Handle 'R' key for removing queens
                if (key === 'r') {
                    this.handleRemoveQueenKey();
                }
            }
        });
    }

    // Called every frame from the game loop
    public update(deltaTime: number): void {
        const inputDirection = this.inputManager.moveDirection;
        const hasInput = inputDirection.lengthSquared() > 0;

        // Mouvement RELATIF à la caméra (ArcRotateCamera)
        let worldDirection = BABYLON.Vector3.Zero();
        if (hasInput) {
            // Récupère la direction avant et droite de la caméra
            const cameraForward = this.camera.getDirection(BABYLON.Vector3.Forward());
            cameraForward.y = 0; cameraForward.normalize();
            const cameraRight = this.camera.getDirection(BABYLON.Vector3.Right());
            cameraRight.y = 0; cameraRight.normalize();

            // Combine input avec orientation caméra
            worldDirection = cameraForward.scale(inputDirection.z)
                .add(cameraRight.scale(inputDirection.x));
            worldDirection.normalize();

            // Play footstep sound if on ground and enough time has passed
            const currentTime = performance.now() / 1000;
            if (this.isOnGround && currentTime - this.lastFootstepTime > this.footstepCooldown) {
                this.game.playSound('footstep');
                this.lastFootstepTime = currentTime;
            }
        }

        // Met à jour la cible de la caméra d'exploration (pour garder le joueur centré)
        this.camera.setTarget(this.mesh.position);

        // Apply Linear Velocity (preserving vertical momentum)
        const currentVelocity = this.body.getLinearVelocity();
        const targetVelocity = worldDirection.scale(this.moveSpeed);
        this.body.setLinearVelocity(new BABYLON.Vector3(targetVelocity.x, currentVelocity.y, targetVelocity.z));

        // Apply Rotation - only rotate when moving
        if (hasInput) {
            const targetRotation = BABYLON.Quaternion.FromLookDirectionLH(worldDirection, BABYLON.Vector3.Up());
            this.mesh.rotationQuaternion = BABYLON.Quaternion.Slerp(
                this.mesh.rotationQuaternion!,
                targetRotation,
                deltaTime * this.rotationSpeedFactor
            );
        }

        // Update animation based on movement
        if (hasInput && this.walkAnimation) {
            this.playAnimation(this.walkAnimation);
        } else if (!hasInput && this.idleAnimation) {
            this.playAnimation(this.idleAnimation);
        }

        // Ground check
        this.checkGroundContact();
        
        // Grid cell detection (when on a grid)
        this.updatePlayerState();
        
        // Altar proximity check
        this.checkAltarProximity();

        // Check for help key press
        if (this.inputManager.helpPressed) {
            this.handleHelpKey();
        }
    }

    // Check if player is on ground
    private checkGroundContact(): void {
        // Cast a short ray downward from player's feet
        const origin = this.mesh.position.clone();
        origin.y -= this.mesh.getBoundingInfo().boundingBox.extendSize.y - 0.1;
        
        const ray = new BABYLON.Ray(origin, new BABYLON.Vector3(0, -1, 0), this.groundCheckDistance);
        const hit = this.scene.pickWithRay(ray);
        
        // Update ground state
        this.isOnGround = hit && hit.hit;
    }

    // Update the current cell the player is standing on
    private updatePlayerState(): void {
        // Get current player position
        const playerPosition = this.mesh.position.clone();
        
        // Check which cell the player is on
        const cell = this.gridManager.getCellAtPosition(playerPosition);
        
        // If cell changed, update highlight and interaction prompt
        if (cell !== this.currentCell) {
            // Clear current cell if we're moving off the grid
            if (this.currentCell && !cell) {
                this.currentCell = null;
                this.gridManager.highlightCell(null);
                this.hideInteractionPrompt();
            } else {
                this.gridManager.highlightCell(cell);
                this.currentCell = cell;
                
                // Show appropriate interaction prompt
                if (cell) {
                    if (cell.hasQueen) {
                        this.showInteractionPrompt(`Press [R] to remove queen`);
                    } else {
                        this.showInteractionPrompt(`Press [E] to place queen`);
                    }
                }
            }
        }

        // Altar proximity check
        this.checkAltarProximity();

        // Check for mark toggle input with cooldown
        const currentTime = performance.now() / 1000;  // Convert to seconds
        if (this.inputManager.markPressed && 
            this.currentCell && 
            currentTime - this.lastMarkTime >= this.markCooldown) {
            
            // Toggle the mark
            this.gridManager.toggleMark(this.currentCell);
            this.lastMarkTime = currentTime;
            
            // Show mark/unmark prompt
            if (this.currentCell.marked) {
                this.showInteractionPrompt(`Press [SPACE] to unmark cell`);
            } else {
                this.showInteractionPrompt(`Press [SPACE] to mark cell`);
            }
        }
    }
    

    // Check if player is near an altar
    private checkAltarProximity(): void {
        if (!this.altarManager) return;
        
        // Get current player position
        const playerPosition = this.mesh.position.clone();
        
        // Check which altar the player is near
        const nearbyAltarId = this.altarManager.checkPlayerInteraction(playerPosition);
        
        // Update UI or show prompt if altar is found
        if (nearbyAltarId !== this.nearbyAltarId) {
            this.nearbyAltarId = nearbyAltarId;
            
            if (nearbyAltarId) {
                this.showInteractionPrompt(`Press [E] to activate altar`);
            } else {
                this.hideInteractionPrompt();
            }
        }
    }

    // Handle E key for interactions
    private handleInteractionKey(): void {
        // If on a grid cell and the player can place a queen
        if (this.currentCell && this.gridManager) {
            if (this.currentCell.hasQueen) {
                this.showInteractionPrompt(`Press [R] to remove queen`);
            } else {
                this.showInteractionPrompt(`Press [E] to place queen`);
            }
            this.placeQueen();
            return;
        }
        
        // If near an altar, activate it
        if (this.nearbyAltarId && this.altarManager) {
            this.altarManager.activateAltar(this.nearbyAltarId);
            // Reset current cell when activating a new altar
            this.currentCell = null;
            return;
        }
    }

    // Place a queen on the current cell
    private placeQueen(): void {
        if (this.currentCell && this.gridManager) {
            this.gridManager.tryPlaceQueen(this.currentCell);
        }
    }

    // Remove a queen from the current cell
    private handleRemoveQueenKey(): void {
        if (!this.currentCell || !this.gridManager) return;
        
        // Try to remove a queen from the current cell
        const success = this.gridManager.removeQueen(this.currentCell);
        
        if (success) {
            // Play sound effect or animation
            console.log(`Removed queen at row ${this.currentCell.row}, col ${this.currentCell.col}`);
        }
    }

    // Show an interaction prompt to the player
    private showInteractionPrompt(text: string): void {
        if (this.uiManager) {
            this.uiManager.showInteractionPrompt(text);
        } else {
            console.log(`Interaction prompt: ${text}`);
        }
    }

    // Hide the interaction prompt
    private hideInteractionPrompt(): void {
        if (this.uiManager) {
            this.uiManager.hideInteractionPrompt();
        }
    }

    // Reset player to a specific position (e.g., after winning)
    public resetToPosition(position: BABYLON.Vector3): void {
        // Reset physics body
        this.body.setLinearVelocity(BABYLON.Vector3.Zero());
        this.body.setAngularVelocity(BABYLON.Vector3.Zero());
        
        // Set position
        this.mesh.position = position.clone();
    }

    // Handle H key for help
    private handleHelpKey(): void {
        if (this.uiManager) {
            this.uiManager.showHelpPopup();
        }
    }
}