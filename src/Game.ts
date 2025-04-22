import * as BABYLON from '@babylonjs/core';
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { InputManager } from './InputManager';
import { PlayerController } from './PlayerController';
import { Environment } from './Environment';
import { GridManager } from './GridManager';
import { AltarManager, AltarConfig } from './AltarManager';
import { UIManager } from './UIManager';
import "@babylonjs/loaders";
import "@babylonjs/inspector";

export class Game {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private camera: BABYLON.ArcRotateCamera;
    private havokPlugin: HavokPlugin | null = null;

    // Components
    private inputManager: InputManager;
    private playerController: PlayerController;
    private environment: Environment;
    private gridManager: GridManager;
    private altarManager: AltarManager;
    private uiManager: UIManager;
    
    private isLoading: boolean = true;
    private onInitializedCallback: (() => void) | null = null;
    
    // Game state
    private currentLevel: number = 1;
    private totalLevels: number = 5; // Total number of altars/puzzles
    private totalMoves: number = 0; // Kept but not actively used
    private currentPuzzleMoves: number = 0; // Kept but not actively used
    
    constructor(canvas: HTMLCanvasElement, onInitialized?: () => void) {
        console.log("Game constructor: Setting up engine, scene, camera...");
        this.engine = new BABYLON.Engine(canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), this.scene);
        this.camera.attachControl(canvas, true);
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 30;

        this.onInitializedCallback = onInitialized || null;
        console.log("Game constructor: Calling initialize...");
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log("Initialize: Setting isLoading = true.");
        this.isLoading = true;
        // Enable the Inspector
        if (this.scene) {
            //this.scene.debugLayer.show(); // This will open the Inspector
        }

        // Initialize physics
        await this.initializePhysics();
        if (!this.havokPlugin) {
            console.error("Physics failed to initialize. Game cannot start.");
            return;
        }

        // Create managers
        this.inputManager = new InputManager(this.scene);
        this.environment = new Environment(this.scene);
        
        // Wait for the environment (including ground physics) to be ready
        console.log("Initializing environment...");
        await this.environment.initialize();
        console.log("Environment initialized.");
        
        // Create grid manager for puzzles
        this.gridManager = new GridManager(this.scene);
        
        // Create the player AFTER the environment is ready
        console.log("Creating player...");
        this.playerController = new PlayerController(this.scene, this.camera, this.inputManager);
        console.log("Player created.");
        
        // Create altar manager with the grid manager
        this.altarManager = new AltarManager(this.scene, this.gridManager);
        
        // Create UI manager
        this.uiManager = new UIManager(this.scene);
        
        // Set up the managers in player controller
        this.playerController.setGridManager(this.gridManager);
        this.playerController.setAltarManager(this.altarManager);
        this.playerController.setUIManager(this.uiManager);
        
        // Set up game levels (altars and puzzles)
        this.setupLevels();
        
        // Initialize UI
        this.initializeUI();
        
        // Set camera to follow player
        this.camera.setTarget(this.playerController.mesh.position);
        
        // Register events
        this.registerEvents();

        // Set loading to false and notify
        this.isLoading = false;
        if (this.onInitializedCallback) {
            this.onInitializedCallback();
        }
        
        // Show welcome/tutorial message
        this.showTutorial();

