declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";

// Extend Window interface to include Havok
interface Window {
    HavokPhysics: any;
    fs?: any;
}

// Interfaces for game metadata
interface CellMetadata {
    type: string;
    row: number;
    col: number;
    regionId: number;
}

interface AltarMetadata {
    type: string;
    interactionRadius: number;
}

interface QueenData {
    mesh: BABYLON.Mesh;
    regionId: number;
    position: { row: number; col: number };
}

// Type declarations for Babylon.js Physics V2
declare namespace BABYLON {
    interface CharacterShapeOptions {
        capsuleHeight: number;
        capsuleRadius: number;
        shapeType: number;
    }

    class PhysicsAggregate {
        constructor(
            mesh: TransformNode,
            shapeType: number,
            options: {
                mass: number;
                friction: number;
                restitution: number;
            },
            scene: Scene
        );
        body: PhysicsBody;
        shape: PhysicsShape;
        transformNode: TransformNode;
        dispose(): void;
    }

    class PhysicsCharacterController {
        constructor(
            transformNode: TransformNode,
            shapeOptions: CharacterShapeOptions,
            scene: Scene
        );
        setPosition(position: Vector3): void;
        getPosition(): Vector3;
        setVelocity(velocity: Vector3): void;
    }

    class HavokPlugin {
        constructor(useDeltaForWorldStep: boolean, havokInstance: any);
        shapeCast(parameters: any, localResult: any, worldResult: any): void;
    }

    class PhysicsBody {
        constructor(
            transformNode: TransformNode,
            motionType: number,
            startsAsleep: boolean,
            scene: Scene
        );
        shape: PhysicsShape;
        disablePreStep: boolean;
        startAsleep: boolean;
        disableSync: boolean;
        transformNode: TransformNode;
        setLinearVelocity(velocity: Vector3, instanceIndex?: number): void;
        getLinearVelocity(instanceIndex?: number): Vector3;
        setMassProperties(massProps: any, instanceIndex?: number): void;
        setAngularVelocity(velocity: Vector3, instanceIndex?: number): void;
        setLinearDamping(damping: number, instanceIndex?: number): void;
        setAngularDamping(damping: number, instanceIndex?: number): void;
    }

    class PhysicsShape {
        constructor(
            center: Vector3,
            rotation: Quaternion,
            scene: Scene
        );
        material: any;
    }

    class PhysicsShapeBox extends PhysicsShape {
        constructor(
            center: Vector3,
            rotation: Quaternion,
            extents: Vector3,
            scene: Scene
        );
    }

    class ShapeCastResult {
        hasHit: boolean;
        hitPoint: Vector3;
        hitNormal: Vector3;
        hitDistance: number;
        hitTransform: TransformNode;
    }

    enum PhysicsMotionType {
        STATIC = 0,
        DYNAMIC = 1,
        ANIMATED = 2
    }

    enum PhysicsShapeType {
        BOX = 0,
        SPHERE = 1,
        CAPSULE = 2,
        CYLINDER = 3,
        CONVEX_HULL = 4,
        MESH = 7
    }

    enum PhysicsPrestepType {
        TRANSFORM_V1 = -1,
        SKIP = 0,
        TRANSFORM = 1,
        TRANSFORM_INVERSE = 2,
        // and so on...
    }
}