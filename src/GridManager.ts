import * as BABYLON from '@babylonjs/core';
import { PhysicsBody, PhysicsShapeBox, PhysicsMotionType, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';

export interface GridCell {
    mesh: BABYLON.Mesh;
    row: number;
    col: number;
    regionId: number;
    hasQueen: boolean;
    marked: boolean;  // New property to track if cell is marked
}

export interface GridRegion {
    id: number;
    color: BABYLON.Color3;
    cells: GridCell[];
}

export class GridManager {
    private scene: BABYLON.Scene;
    private gridRoot: BABYLON.TransformNode;
    
    // Grid properties
    private gridSize: number; // e.g., 7 for a 7x7 grid
    private cellSize: number = 0.75; // Size of each cell
    private cellHeight: number = 0.4; // Height of the cell platform
    private cellSpacing: number = 0.05; // Small gap between cells
    private hoveredCell: GridCell | null = null;
    
    // Grid state
    private cells: GridCell[][] = []; // 2D array of cells [row][col]
    private regions: GridRegion[] = []; // Colored regions
    private queens: BABYLON.Mesh[] = []; // Placed queens
    
    // Material for cell highlighting
    private defaultMaterial: BABYLON.StandardMaterial;
    private hoveredMaterial: BABYLON.StandardMaterial;
    private invalidMaterial: BABYLON.StandardMaterial;
    private markedMaterial: BABYLON.StandardMaterial;  // New material for marked cells
    private markMeshes: BABYLON.Mesh[] = [];  // Store X mark meshes
    
    // Callbacks for events
    private onQueenPlacedCallback: (() => void) | null = null;
    private onInvalidPlacementCallback: (() => void) | null = null;
    private onPuzzleSolvedCallback: (() => void) | null = null;
    
    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.gridRoot = new BABYLON.TransformNode("gridRoot", scene);
        this.gridRoot.position = new BABYLON.Vector3(0, 0, 0);
        
        this.createMaterials();
        this.initializeDefaultRegions();
    }
    
    private createMaterials(): void {
        // Default material for cells
        this.defaultMaterial = new BABYLON.StandardMaterial("defaultCellMat", this.scene);
        this.defaultMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        
        // Hovered cell material
        this.hoveredMaterial = new BABYLON.StandardMaterial("hoveredCellMat", this.scene);
        this.hoveredMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.5); // Light yellow
        this.hoveredMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.hoveredMaterial.alpha = 0.7;
        
        // Invalid placement material
        this.invalidMaterial = new BABYLON.StandardMaterial("invalidCellMat", this.scene);
        this.invalidMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2); // Red
        this.invalidMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        this.invalidMaterial.alpha = 0.7;
        
        // Marked cell material
        this.markedMaterial = new BABYLON.StandardMaterial("markedCellMat", this.scene);
        this.markedMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
        this.markedMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.markedMaterial.alpha = 0.7;
    }
    
    // Define default regions for the grid - for MVP we'll use a simple pattern
    private initializeDefaultRegions(): void {
        // Create some sample regions with different colors
        const regionColors = [
            new BABYLON.Color3(0.2, 0.2, 0.2), // Blackz
            new BABYLON.Color3(0.8, 0.2, 0.2), // Red
            new BABYLON.Color3(0.8, 0.5, 0.2), // Orange
            new BABYLON.Color3(0.2, 0.2, 0.8), // Blue
            new BABYLON.Color3(0.8, 0.8, 0.2), // Yellow
            new BABYLON.Color3(0.8, 0.2, 0.8), // Purple
            new BABYLON.Color3(0.2, 0.8, 0.8), // Cyan
            new BABYLON.Color3(0.6, 0.4, 0.2)  // Brown
        ];

        const maxRegionId = 8; // Adjust this based on your needs
        

        // For MVP, assign regions using a simple pattern
        // (In a real game, you'd load this from a level definition)
        for (let i = 0; i < maxRegionId; i++) {
            const region: GridRegion = {
                id: i,
                color: regionColors[i % regionColors.length],
                cells: []
            };
            this.regions.push(region);
        }
    }
    
    
    // Create and materialize the grid in the world
    public createGrid(position: BABYLON.Vector3, gridSize: number, regionLayout: number[][], platformMeshName?: string): void {
        // Clean up existing grid first
        this.resetGrid();
        
        // Set the new grid size
        this.gridSize = gridSize;
        
        // Optionally parent to a platform mesh
        if (platformMeshName) {
            const platformMesh = this.scene.getMeshByName(platformMeshName);
            if (platformMesh) {
                this.gridRoot.parent = platformMesh;
                this.gridRoot.position = BABYLON.Vector3.Zero(); // Center grid on platform
            } else {
                this.gridRoot.parent = null;
                this.gridRoot.position = position; // fallback to world position
            }
        } else {
            this.gridRoot.parent = null;
            this.gridRoot.position = position;
        }

        const totalWidth = this.gridSize * (this.cellSize + this.cellSpacing) - this.cellSpacing;
        const offset = totalWidth / 2 - this.cellSize / 2;
        
        // Initialize arrays
        this.cells = [];
        
        // Create the cells using the specified region layout
        for (let row = 0; row < gridSize; row++) {
            this.cells[row] = [];
            for (let col = 0; col < gridSize; col++) {
                const regionId = regionLayout[row][col];
                const cell = this.createCell(row, col, regionId, offset);
                this.cells[row][col] = cell;
            }
        }
        
        this.setupCellDetection();
    }
    
    private createCell(row: number, col: number, regionId: number, offset: number): GridCell {
        // Calculate position
        const x = (col * (this.cellSize + this.cellSpacing)) - offset;
        const z = (row * (this.cellSize + this.cellSpacing)) - offset;
        const position = new BABYLON.Vector3(x, 0, z);
        
        // Create mesh for the cell
        const cellName = `cell_${row}_${col}`;
        const cellMesh = BABYLON.MeshBuilder.CreateBox(
            cellName,
            { 
                width: this.cellSize, 
                height: this.cellHeight, 
                depth: this.cellSize 
            },
            this.scene
        );
        
        // Position and parent the cell
        cellMesh.position = position;
        cellMesh.position.y = this.cellHeight / 2; // Center vertically
        cellMesh.parent = this.gridRoot;
        
        // Create material based on region
        const cellMat = new BABYLON.StandardMaterial(`${cellName}_mat`, this.scene);
        cellMat.diffuseColor = this.regions[regionId].color;
        cellMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        cellMesh.material = cellMat;
        
        // Add physics
        const aggregate = new PhysicsAggregate(
            cellMesh,
            PhysicsShapeType.BOX,
            { mass: 0, friction: 0.5, restitution: 0 },
            this.scene
        );
        
        // Store metadata in the cell mesh
        cellMesh.metadata = {
            type: 'gridCell',
            row: row,
            col: col,
            regionId: regionId
        };
        
        // Create the grid cell object
        const cell: GridCell = {
            mesh: cellMesh,
            row: row,
            col: col,
            regionId: regionId,
            hasQueen: false,
            marked: false  // Initialize marked as false
        };
        
        return cell;
    }
    
    // Setup interaction to detect which cell the player is standing on
    private setupCellDetection(): void {
        // We'll rely on raycasting from above to detect which cell the player is on
        // This is called by the PlayerController to determine current cell
    }
    
    // Get the cell at the given position (used by PlayerController)
    // Update the getCellAtPosition method in GridManager.ts

    public getCellAtPosition(position: BABYLON.Vector3): GridCell | null {
        // Make sure the grid is active and cells exist
        if (!this.gridRoot.isEnabled() || this.cells.length === 0) return null;
        
        // Create a ray from above the position straight down
        const rayStart = new BABYLON.Vector3(position.x, position.y + 1, position.z);
        const ray = new BABYLON.Ray(rayStart, new BABYLON.Vector3(0, -1, 0), 2);
        
        // Check for intersection with grid cells
        const pick = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.metadata && mesh.metadata.type === 'gridCell';
        });
        
        if (pick && pick.hit && pick.pickedMesh) {
            // Get the row and column from the mesh metadata
            const metadata = pick.pickedMesh.metadata;
            
            // Safety check: make sure the cell exists in our array
            if (metadata && 
                metadata.row >= 0 && 
                metadata.row < this.cells.length && 
                this.cells[metadata.row] && 
                metadata.col >= 0 && 
                metadata.col < this.cells[metadata.row].length) {
                
                return this.cells[metadata.row][metadata.col];
            }
        }
        
        return null;
    }
    
    // Highlight the cell the player is currently on
    public highlightCell(cell: GridCell | null): void {
        // Remove highlight from previous cell
        if (this.hoveredCell && this.hoveredCell !== cell) {
            const prevMesh = this.hoveredCell.mesh;
            const regionId = this.hoveredCell.regionId;
            prevMesh.material = new BABYLON.StandardMaterial(`cell_${this.hoveredCell.row}_${this.hoveredCell.col}_mat`, this.scene);
            (prevMesh.material as BABYLON.StandardMaterial).diffuseColor = this.regions[regionId].color;
            (prevMesh.material as BABYLON.StandardMaterial).specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        }
        
        // Highlight new cell
        this.hoveredCell = cell;
        if (cell) {
            cell.mesh.material = this.hoveredMaterial;
        }
    }
    
    // Attempt to place a queen on the specified cell
    public attemptPlaceQueen(cell: GridCell): boolean {
        // Check if placement is valid according to Queens puzzle rules
        if (!this.isPlacementValid(cell)) {
            // Show invalid feedback
            this.showInvalidPlacement(cell);
            return false;
        }
        
        // Place the queen
        this.placeQueen(cell);
        return true;
    }
    
    // Show invalid placement feedback temporarily
    private showInvalidPlacement(cell: GridCell): void {
        // Save original material
        const originalMaterial = cell.mesh.material;
        
        // Apply invalid material
        cell.mesh.material = this.invalidMaterial;
        
        // Reset material after a short delay
        setTimeout(() => {
            if (cell === this.hoveredCell) {
                cell.mesh.material = this.hoveredMaterial;
            } else {
                cell.mesh.material = originalMaterial;
            }
        }, 500);
    }
    
    // Check if queen placement is valid
    private isPlacementValid(cell: GridCell): boolean {
        // Rule 1: Cell must not already have a queen
        if (cell.hasQueen) return false;
        
        // Rule 2: No other queen in the same row
        for (let col = 0; col < this.gridSize; col++) {
            if (this.cells[cell.row][col].hasQueen) return false;
        }
        
        // Rule 3: No other queen in the same column
        for (let row = 0; row < this.gridSize; row++) {
            if (this.cells[row][cell.col].hasQueen) return false;
        }
        
        // Rule 4: No other queen in the same region
        for (const regionCell of this.regions[cell.regionId].cells) {
            if (regionCell.hasQueen) return false;
        }
        
        // Rule 5: Check only immediate diagonal neighbors (1 step away)
        const diagonalOffsets = [
            [-1, -1], // top-left
            [-1, 1],  // top-right
            [1, -1],  // bottom-left
            [1, 1]    // bottom-right
        ];
        
        for (const [rowOffset, colOffset] of diagonalOffsets) {
            const newRow = cell.row + rowOffset;
            const newCol = cell.col + colOffset;
            
            if (newRow >= 0 && newRow < this.gridSize && 
                newCol >= 0 && newCol < this.gridSize && 
                this.cells[newRow][newCol].hasQueen) {
                return false;
            }
        }
        
        return true;
    }
    
    // Place a queen on the cell
    private placeQueen(cell: GridCell): void {
        // Create a variable to store the queen mesh
        let queen: BABYLON.AbstractMesh;
        
        // Load the lowpoly_crown model instead of creating a cylinder
        BABYLON.SceneLoader.ImportMeshAsync("", "models/", "lowpoly_crown.glb", this.scene).then(result => {
            if (result.meshes.length > 0) {
                // Get the main mesh from the imported model
                queen = result.meshes[0];
                queen.name = `queen_${cell.row}_${cell.col}`;
                
                // Position queen on top of the cell
                queen.position = new BABYLON.Vector3(
                    cell.mesh.position.x,
                    cell.mesh.position.y + (this.cellHeight / 2) + 0.2, // Adjust height as needed
                    cell.mesh.position.z
                );
                
                // Scale the crown to appear larger on the grid
                queen.scaling = new BABYLON.Vector3(0.35, 0.35, 0.35);
                
                // Set parent to gridRoot
                queen.parent = this.gridRoot;
                
                // Add to queens array for tracking
                this.queens.push(queen as BABYLON.Mesh);
                
                // Call the callback when a queen is placed
                if (this.onQueenPlacedCallback) {
                    this.onQueenPlacedCallback();
                }
                
                // Check if the puzzle is now solved
                if (this.isPuzzleSolved() && this.onPuzzleSolvedCallback) {
                    this.onPuzzleSolvedCallback();
                }
            }
        }).catch(error => {
            console.error("Failed to load crown model:", error);
            
            // Fallback to cylinder if model loading fails
            const fallbackQueen = BABYLON.MeshBuilder.CreateCylinder(
                `queen_${cell.row}_${cell.col}`,
                { height: 0.8, diameterTop: 0.2, diameterBottom: 0.4 },
                this.scene
            );
            
            // Position queen on top of the cell
            fallbackQueen.position = new BABYLON.Vector3(
                cell.mesh.position.x,
                cell.mesh.position.y + (this.cellHeight / 2) + 0.4, // Half the queen height
                cell.mesh.position.z
            );
            fallbackQueen.parent = this.gridRoot;
            
            // Create material for the queen
            const queenMat = new BABYLON.StandardMaterial(`queen_${cell.row}_${cell.col}_mat`, this.scene);
            queenMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9); // White or off-white
            queenMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            fallbackQueen.material = queenMat;
            
            // Add fallback to queens array
            queen = fallbackQueen;
            this.queens.push(fallbackQueen);
            
            // Call the callback when a queen is placed
            if (this.onQueenPlacedCallback) {
                this.onQueenPlacedCallback();
            }
            
            // Check if the puzzle is now solved
            if (this.isPuzzleSolved() && this.onPuzzleSolvedCallback) {
                this.onPuzzleSolvedCallback();
            }
        });
        
        // Mark the cell as having a queen
        cell.hasQueen = true;
    }
    
    // Remove a queen from the cell
    public removeQueen(cell: GridCell): boolean {
        if (!cell.hasQueen) return false;
        
        // Find the queen mesh and its children for this cell
        const queenMeshName = `queen_${cell.row}_${cell.col}`;
        const queen = this.scene.getMeshByName(queenMeshName);
        
        if (queen) {
            // Get potential child meshes
            const childMeshes = queen.getChildMeshes();
            
            // Dispose of all related meshes
            for (const mesh of childMeshes) {
                mesh.dispose();
            }
            
            // Remove queen mesh
            queen.dispose();
            
            // Remove from queens array
            const index = this.queens.findIndex(q => q.name === queenMeshName);
            if (index !== -1) {
                this.queens.splice(index, 1);
            }
            
            // Mark cell as not having a queen
            cell.hasQueen = false;
            
            return true;
        }
        
        return false;
    }
    
    // Check if the puzzle is solved
    private checkWinCondition(): boolean {
        // Count placed queens - there should be exactly gridSize queens
        if (this.queens.length !== this.gridSize) return false;
        
        // All cells with queens should have valid placements
        // (This is redundant since we only allow valid placements, but included for completeness)
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.cells[row][col];
                if (cell.hasQueen && !this.isValidQueenPlacement(cell)) {
                    return false;
                }
            }
        }
        
        // If we reached here, all conditions are met
        this.onPuzzleSolved();
        return true;
    }
    
    // This is a helper method to check if a queen placement is valid
    // without modifying the grid state (used by checkWinCondition)
    private isValidQueenPlacement(cell: GridCell): boolean {
        // For rows, columns, regions, and diagonals, count queens excluding the current cell
        let rowQueens = 0;
        let colQueens = 0;
        let regionQueens = 0;
        
        // Check row
        for (let col = 0; col < this.gridSize; col++) {
            if (col !== cell.col && this.cells[cell.row][col].hasQueen) rowQueens++;
        }
        
        // Check column
        for (let row = 0; row < this.gridSize; row++) {
            if (row !== cell.row && this.cells[row][cell.col].hasQueen) colQueens++;
        }
        
        // Check region
        for (const regionCell of this.regions[cell.regionId].cells) {
            if (regionCell !== cell && regionCell.hasQueen) regionQueens++;
        }
        
        // Check only immediate diagonal neighbors (1 step away)
        const diagonalOffsets = [
            [-1, -1], // top-left
            [-1, 1],  // top-right
            [1, -1],  // bottom-left
            [1, 1]    // bottom-right
        ];
        
        for (const [rowOffset, colOffset] of diagonalOffsets) {
            const newRow = cell.row + rowOffset;
            const newCol = cell.col + colOffset;
            
            if (newRow >= 0 && newRow < this.gridSize && 
                newCol >= 0 && newCol < this.gridSize && 
                this.cells[newRow][newCol].hasQueen) {
                return false;
            }
        }
        
        return rowQueens === 0 && colQueens === 0 && regionQueens === 0;
    }
    
    // Handle puzzle solved event
    private onPuzzleSolved(): void {
        console.log("Puzzle solved!");
        
        // Create a simple particle system for visual feedback
        const particleSystem = new BABYLON.ParticleSystem("winParticles", 2000, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture("textures/flare.png", this.scene);
        
        // Position the emitter at the center of the grid
        particleSystem.emitter = this.gridRoot.position.clone();
        particleSystem.emitter.y += 2; // Above the grid
        
        // Configure appearance
        particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0, 1);
        particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;
        
        particleSystem.minLifeTime = 1;
        particleSystem.maxLifeTime = 2;
        
        particleSystem.emitRate = 500;
        
        // Configure behavior
        particleSystem.direction1 = new BABYLON.Vector3(-1, 8, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 8, 1);
        
        particleSystem.gravity = new BABYLON.Vector3(0, -9.8, 0);
        
        // Start and auto-stop
        particleSystem.start();
        setTimeout(() => {
            particleSystem.stop();
        }, 3000);
    }
    
    // Show or hide the grid
    public setVisible(visible: boolean): void {
        this.gridRoot.setEnabled(visible);
    }
    
    // Get current state of the grid (useful for saving/loading)
    public getGridState(): { row: number, col: number }[] {
        const queensPositions: { row: number, col: number }[] = [];
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.cells[row][col].hasQueen) {
                    queensPositions.push({ row, col });
                }
            }
        }
        
        return queensPositions;
    }
    
    // Reset the grid (remove all queens and marks)
    public resetGrid(): void {
        // Remove all queens and their child meshes
        for (const queen of this.queens) {
            // Get and dispose of child meshes first
            const childMeshes = queen.getChildMeshes();
            for (const childMesh of childMeshes) {
                childMesh.dispose();
            }
            
            // Then dispose of the queen mesh itself
            queen.dispose();
        }
        this.queens = [];
        
        // Remove all marks
        for (const mark of this.markMeshes) {
            mark.dispose();
        }
        this.markMeshes = [];
        
        // Remove all cells
        for (let row = 0; row < this.cells.length; row++) {
            for (let col = 0; col < this.cells[row].length; col++) {
                if (this.cells[row][col]?.mesh) {
                    this.cells[row][col].mesh.dispose();
                }
            }
        }
        
        // Reset cell states
        this.cells = [];
        
        // Reset grid size
        this.gridSize = 0;
    }
    
    // Toggle mark on a cell
    public toggleMark(cell: GridCell): void {
        if (!cell) return;

        // Toggle the marked state
        cell.marked = !cell.marked;

        // Update visual representation
        if (cell.marked) {
            // Create X mark
            const xMark = BABYLON.MeshBuilder.CreateLines(
                `xMark_${cell.row}_${cell.col}`,
                {
                    points: [
                        new BABYLON.Vector3(-0.3, 0.1, -0.3),
                        new BABYLON.Vector3(0.3, 0.1, 0.3),
                        new BABYLON.Vector3(0.3, 0.1, -0.3),
                        new BABYLON.Vector3(-0.3, 0.1, 0.3)
                    ]
                },
                this.scene
            );

            // Position and parent the X mark
            xMark.position = cell.mesh.position.clone();
            xMark.position.y += this.cellHeight / 2 + 0.01; // Slightly above the cell
            xMark.parent = this.gridRoot;

            // Create material for X mark
            const xMarkMat = new BABYLON.StandardMaterial(`xMark_${cell.row}_${cell.col}_mat`, this.scene);
            xMarkMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
            xMarkMat.emissiveColor = new BABYLON.Color3(1, 0, 0); // Red
            xMark.material = xMarkMat;

            // Store the X mark mesh
            this.markMeshes.push(xMark);
        } else {
            // Remove X mark if it exists
            const xMarkName = `xMark_${cell.row}_${cell.col}`;
            const xMark = this.scene.getMeshByName(xMarkName);
            if (xMark) {
                xMark.dispose();
                // Remove from markMeshes array
                const index = this.markMeshes.findIndex(m => m.name === xMarkName);
                if (index !== -1) {
                    this.markMeshes.splice(index, 1);
                }
            }
        }
    }
    
    // Dispose of the grid and all its resources
    public dispose(): void {
        // Properly dispose of all queen meshes and their children
        for (const queen of this.queens) {
            const childMeshes = queen.getChildMeshes();
            for (const childMesh of childMeshes) {
                childMesh.dispose();
            }
            queen.dispose();
        }
        
        // Dispose of all mark meshes
        for (const mark of this.markMeshes) {
            mark.dispose();
        }
        
        // Dispose of all grid meshes
        for (let row = 0; row < this.cells.length; row++) {
            for (let col = 0; col < this.cells[row].length; col++) {
                if (this.cells[row][col]?.mesh) {
                    this.cells[row][col].mesh.dispose();
                }
            }
        }
        
        // Dispose of the grid root node, which will dispose of all child meshes
        // Use recursive disposal to get all descendants
        this.gridRoot.dispose(false, true);
        
        // Clear arrays
        this.cells = [];
        this.regions = [];
        this.queens = [];
        this.markMeshes = [];
    }

    // Set callback for when a queen is placed successfully
    public setOnQueenPlacedCallback(callback: () => void): void {
        this.onQueenPlacedCallback = callback;
    }
    
    // Set callback for when a placement is invalid
    public setOnInvalidPlacementCallback(callback: () => void): void {
        this.onInvalidPlacementCallback = callback;
    }
    
    // Set callback for when the puzzle is solved
    public setOnPuzzleSolvedCallback(callback: () => void): void {
        this.onPuzzleSolvedCallback = callback;
    }
    
    // Check if the puzzle is currently solved
    public isPuzzleSolved(): boolean {
        // Count placed queens - there should be exactly gridSize queens
        if (this.queens.length !== this.gridSize) return false;
        
        // All cells with queens should have valid placements
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.cells[row][col];
                if (cell.hasQueen && !this.isValidQueenPlacement(cell)) {
                    return false;
                }
            }
        }
        
        // Check if each region has exactly one queen
        const regionsWithQueens = new Set<number>();
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.cells[row][col];
                if (cell.hasQueen) {
                    if (regionsWithQueens.has(cell.regionId)) {
                        // More than one queen in this region
                        return false;
                    }
                    regionsWithQueens.add(cell.regionId);
                }
            }
        }
        
        // Check if all regions have queens
        for (const region of this.regions) {
            if (!regionsWithQueens.has(region.id)) {
                return false;
            }
        }
        
        // If we reached here, all conditions are met
        return true;
    }

    // Try to place a queen on a cell with validation
    public tryPlaceQueen(cell: GridCell): boolean {
        // Already has a queen, can't place another
        if (cell.hasQueen) {
            if (this.onInvalidPlacementCallback) {
                this.onInvalidPlacementCallback();
            }
            return false;
        }
        
        // Check if this placement is valid
        if (!this.isValidQueenPlacement(cell)) {
            if (this.onInvalidPlacementCallback) {
                this.onInvalidPlacementCallback();
            }
            return false;
        }
        
        // Valid placement, add the queen
        this.placeQueen(cell);
        return true;
    }
}