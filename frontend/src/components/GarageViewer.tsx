import { useEffect, useRef } from 'react';
import { ArcRotateCamera, Color3, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

interface GarageViewerProps {
  vin: string;
}

const GarageViewer: React.FC<GarageViewerProps> = ({ vin }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 3, 15, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);

    const light = new HemisphericLight('light', new Vector3(1, 1, 0), scene);
    light.intensity = 0.9;

    const body = MeshBuilder.CreateBox('body', { width: 4, height: 1.2, depth: 2 }, scene);
    const bodyMat = new StandardMaterial('bodyMat', scene);
    bodyMat.diffuseColor = new Color3(0.1, 0.4, 0.8);
    body.material = bodyMat;

    const cabin = MeshBuilder.CreateBox('cabin', { width: 2.4, height: 1, depth: 1.6 }, scene);
    cabin.position.y = 1;
    cabin.material = bodyMat;

    const wheelMat = new StandardMaterial('wheelMat', scene);
    wheelMat.diffuseColor = new Color3(0.05, 0.05, 0.05);

    const wheelPositions = [
      new Vector3(1.5, -0.6, 1),
      new Vector3(-1.5, -0.6, 1),
      new Vector3(1.5, -0.6, -1),
      new Vector3(-1.5, -0.6, -1)
    ];
    wheelPositions.forEach((position) => {
      const wheel = MeshBuilder.CreateCylinder('wheel', { diameter: 0.8, height: 0.4, tessellation: 24 }, scene);
      wheel.position = position;
      wheel.rotation.z = Math.PI / 2;
      wheel.material = wheelMat;
    });

    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
    const groundMat = new StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
    ground.material = groundMat;

    const label = MeshBuilder.CreatePlane('label', { size: 3 }, scene);
    label.position = new Vector3(0, 2.5, 0);
    const labelMat = new StandardMaterial('labelMat', scene);
    labelMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    label.material = labelMat;

    scene.onBeforeRenderObservable.add(() => {
      label.rotation.y += 0.005;
    });

    const renderLoop = () => {
      scene.render();
    };

    engine.runRenderLoop(renderLoop);

    const resize = () => engine.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      engine.dispose();
    };
  }, [vin]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '320px' }} />;
};

export default GarageViewer;
