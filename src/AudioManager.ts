import { Scene } from "@babylonjs/core/scene";
import * as BABYLON from '@babylonjs/core';

export interface SoundConfig {
    name: string;
    path: string;
    isMusic: boolean;
    options: {
        loop?: boolean;
        volume?: number;
        spatialSound?: boolean;
        autoplay?: boolean;
    };
}

export class AudioManager {
    private sounds: Map<string, BABYLON.Sound> = new Map();
    private scene: Scene;
    private isAudioReady: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    async initialize(): Promise<void> {
        try {
            // The audio engine is already created by the Babylon.js engine
            // We just need to ensure it exists
            if (!BABYLON.Engine.audioEngine) {
                console.error("[AudioManager] Audio engine not found. Make sure the Babylon.js engine was created with { audioEngine: true }");
                return;
            }
            
            // Set up observers for audio state changes
            BABYLON.Engine.audioEngine.onAudioUnlockedObservable.add(() => {
                console.log("[AudioManager] Audio unlocked, setting ready state");
                this.isAudioReady = true;
            });

            BABYLON.Engine.audioEngine.onAudioLockedObservable.add(() => {
                console.log("[AudioManager] Audio locked, clearing ready state");
                this.isAudioReady = false;
            });

            // Check if already unlocked
            if (BABYLON.Engine.audioEngine.unlocked) {
                console.log("[AudioManager] Audio already unlocked, setting ready state");
                this.isAudioReady = true;
            }
            
            console.log("[AudioManager] Audio initialized");
        } catch (error) {
            console.error("[AudioManager] Failed to initialize audio:", error);
            throw error;
        }
    }

    async unlock(): Promise<boolean> {
        try {
            if (!BABYLON.Engine.audioEngine) {
                console.error("[AudioManager] Audio engine not initialized");
                return false;
            }

            // Resume audio context if suspended
            if (BABYLON.Engine.audioEngine.audioContext?.state === 'suspended') {
                await BABYLON.Engine.audioEngine.audioContext.resume();
            }

            // Unlock the audio engine
            BABYLON.Engine.audioEngine.unlock();

            console.log("[AudioManager] Audio engine unlocked");
            this.isAudioReady = true;
            return true;
        } catch (error) {
            console.error("[AudioManager] Failed to unlock audio:", error);
            return false;
        }
    }

    // Load multiple sounds at once
    async loadSounds(soundConfigs: SoundConfig[]): Promise<void> {
        if (!this.isAudioReady) {
            console.warn("[AudioManager] Audio not ready, sounds will be loaded but may not play");
        }

        for (const config of soundConfigs) {
            await this.loadSound(
                config.name,
                [config.path],
                {
                    ...config.options,
                    spatialSound: !config.isMusic
                }
            );
        }
    }

    // Load a single sound
    async loadSound(name: string, urls: string[], options: {
        loop?: boolean;
        volume?: number;
        spatialSound?: boolean;
        autoplay?: boolean;
    } = {}) {
        console.log(`[AudioManager] Loading sound '${name}' from`, urls);
        
        return new Promise<BABYLON.Sound>((resolve, reject) => {
            try {
                const sound = new BABYLON.Sound(
                    name,
                    urls[0],
                    this.scene,
                    () => {
                        console.log(`[AudioManager] Sound '${name}' is ready`);
                        
                        // Apply options
                        if (options.volume !== undefined) {
                            sound.setVolume(options.volume);
                        }
                        
                        if (options.loop !== undefined) {
                            sound.loop = options.loop;
                        }
                        
                        // Store in map
                        this.sounds.set(name, sound);
                        resolve(sound);
                    },
                    {
                        autoplay: false, // We'll handle autoplay manually
                        streaming: name === 'theme',
                        loop: options.loop || false,
                        volume: options.volume || 1,
                        spatialSound: options.spatialSound || false
                    }
                );
            } catch (err) {
                console.error(`[AudioManager] Failed to create sound '${name}':`, err);
                reject(err);
            }
        });
    }

    // Play a loaded sound
    playSound(name: string) {
        if (!this.isAudioReady) {
            console.warn("[AudioManager] Audio not ready, sound will not play");
            return;
        }

        const sound = this.sounds.get(name);
        if (sound) {
            try {
                // For footstep sounds, don't overlap them too much
                if (name === 'footstep' && sound.isPlaying) {
                    return; // Skip if already playing
                }
                
                sound.play();
                console.log(`[AudioManager] Playing sound '${name}'`);
            } catch (err) {
                console.error(`[AudioManager] Error playing sound '${name}':`, err);
            }
        } else {
            console.warn(`[AudioManager] Sound '${name}' not found`);
        }
    }

    // Get a loaded sound object
    getSound(name: string): BABYLON.Sound | undefined {
        return this.sounds.get(name);
    }

    // Stop a playing sound
    stop(name: string) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.stop();
        }
    }

    // Set global volume
    setVolume(volume: number) {
        console.log(`[AudioManager] Setting volume to ${volume}`);
        console.log(`[AudioManager] Number of loaded sounds: ${this.sounds.size}`);
        this.sounds.forEach((sound, name) => {
            console.log(`[AudioManager] Setting volume for sound '${name}'`);
            sound.setVolume(volume);
        });
    }

    // Clean up sounds when no longer needed
    dispose() {
        this.sounds.forEach(sound => {
            sound.dispose();
        });
        this.sounds.clear();
    }
}