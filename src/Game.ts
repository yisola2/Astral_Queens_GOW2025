import * as BABYLON from '@babylonjs/core';
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { InputManager } from './InputManager';
import { PlayerController } from './PlayerController';
import { Environment } from './Environment';
import { GridManager } from './GridManager';
import { AltarManager, AltarConfig } from './AltarManager';
import { UIManager } from './UIManager';
import { AudioManager, SoundConfig } from './AudioManager'; // Fixed import path
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
    private audioManager: AudioManager; // Changed from soundManager to audioManager
    
    private isLoading: boolean = true;
    private onInitializedCallback: (() => void) | null = null;
    
    // Game state
    private currentLevel: number = 1;
    private totalLevels: number = 5; // Total number of altars/puzzles
    private totalMoves: number = 0; // Kept but not actively used
    private currentPuzzleMoves: number = 0; // Kept but not actively used
    
    private canvas: HTMLCanvasElement;  // Add this property to store the canvas
    
    // Audio state
    private isAudioSystemReady: boolean = false;
    private soundQueue: string[] = [];
    private interactionListenersAttached: boolean = false; // Prevent attaching multiple listeners
    
    constructor(canvas: HTMLCanvasElement, onInitialized?: () => void) {
        console.log("Game constructor: Setting up engine, scene, camera...");
        this.engine = new BABYLON.Engine(canvas, true, { audioEngine: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), this.scene);
        this.camera.attachControl(canvas, true);
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 30;

        // Store canvas for audio engine
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
        this.playerController = new PlayerController(this.scene, this.camera, this.inputManager, this);
        console.log("Player created.");
        
        // Create altar manager with the grid manager
        this.altarManager = new AltarManager(this.scene, this.gridManager);
        
        // Create UI manager
        this.uiManager = new UIManager(this.scene);
        
        // Create audio manager
        this.audioManager = new AudioManager(this.scene); // Changed from soundManager to audioManager
        
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

    private async initializeAudio(): Promise<void> {
        console.log("[Audio] Starting audio initialization...");
    
        try {
            // Create the AudioManager instance first
            this.audioManager = new AudioManager(this.scene);
            await this.audioManager.initialize(); // Ensure base engine check passes

            // Create our own unmute button
            const unmuteButton = document.createElement('button');
            unmuteButton.id = 'customUnmuteButton';
            unmuteButton.innerHTML = '🎵 CLICK HERE TO ENABLE GAME AUDIO 🎵';
            document.body.appendChild(unmuteButton);
            
            // Styling for the button (keep existing styles)
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

            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(style);

            // Function to handle audio unlocking and sound loading
            const initAudio = async () => {
                // Prevent multiple initializations
                if (this.isAudioSystemReady) return true;
                
                try {
                    console.log("[Audio] User interaction detected, attempting to unlock audio...");
                    
                    const unlocked = await this.audioManager.unlock();
                    if (!unlocked) {
                        console.error("[Audio] Failed to unlock audio engine");
                        unmuteButton.innerHTML = '❌ Audio Failed - Click to Retry';
                        return false;
                    }

                    console.log("[Audio] Engine unlocked. Loading sounds...");
                    // Load sounds *before* setting ready state or processing queue
                    await this.loadGameSounds(); 
                    
                    console.log("[Audio] Sounds loaded. Setting system ready.");
                    this.isAudioSystemReady = true; // Now the system is ready

                    // Remove interaction listeners now that audio is unlocked and sounds loaded
                    removeInteractionListeners();
                    
                    // Process any sounds queued before or during load
                    this.processSoundQueue();

                    // Explicitly play theme music now
                    console.log("[Audio] Attempting to play theme music...");
                    this.audioManager.playSound('theme');
                    
                    // Update button appearance and fade out
                    unmuteButton.innerHTML = '✅ Audio Enabled!';
                    setTimeout(() => {
                        unmuteButton.style.opacity = '0';
                        setTimeout(() => {
                            unmuteButton.remove();
                            style.remove();
                        }, 1000);
                    }, 2000);
                    
                    return true;
                } catch (error) {
                    console.error("[Audio] Error during audio initialization:", error);
                    unmuteButton.innerHTML = '❌ Audio Failed - Click to Retry';
                    return false;
                }
            };

            // Define interaction handler
            const handleInteraction = async () => {
                await initAudio();
            };

            // Define function to remove listeners
            const removeInteractionListeners = () => {
                if (!this.interactionListenersAttached) return;
                document.removeEventListener('click', handleInteraction);
                document.removeEventListener('keydown', handleInteraction);
                document.removeEventListener('touchstart', handleInteraction);
                this.interactionListenersAttached = false;
                console.log("[Audio] Interaction listeners removed.");
            };

            // Add listeners only once
            if (!this.interactionListenersAttached) {
                document.addEventListener('click', handleInteraction);
                document.addEventListener('keydown', handleInteraction);
                document.addEventListener('touchstart', handleInteraction);
                this.interactionListenersAttached = true;
                console.log("[Audio] Interaction listeners attached.");
            }

            // Add click handler specifically for the button
            unmuteButton.addEventListener('click', handleInteraction);
            
            console.log("[Audio] Audio initialization prepared - waiting for user interaction");
        } catch (error) {
            console.error("[Audio] Error setting up audio:", error);
            throw error;
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

    private async loadGameSounds(): Promise<void> {
        console.log("[Audio] Loading game sounds...");
        
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
                path: 'assets/sounds/theme.mp3',
                isMusic: true,
                options: {
                    volume: 0.7,
                    loop: true,
                    // Autoplay is handled explicitly after load now
                }
            }
        ];
        
        try {
            await this.audioManager.loadSounds(sounds);
            console.log("[Audio] All sounds loaded successfully!");
            
            // Removed theme playing logic from here

        } catch (error) {
            console.error("[Audio] Error loading sounds:", error);
        }
    }

    // Method to process queued sounds after unlock
    private processSoundQueue(): void {
        console.log(`[Audio] Processing sound queue (${this.soundQueue.length} sounds)`);
        while (this.soundQueue.length > 0) {
            const soundName = this.soundQueue.shift();
            if (soundName) {
                try {
                    this.audioManager.playSound(soundName);
                    console.log(`[Audio] Playing queued sound '${soundName}'`);
                } catch (error) {
                    console.error(`[Audio] Error playing queued sound '${soundName}':`, error);
                }
            }
        }
    }

    // Updated playSound method using the new state and queue
    public playSound(name: string): void {
        if (!this.audioManager) {
            console.warn(`[Audio] AudioManager not ready, cannot play sound '${name}'`);
            return;
        }

        if (!this.isAudioSystemReady) {
            console.log(`[Audio] System not ready. Queuing sound '${name}'.`);
            this.soundQueue.push(name);
            return;
        }

        // If ready, play immediately
        try {
            this.audioManager.playSound(name);
        } catch (error) {
            console.error(`[Audio] Error playing sound ${name}:`, error);
        }
    }
}