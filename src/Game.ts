import * as BABYLON from '@babylonjs/core';
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { InputManager } from './InputManager';
import { PlayerController } from './PlayerController';
import { Environment } from './Environment';
import { GridManager } from './GridManager';
import { AltarManager, AltarConfig } from './AltarManager';
import { UIManager } from './UIManager';
import { AudioManager, SoundConfig } from './AudioManager';
import "@babylonjs/loaders";
import "@babylonjs/inspector";


export class Game {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private explorationCamera: BABYLON.ArcRotateCamera;
    private havokPlugin: HavokPlugin | null = null;

    // Components
    private inputManager: InputManager;
    private playerController: PlayerController;
    private environment: Environment;
    private gridManager: GridManager;
    private altarManager: AltarManager;
    private uiManager: UIManager;
    private audioManager: AudioManager;

    
    private isLoading: boolean = true;
    private onInitializedCallback: (() => void) | null = null;
    
    // Game state
    private currentLevel: number = 1;
    private totalLevels: number = 5; // Total number of altars/puzzles
    private totalMoves: number = 0; // Kept but not actively used
    private currentPuzzleMoves: number = 0; // Kept but not actively used
    
    private canvas: HTMLCanvasElement;  // Add this property to store the canvas
    
    constructor(canvas: HTMLCanvasElement, onInitialized?: () => void) {
        console.log("Game constructor: Setting up engine, scene, camera...");
        this.engine = new BABYLON.Engine(canvas, true, { audioEngine: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        
        // Caméra d'exploration (contrôle souris, limites d'angle)
        this.explorationCamera = new BABYLON.ArcRotateCamera(
            "explorationCamera",
            -Math.PI / 2, // alpha
            Math.PI / 2.5, // beta
            15, // radius
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.explorationCamera.attachControl(canvas, true);
        this.explorationCamera.lowerRadiusLimit = 5;
        this.explorationCamera.upperRadiusLimit = 30;
        this.explorationCamera.lowerBetaLimit = 0.1; // empêche de regarder par dessous
        this.explorationCamera.upperBetaLimit = Math.PI / 2.2; // limite vers le haut
        // Optionnel : limiter la rotation horizontale
        // this.explorationCamera.lowerAlphaLimit = -Math.PI / 2;
        // this.explorationCamera.upperAlphaLimit = Math.PI / 2;

        // Caméra active par défaut
        this.scene.activeCamera = this.explorationCamera;
        this.canvas = canvas;

        this.onInitializedCallback = onInitialized || null;
        console.log("Game constructor: Calling initialize...");
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log("Initialize: Setting isLoading = true.");
        this.isLoading = true;

        // Initialize audio first
        try {
            await this.initializeAudio();
        } catch (error) {
            console.error("[Audio] Failed to initialize audio:", error);
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
        this.playerController = new PlayerController(this.scene, this.explorationCamera, this.inputManager, this);
        console.log("Player created.");
        
        // Create altar manager with the grid manager
        this.altarManager = new AltarManager(this.scene, this.gridManager, this);
        
        // Create UI manager (pass audioManager)
        this.uiManager = new UIManager(this.scene, this.audioManager);
        
        // Set up the managers in player controller
        this.playerController.setGridManager(this.gridManager);
        this.playerController.setAltarManager(this.altarManager);
        this.playerController.setUIManager(this.uiManager);
        

        // this.tutorialManager.startTutorial(); // Disable tutorial for now
        // Set up game levels (altars and puzzles)
        this.setupLevels(); // Restore normal game flow
        
        // Initialize UI
        this.initializeUI();
        
        // Register events
        this.registerEvents();

        // Set loading to false and notify
        this.isLoading = false;
        if (this.onInitializedCallback) {
            this.onInitializedCallback();
        }
        
        // Dispatch custom event when game is ready
        const gameReadyEvent = new CustomEvent('gameReady', { detail: { uiManager: this.uiManager } });
        window.dispatchEvent(gameReadyEvent);
        
        
        // Show welcome/tutorial message
        this.showTutorial();

        // Start the game loop
        this.run();
    }

    private async initializeAudio(): Promise<void> {
        console.log("[Audio] Starting audio initialization...");
    
        try {
            // Create our own unmute button with a more eye-catching design
            const unmuteButton = document.createElement('button');
            unmuteButton.id = 'customUnmuteButton';
            unmuteButton.innerHTML = '🎵 CLICK HERE TO ENABLE GAME AUDIO 🎵';
            document.body.appendChild(unmuteButton);
    
            // Make the button VERY clearly visible
            unmuteButton.style.position = 'fixed';
            unmuteButton.style.top = '20px';
            unmuteButton.style.left = '50%';
            unmuteButton.style.transform = 'translateX(-50%)';
            unmuteButton.style.zIndex = '9999';
            unmuteButton.style.padding = '15px 25px';
            unmuteButton.style.backgroundColor = '#ff6600';
            unmuteButton.style.color = 'white';
            unmuteButton.style.border = '3px solid yellow';
            unmuteButton.style.borderRadius = '10px';
            unmuteButton.style.fontSize = '18px';
            unmuteButton.style.fontWeight = 'bold';
            unmuteButton.style.cursor = 'pointer';
            unmuteButton.style.boxShadow = '0 0 15px rgba(255,255,0,0.7)';
            unmuteButton.style.animation = 'pulse 2s infinite';
            
            // Add a style for the pulsing animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
            
            // Create the AudioManager instance
            this.audioManager = new AudioManager(this.scene);
            
            // Initialize the AudioManager's audio engine
            await this.audioManager.initialize();

            // Set up Babylon.js audio engine observers
            if (BABYLON.Engine.audioEngine) {
                BABYLON.Engine.audioEngine.onAudioLockedObservable.add(() => {
                    console.log("[Audio] Audio locked");
                    unmuteButton.style.display = 'block';
                });

                BABYLON.Engine.audioEngine.onAudioUnlockedObservable.add(() => {
                    console.log("[Audio] Audio unlocked");
                    unmuteButton.style.display = 'none';
                    // Load sounds after audio is unlocked
                    this.loadGameSounds();
                });
            }

            // Function to handle audio unlocking
            const initAudio = async () => {
                try {
                    console.log("[Audio] User interaction detected, attempting to unlock audio...");
                    
                    // Unlock the audio engine
                    if (BABYLON.Engine.audioEngine) {
                        await this.audioManager.unlock();
                    }
                    
                    return true;
                } catch (error) {
                    console.error("[Audio] Error during audio initialization:", error);
                    unmuteButton.innerHTML = '❌ Audio Failed - Click to Retry';
                    return false;
                }
            };
            
            // Add click handler to initialize audio on button click
            unmuteButton.addEventListener('click', async () => {
                console.log("[Audio] Unmute button clicked");
                const success = await initAudio();
                if (success) {
                    // Remove the button after successful initialization
                    unmuteButton.remove();
                    style.remove();
                }
            });
            
            // Also try to initialize on any user interaction
            const initOnInteraction = async () => {
                const success = await initAudio();
                if (success) {
                    document.removeEventListener('click', initOnInteraction);
                    document.removeEventListener('keydown', initOnInteraction);
                    document.removeEventListener('touchstart', initOnInteraction);
                    document.removeEventListener('mousedown', initOnInteraction);
                    document.removeEventListener('mouseup', initOnInteraction);
                }
            };
            
            // Add more event listeners for Firefox compatibility
            document.addEventListener('click', initOnInteraction);
            document.addEventListener('keydown', initOnInteraction);
            document.addEventListener('touchstart', initOnInteraction);
            document.addEventListener('mousedown', initOnInteraction);
            document.addEventListener('mouseup', initOnInteraction);
            
            // Try to initialize on page load for browsers that allow it
            if (BABYLON.Engine.audioEngine?.unlocked) {
                console.log("[Audio] Audio context already running, attempting to initialize...");
                const success = await initAudio();
                if (success) {
                    unmuteButton.remove();
                    style.remove();
                }
            }
            
            console.log("[Audio] Audio initialization prepared - waiting for user interaction");
        } catch (error) {
            console.error("[Audio] Error setting up audio:", error);
            throw error;
        }
    }

    private async loadGameSounds(): Promise<void> {
        console.log("[Audio] Loading game sounds...");
        
        // Define sound configurations with correct paths 
        // In Vite, the 'public' folder is served at the root
        const sounds: SoundConfig[] = [
            {
                name: 'footstep',
                path: 'assets/sounds/footstep.wav',
                isMusic: false,
                options: {
                    volume: 0.9,
                    loop: false
                }
            },
            {
                name: 'placeQueen',
                path: 'assets/sounds/placeQueen.wav',
                isMusic: false,
                options: {
                    volume: 0.9,
                    loop: false
                }
            },
            {
                name: 'theme',
                path: 'assets/sounds/theme_1.ogg',
                isMusic: true,
                options: {
                    volume: 0.7,
                    loop: true,
                    autoplay: true
                }
            }
        ];
        
        // Load all sounds
        try {
            console.log("[Audio] Starting to load sounds...");
            await this.audioManager.loadSounds(sounds);
            console.log("[Audio] All sounds loaded successfully!");
            
            // Only start playing background music if audio is unlocked
            if (BABYLON.Engine.audioEngine?.unlocked) {
                console.log("[Audio] Audio is unlocked, playing theme music");
                this.audioManager.playSound('theme');
            } else {
                console.log("[Audio] Audio is locked, not playing theme music");
            }
        } catch (error) {
            console.error("[Audio] Error loading sounds:", error);
        }
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
            "GOAL:\n" +
            "Place exactly one queen in each row, column, and colored region.\n\n" +
            "RULES:\n" +
            "1. Row/Column/Region: Each row, column, and colored region must have exactly one queen.\n" +
            "2. No Touching: Queens cannot be placed in cells adjacent (horizontally, vertically, OR diagonally) to another queen. They cannot touch, even at corners.\n\n" +
            "CONTROLS:\n" +
            "• WASD / ZQSD: Move character\n" +
            "• Mouse or Arrow Keys: Look around\n" +
            "• E: Interact with altars / Place queen on highlighted cell\n" +
            "• R: Remove queen from highlighted cell\n" +
            "• SPACE: Mark/unmark highlighted cell (for planning)\n"+
            "• H: Show the help screen";

        this.uiManager.showTutorial(tutorialText);
    }

    // Set up the game levels (altars and their associated puzzles)
    private setupLevels(): void {
        // For MVP, we'll create 5 altars in different positions
        const altarConfigs: AltarConfig[] = [];
        
        for (let i = 0; i < 5; i++) {
            const platformMesh = this.scene.getMeshByName(`IslandPlatform_${i + 1}`);
            let altarPos = new BABYLON.Vector3(0, 0, 0);
            let gridPos = new BABYLON.Vector3(0, 0, 0);
            let color: BABYLON.Color3 = new BABYLON.Color3(1, 1, 1);
            if (platformMesh) {
                const center = platformMesh.getAbsolutePosition();
                const bounding = platformMesh.getBoundingInfo().boundingBox;
                const radius = bounding.extendSizeWorld.length();
                // Place altar just off the edge in the +Z direction
                const offset = new BABYLON.Vector3(0, 0, radius + 1.2); // 1.2 units away from edge
                altarPos = center.add(offset);
                gridPos = center; // grid will be centered on platform
                // Assign color as before
                const colors = [
                    new BABYLON.Color3(0.8, 0.2, 0.2), // Red
                    new BABYLON.Color3(0.2, 0.8, 0.2), // Green
                    new BABYLON.Color3(0.2, 0.2, 0.8), // Blue
                    new BABYLON.Color3(0.8, 0.8, 0.2), // Yellow
                    new BABYLON.Color3(0.8, 0.2, 0.8)  // Purple
                ];
                color = colors[i % colors.length];
            }
            const config: AltarConfig = {
                position: altarPos,
                gridPosition: gridPos,
                color: color
            };
            altarConfigs.push(config);
            this.altarManager.createAltar(`altar_${i + 1}`, config);
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
            
            // La FollowCamera suit automatiquement le joueur, plus besoin de code manuel

            // Check for puzzle completion (until we have an event system)
            this.checkPuzzleCompletion();

            this.scene.render();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        // Add inspector toggle
        window.addEventListener('keydown', (evt) => {
            // Shift+Ctrl+Alt+I or F12
            if (evt.key === 'F12' || (evt.shiftKey && evt.ctrlKey && evt.altKey && evt.key === 'I')) {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                } else {
                    this.scene.debugLayer.show({
                        embedMode: true,
                        overlay: true,
                        enablePopup: true,
                        enableClose: true,
                        globalRoot: document.body
                    });
                }
            }
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

    // Simplified playSound method that uses BabylonJS directly
    public playSound(name: string): void {
        // Check if audio is available and unlocked
        if (!BABYLON.Engine.audioEngine?.unlocked) {
            console.log(`[Audio] Tried to play '${name}' but audio is locked`);
            return;
        }

        if (!this.audioManager) {
            console.log(`[Audio] Tried to play '${name}' but audioManager is not initialized`);
            return;
        }

        try {
            this.audioManager.playSound(name);
        } catch (error) {
            console.error(`[Audio] Error playing sound ${name}:`, error);
        }
    }

    public focusOnPlayer(playerPosition: BABYLON.Vector3) {
        this.explorationCamera.setTarget(playerPosition);
        this.explorationCamera.radius = 15;
        this.explorationCamera.beta = Math.PI / 2.5;
    }

    public focusOnPuzzle(center: BABYLON.Vector3) {
        this.explorationCamera.setTarget(center);
        this.explorationCamera.radius = 12;
        this.explorationCamera.beta = Math.PI / 3;
    }

    // Add public getter for uiManager
    public getUIManager(): UIManager {
        return this.uiManager;
    }
}