        // Start the game loop
        this.run();
    }

    private async initializePhysics(): Promise<void> {
        try {
            console.log("Initializing Havok physics...");
            const havokInstance = await HavokPhysics({
                locateFile: (file: string) => {
                    if (file.endsWith('.wasm')) {
                        const wasmPath = `lib/${file}`;
                        console.log(`Locating Havok WASM at: ${wasmPath}`);
                        return wasmPath;
                    }
                    console.log(`Locating other Havok file: ${file}`);
                    return file;
                }
            });

            if (!havokInstance) {
                throw new Error("HavokPhysics() returned null or undefined.");
            }

            this.havokPlugin = new HavokPlugin(true, havokInstance);
            this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.havokPlugin);
            console.log("Physics initialized and enabled successfully.");
            
        } catch (e) {
            console.error("Failed to initialize physics:", e);
            const errorMessage = `Physics initialization failed: ${e instanceof Error ? e.message : String(e)}`;
            this.showErrorMessage(errorMessage);
            this.havokPlugin = null;
        }
        
        this.isLoading = false;
    }
    
    // Initialize UI with game state
    private initializeUI(): void {
        this.uiManager.updateLevelInfo(this.currentLevel, this.totalLevels);
        this.uiManager.updateMoveCounter(this.totalMoves); // This will not display the moves in the UI
        this.uiManager.updatePuzzleInfo("Find and solve the colored altars");
    }
    
    // Show tutorial message
    private showTutorial(): void {
        const tutorialText =
            "Welcome to Astral Queens!\n\n" +
            "Goal: Place exactly one queen in each row, column, and colored region.\n\n" +
            "Rules:\n" +
            "1. Row/Column/Region: Each row, column, and colored region must have exactly one queen.\n" +
            "2. No Touching: Queens cannot be placed in cells adjacent (horizontally, vertically, OR diagonally) to another queen. They cannot touch, even at corners.\n\n" + // Clarified adjacency rule
            "Controls:\n" +
            "• WASD or Arrow Keys: Move character\n" +
            "• Mouse: Look around\n" +
            "• E: Interact with altars / Place queen on highlighted cell\n" +
            "• R: Remove queen from highlighted cell\n" +
            "• M: Mark/unmark highlighted cell (useful for tracking possibilities)\n\n" +
            "Objective:\n" +
            "• Activate each altar to reveal its unique puzzle grid.\n" +
            "• Use logic (no guessing needed!) to solve the puzzle on all 5 altars.";
    
        // Replace console.log with your actual UIManager call to display this text
        //console.log("Showing Tutorial:\n" + tutorialText);
        this.uiManager.showTutorial(tutorialText); // Example call
    }

    // Set up the game levels (altars and their associated puzzles)
    private setupLevels(): void {
        // For MVP, we'll create 5 altars in different positions
        
        // Define altar positions and their grid spawn positions
        const altarConfigs: AltarConfig[] = [
            {
                position: new BABYLON.Vector3(5, 0, 0),
                gridPosition: new BABYLON.Vector3(10, 0, 0),
                color: new BABYLON.Color3(0.8, 0.2, 0.2) // Red
            },
            {
                position: new BABYLON.Vector3(0, 0, 5),
                gridPosition: new BABYLON.Vector3(0, 0, 10),
                color: new BABYLON.Color3(0.2, 0.8, 0.2) // Green
            },
            {
                position: new BABYLON.Vector3(-4, 0, 0),
                gridPosition: new BABYLON.Vector3(-10, 0, 0),
                color: new BABYLON.Color3(0.2, 0.2, 0.8) // Blue
            },
            {
                position: new BABYLON.Vector3(0, 0, -5),
                gridPosition: new BABYLON.Vector3(0, 0, -10),
                color: new BABYLON.Color3(0.8, 0.8, 0.2) // Yellow
            },
            {
                position: new BABYLON.Vector3(5, 0, 5),
                gridPosition: new BABYLON.Vector3(10, 0, 10), // Closer grid position for dark level
                color: new BABYLON.Color3(0.8, 0.2, 0.8) // Purple
            }
        ];
        
        // Create each altar
        for (let i = 0; i < altarConfigs.length; i++) {
            this.altarManager.createAltar(`altar_${i + 1}`, altarConfigs[i]);
        }
    }
    
    // Register event handlers
    private registerEvents(): void {
        // Set up callback for altar activation
        this.altarManager.setOnAltarActivatedCallback((altarId) => {
            const altarNumber = parseInt(altarId.split('_')[1]);
            this.currentLevel = altarNumber;
            this.currentPuzzleMoves = 0;
            this.uiManager.updateLevelInfo(this.currentLevel, this.totalLevels);
            this.uiManager.updatePuzzleInfo(`Solve Puzzle ${altarNumber}`);
            this.uiManager.showSuccess(`Activated altar ${altarNumber}`, 2000);
        });
        
        // Set up callback for queen placement
        this.gridManager.setOnQueenPlacedCallback(() => {
            this.currentPuzzleMoves++;
            this.totalMoves++;
            this.uiManager.updateMoveCounter(this.totalMoves); // This will not display the moves in the UI
            // this.uiManager.showFeedback(`Moves: ${this.currentPuzzleMoves}`, "#FFFFFF", 1000);
        });
        
        // Set up callback for invalid placement
        this.gridManager.setOnInvalidPlacementCallback(() => {
            this.uiManager.showError("Invalid queen placement!", 2000);
        });
    }

    private run(): void {
        this.engine.runRenderLoop(() => {
            const deltaTime = this.engine.getDeltaTime() / 1000.0;

            // Update components in order
            this.inputManager.update();
            this.playerController.update(deltaTime);
            
            // Keep camera following player
            this.camera.setTarget(BABYLON.Vector3.Lerp(
                this.camera.getTarget(), 
                this.playerController.mesh.position, 
                0.1
            ));

            // Check for puzzle completion (until we have an event system)
            this.checkPuzzleCompletion();

            this.scene.render();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }
    
    // Check if current puzzle is solved (polling approach)
    private checkPuzzleCompletion(): void {
        // If an altar is active and all queens are placed correctly
        const activeAltarId = this.altarManager.getActiveAltarId();
        
        if (activeAltarId && this.gridManager.isPuzzleSolved()) {
            // Show victory UI
            this.uiManager.showLevelCompleted(this.currentLevel, this.currentPuzzleMoves);
            
            // Tell the altar manager the puzzle is solved
            this.altarManager.onPuzzleSolved();
            
            // Increment level or handle game progression
            if (this.currentLevel >= this.totalLevels) {
                this.onGameCompleted();
            }
        }
    }
    
    // Handle game completion
    private onGameCompleted(): void {
        console.log("Game completed! All puzzles solved.");
        
        // Show victory UI
        this.uiManager.showGameCompleted(this.totalMoves);
    }
    
    // Helper to show error messages
    private showErrorMessage(message: string): void {
        // Display error in UI
        this.uiManager.showError(message);
        
        // For MVP, also log to console
        console.error(message);
    }
}