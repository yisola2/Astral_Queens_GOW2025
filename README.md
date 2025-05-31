# Astral Queens

A 3D puzzle game built with BabylonJS and TypeScript where players solve queen placement puzzles in an interactive environment.

![Astral Queens](public/images/image1.png)
https://yisola2.github.io/Astral_Queens_GOW2025/

## Description

Astral Queens is a 3D puzzle game that combines spatial exploration with logical queen placement puzzles. The game features:

- 3D environment with character movement
- Physics-based interactions
- Five unique puzzles with increasing difficulty
- Interactive altars that reveal puzzles
- Real-time feedback and validation
- Immersive audio system

## Game Objective

Place queens on a grid following these rules:
- Each row, column, and colored region must have exactly one queen
- Queens cannot be placed adjacent to other queens (horizontally, vertically, or diagonally)
- All puzzles can be solved using logic (no guessing required)

## Controls

- **WASD/Arrow Keys**: Move character
- **Mouse**: Look around
- **E**: Interact with altars / Place queen
- **R**: Remove queen
- **SPACE**: Mark/unmark cell for planning
- **H**: Help screen

## Technologies Used

- TypeScript
- BabylonJS (3D rendering engine)
- BabylonJS GUI
- Havok Physics Engine
- Vite (build tool)
- Web Audio API (via BabylonJS Audio Engine)

## Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yisola2/Astral_Queens_GOW2025.git
   cd Astral_Queens_GOW2025
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Run the development server
   ```bash
   npm run dev
   ```

4. Build for production
   ```bash
   npm run build
   ```

## Project Structure

- `src/`: Source code
  - `Game.ts`: Main game class
  - `Environment.ts`: 3D environment setup
  - `PlayerController.ts`: Character controls and physics
  - `GridManager.ts`: Puzzle grid logic
  - `AltarManager.ts`: Interactive altar objects
  - `UIManager.ts`: User interface and feedback
  - `InputManager.ts`: Input handling
  - `AudioManager.ts`: Audio system management
  - `types.d.ts`: TypeScript type definitions

## Detailed Components

### Audio System (AudioManager.ts)

The game features a comprehensive audio system with the following capabilities:

- **Audio Engine**: Uses BabylonJS Audio Engine with Web Audio API integration
- **Sound Management**:
  - Background music with streaming support
  - Spatial sound effects for footsteps and interactions
  - Volume control and sound state management
  - Automatic audio context handling and user interaction unlocking

- **Sound Types**:
  - Background music (streaming)
  - Footstep sounds (spatial)
  - Interaction sounds (spatial)
  - Puzzle completion sounds

### Physics System (PlayerController.ts)

The player movement and collision system uses the Havok Physics engine with the following features:

- **Character Controller**: Uses a physics capsule-based character with:
  - Mass: 1 unit with configured restitution (0.1) and friction (0.8)
  - Linear damping: 0.5 to prevent sliding
  - Angular damping: 0.5 to limit rotation
  - Custom inertia settings for realistic movement

- **Movement System**:
  - Camera-relative movement: Player moves in the direction the camera is facing
  - Quaternion-based smooth rotation using SLERP (Spherical Linear Interpolation)
  - Ground contact detection using ray casting
  - Walking animation triggered when in motion

- **Character Model**:
  - 3D character model loaded via BabylonJS SceneLoader
  - Animation system with idle and walking animations
  - Model parented to the physics capsule for proper collision handling

### Altar Level 5 (Dark Level)

The fifth and final altar implements a special dark level with unique characteristics:

- **Dynamic Lighting**: 
  - When activated, it dramatically reduces the global hemisphere light intensity to near zero (0.0001)
  - Creates a player-attached point light with limited range (5 units)
  - Light has custom blue-tinted colors (diffuse: 0.7, 0.7, 1.0)
  - Increases challenge by limiting visibility to player's immediate surroundings

- **Restoration**:
  - When deactivated, restores normal lighting conditions
  - Disposes of the player light to return to standard gameplay
  - Provides a unique gameplay variation that tests spatial awareness

### User Interface (UIManager.ts)

The UI system features a comprehensive layout with several key components:

- **GUI Layout**:
  - Hierarchical container system with top, bottom, and center areas
  - Responsive design that scales with window size (requires refinement)

- **Help System with ScrollViewer**:
  - Detailed help popup with scrollable content
  - ScrollViewer implementation allowing for extensive content navigation:
    - Configurable wheel precision (10)
    - Modal background that blocks game interaction while help is visible

- **Particle Effects**:
  - Simple (for now) celebration particles when puzzles are solved

## Development Notes

- **Havok Physics**: Requires proper WASM file locations (`lib/` directory)
- **BabylonJS Scene Management**: Uses scene for coordinating all game elements
- **Animation System**: Custom animation system for character
- **Audio System**: Requires BabylonJS engine initialization with `{ audioEngine: true }` option


