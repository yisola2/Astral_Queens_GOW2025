import * as BABYLON from '@babylonjs/core';
import { PhysicsBody, PhysicsShapeMesh, PhysicsMotionType, PhysicsShapeBox } from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

export class Environment {
    private worldMesh: BABYLON.Mesh | null = null;
    private scene: BABYLON.Scene;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.createLights(scene);
        this.createHubMarker(scene);
    }

    public async initialize(): Promise<void> {
        await this.createWorld(this.scene);
    }

    private async createWorld(scene: BABYLON.Scene): Promise<void> {
        let groundPhysicsSet = false;
        try {
            console.log("Starting to load world model...");
            
            let result;
            try {
                result = await SceneLoader.ImportMeshAsync("", "models/", "astral_queen.glb", scene);
            } catch (firstError) {
                console.log("First attempt failed, trying alternative path...");
                result = await SceneLoader.ImportMeshAsync("", "./models/", "astral_queen.glb", scene);
            }
            
            console.log("Model loaded, meshes:", result.meshes.length);
            
            // Find the GrassPlane mesh
            const grassPlane = result.meshes.find(mesh => mesh.name === "GrassPlane");
            
            if (grassPlane) {
                this.worldMesh = grassPlane as BABYLON.Mesh;
                console.log("Found GrassPlane mesh");

                // Add physics directly to the GrassPlane using its geometry
                const groundBody = new PhysicsBody(this.worldMesh, PhysicsMotionType.STATIC, false, scene);
                const groundShape = new PhysicsShapeMesh(this.worldMesh, scene);
                groundBody.shape = groundShape;

                // Make sure the visual mesh is visible
                this.worldMesh.isVisible = true;
                this.worldMesh.freezeWorldMatrix();
                groundPhysicsSet = true;
                console.log("Ground setup complete using GrassPlane mesh geometry for physics (default material)");
            } else {
                console.error("Could not find GrassPlane mesh, creating fallback ground.");
                //this.createFallbackGround(scene);
                groundPhysicsSet = true; // Mark ground as handled via fallback
            }

            // Add collision to other static meshes in the model
            console.log("Adding collision to other static meshes...");
            result.meshes.forEach(mesh => {
                // Ensure it's a mesh, not the ground plane we already handled, and has geometry
                if (mesh instanceof BABYLON.Mesh && mesh !== grassPlane && mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)) {
                    console.log(`Adding static collision to mesh: ${mesh.name}`);
                    try {
                        const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
                        const shape = new PhysicsShapeMesh(mesh, scene);
                        body.shape = shape;
                        mesh.freezeWorldMatrix(); // Optimize static meshes
                    } catch(physicsError) {
                         console.error(`Failed to add physics to mesh ${mesh.name}:`, physicsError);
                    }
                }
            });
            console.log("Finished adding collision to other static meshes.");

        } catch (error) {
            console.error("Failed to load world model:", error);
            // Ensure fallback ground if loading completely fails

        }
    }

    private createLights(scene: BABYLON.Scene): void {
        // Simple global light
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
    }

    private createHubMarker(scene: BABYLON.Scene): void {
        // Simple marker for center hub
        const hub = BABYLON.MeshBuilder.CreateCylinder(
            "hubMarker", 
            { diameter: 5, height: 0.2 }, 
            scene
        );
        hub.position.y = 0.1;
        
        // Blue material
        const hubMat = new BABYLON.StandardMaterial("hubMat", scene);
        hubMat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.8);
        hub.material = hubMat;
    }

    private createFallbackGround(scene: BABYLON.Scene): void {
        // Create a simple flat ground as fallback
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
        
        // Simple green material
        const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.2); // Green
        ground.material = groundMat;

        // Add physics
        const groundBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, false, scene);
        const groundShape = new PhysicsShapeBox(
            BABYLON.Vector3.Zero(), 
            BABYLON.Quaternion.Identity(), 
            new BABYLON.Vector3(50, 0.1, 50),
            scene
        );
        groundBody.shape = groundShape;
    }
}