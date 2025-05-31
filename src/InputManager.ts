import * as BABYLON from '@babylonjs/core';

export class InputManager {
    // Movement direction
    public moveDirection = BABYLON.Vector3.Zero();
    
    // Action states
    public interactPressed = false;
    public removePressed = false;
    public resetPressed = false;
    public helpPressed = false;
    public markPressed = false;  // New state for mark action
    
    // Key tracking
    private _inputMap: { [key: string]: boolean } = {};
    private _prevInputMap: { [key: string]: boolean } = {};
    
    // Input settings
    private _interactKey = 'e';
    private _removeKey = 'r';
    private _resetKey = 'escape';
    private _helpKey = 'h';
    private _markKey = 'space';  // Changed from 'm' to 'space'

    constructor(scene: BABYLON.Scene) {
        // Setup keyboard input
        scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            // Safely get the code, defaulting to the key if code is undefined
            const code = kbInfo.event.code ? kbInfo.event.code.toLowerCase() : key;
            
            // Store previous state before update
            // Use key as primary, and code only if different and defined
            this._prevInputMap[key] = this._inputMap[key];
            if (code !== key && kbInfo.event.code) { 
                this._prevInputMap[code] = this._inputMap[code];
            }
            
            // Update current state
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this._inputMap[key] = true;
                if (code !== key && kbInfo.event.code) {
                    this._inputMap[code] = true;
                }
            } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                this._inputMap[key] = false;
                if (code !== key && kbInfo.event.code) {
                    this._inputMap[code] = false;
                }
            }
        });
        
        // Allow for gamepad input (future implementation)
        // scene.onBeforeRenderObservable.add(() => this._updateGamepadInput());
    }

    // Called every frame in the game loop
    public update(): void {
        // Reset direction
        this.moveDirection.set(0, 0, 0);

        // Update movement direction based on current inputMap state
        // Note: Changed to WASD keys for French AZERTY keyboard compatibility
        if (this._inputMap['z'] ) this.moveDirection.z = 1;
        if (this._inputMap['s'] ) this.moveDirection.z = -1;
        if (this._inputMap['q'] ) this.moveDirection.x = -1;
        if (this._inputMap['d'] ) this.moveDirection.x = 1;

        // Normalize if there's input to prevent faster diagonal movement
        if (this.moveDirection.lengthSquared() > 0) {
            this.moveDirection.normalize();
        }

        // Update action states (detect key presses - when key goes from up to down)
        this.interactPressed = this.isKeyPressed(this._interactKey);
        this.removePressed = this.isKeyPressed(this._removeKey);
        this.resetPressed = this.isKeyPressed(this._resetKey);
        this.helpPressed = this.isKeyPressed(this._helpKey);
        this.markPressed = this.isKeyPressed(this._markKey);  // Update mark state
    }
    
    // Check if a key was just pressed this frame (transition from up to down)
    private isKeyPressed(key: string): boolean {
        return this._inputMap[key] === true && this._prevInputMap[key] !== true;
    }
    
    // Check if a key was just released this frame (transition from down to up)
    private isKeyReleased(key: string): boolean {
        return this._inputMap[key] !== true && this._prevInputMap[key] === true;
    }
    
    // Check if a key is currently held down
    public isKeyDown(key: string): boolean {
        return this._inputMap[key] === true;
    }
    
    // Set a custom key mapping
    public setKeyMapping(action: string, key: string): void {
        switch(action.toLowerCase()) {
            case 'interact':
                console.log('Audio unlocked?', BABYLON.Engine.audioEngine?.unlocked);
                this._interactKey = key.toLowerCase();
                break;
            case 'remove':
                this._removeKey = key.toLowerCase();
                break;
            case 'reset':
                this._resetKey = key.toLowerCase();
                break;
            case 'help':
                this._helpKey = key.toLowerCase();
                break;
            case 'mark':  // New case for mark action
                this._markKey = key.toLowerCase();
                break;
        }
    }
    
    // Get the key currently mapped to an action (for UI display)
    public getKeyForAction(action: string): string {
        switch(action.toLowerCase()) {
            case 'interact':
                return this._interactKey;
            case 'remove':
                return this._removeKey;
            case 'reset':
                return this._resetKey;
            case 'help':
                return this._helpKey;
            case 'mark':  // New case for mark action
                return this._markKey;
            default:
                return '';
        }
    }
    
    // Future implementation for gamepad support
    // private _updateGamepadInput(): void {
    //     const gamepad = navigator.getGamepads()[0];
    //     if (gamepad) {
    //         // Update movement from left stick
    //         // Update action buttons
    //     }
    // }
}