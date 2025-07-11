import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useId, useRef, useState } from 'react';
import { Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';
import s from './OrbitalVelocity.module.scss';
import clsx from 'clsx';

import Earth from './earth/Earth';
import EarthView from './earth/EarthView';
import RocketView from './rocket/RocketView';
import EarthGui from './earth/Earth.gui';
import WorldGui from './WorldGui';
import Launcher from './launcher/Launcher';
import LauncherView from './launcher/LauncherView';
import LauncherGui from './launcher/Launcher.gui';
import RocketGui from './rocket/Rocket.gui';
import FrameTimeManager from './helpers/FrameTimeManager';
import { toExponentGrowth, normalizeBetween } from './utils';
import MouseTracker from './helpers/MouseTracker';
import MouseTrackerGui from './helpers/MouseTracker.gui';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000000);

camera.near = Earth.RADIUS * 0.001;
camera.far = Earth.RADIUS * 100;
camera.updateProjectionMatrix();

const mouse = new THREE.Vector2();

const MIN_EARTH_CAMERA_DISTANCE = Earth.RADIUS + 50; // Just above surface
const MAX_EARTH_CAMERA_DISTANCE = Earth.RADIUS * 4; // Outer orbit

camera.position.z = MAX_EARTH_CAMERA_DISTANCE / 2;
camera.position.y = 0;
camera.position.x = 0;

const axisHelper = new THREE.AxesHelper(10000);
scene.add(axisHelper);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  logarithmicDepthBuffer: true,
});
renderer.setSize(WIDTH, HEIGHT);

renderer.setClearColor(0x000000, 1); // Set background color to black

renderer.setPixelRatio(window.devicePixelRatio);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 0, 0);
scene.add(directionalLight);

const clock = new THREE.Clock();

const stats = new Stats();
stats.showPanel(0);

const updateTriggers: {
  [key: string]: any;
  update: () => void;
}[] = [stats];

const updateControlSpeed = (
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
) => {
  const distance = camera.position.length(); // Assuming planet center at (0, 0, 0)

  const percentageOfDistanceToSurface = normalizeBetween(
    distance,
    MIN_EARTH_CAMERA_DISTANCE,
    MAX_EARTH_CAMERA_DISTANCE
  );

  const rotateExponentBase = 5;
  const maxRotateSpeed = 2;
  const minRotateSpeed = 0.05;

  const expFactor = THREE.MathUtils.mapLinear(
    toExponentGrowth(percentageOfDistanceToSurface, rotateExponentBase),
    0,
    1,
    minRotateSpeed,
    maxRotateSpeed
  );

  controls.rotateSpeed = expFactor;

  const minZoomSpeed = 0.01;
  const maxZoomSpeed = 4;

  const zoomExponentBase = 2;
  const zoomFactor = THREE.MathUtils.mapLinear(
    toExponentGrowth(percentageOfDistanceToSurface, zoomExponentBase),
    0,
    1,
    minZoomSpeed,
    maxZoomSpeed
  );
  controls.zoomSpeed = zoomFactor;
};

const OrbitalVelocity = () => {
  const launchPadListenersRef = useRef({
    onCalculateTrajectory: () => {},
    onLaunchRocket: () => {},
  });
  const launchPadStatesRef = useRef({
    startPositionSetIsActive: false,
    targetPositionSetIsActive: false,
  });

  const [setStartPositionActive, setSetStartPositionActive] = useState(
    launchPadStatesRef.current.startPositionSetIsActive
  );
  const [setTargetPositionActive, setSetTargetPositionActive] = useState(
    launchPadStatesRef.current.targetPositionSetIsActive
  );
  const [calculationProgress, setCalculationProgress] = useState<null | number>(
    null
  );

  const [isLaunchDisabled, setIsLaunchDisabled] = useState(true);
  const [isCalculateTrajectoryDisabled, setIsCalculateTrajectoryDisabled] =
    useState(true);

  const [startPositionGeo, setStartPositionGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [targetPositionGeo, setTargetPositionGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    const mainGuiContainer = document.getElementById(mainGuiContainerId);
    const rocketGuiContainer = document.getElementById(rocketGuiContainerId);
    const mouseFollower = document.getElementById(mouseFollowerId);
    const { current: launcherPadListeners } = launchPadListenersRef;

    if (!sceneContainer) return;

    const mainPane = new Pane({
      title: 'Orbital Velocity Controls',
      container: mainGuiContainer!,
    });
    const rocketGuiPane = new Pane({
      title: 'Rocket Controls',
      container: rocketGuiContainer!,
    });

    sceneContainer.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const mouseTracker = new MouseTracker(window);

    controls.minDistance = MIN_EARTH_CAMERA_DISTANCE;
    controls.maxDistance = MAX_EARTH_CAMERA_DISTANCE;
    controls.enablePan = false;

    updateTriggers.push(controls);

    const earth = new Earth();
    updateTriggers.push(earth);

    // const rocketInitialPosition = Earth.geoCoordinatesToPosition(0, 90);
    // const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);
    // const targetInclineVector = rocketInitialPosition
    //   .clone()
    //   .sub(rocketTargetPosition)
    //   .normalize();

    // const _rocket = new Rocket(
    //   earth,
    //   rocketInitialPosition,
    //   targetInclineVector
    // );

    // const _rocketView = new RocketView(_rocket, scene, camera);
    // updateTriggers.push(_rocketView);

    // const _rocketGui = new RocketGui(
    //   rocketGuiPane,
    //   rocketGuiContainer!,
    //   _rocket,
    //   _rocketView,
    //   camera,
    //   controls
    // );

    const earthGui = new EarthGui(mainPane, earth);
    const earthView = new EarthView(earth, scene, earthGui);

    const worldGui = new WorldGui(mainPane, clock);
    updateTriggers.push(worldGui);

    const mouseTrackedGui = new MouseTrackerGui(worldGui.folder, mouseTracker);
    updateTriggers.push(mouseTrackedGui);

    const launcherGui = new LauncherGui(mainPane);
    const launcherView = new LauncherView(earth, scene);
    const launcher = new Launcher(launcherGui, earth);

    launcherPadListeners.onCalculateTrajectory = () => {
      if (!launcher.rocketStartPosition || !launcher.rocketTargetPosition) {
        console.error('Start or target position is not set.');
        return;
      }

      const onProgress = (bestGenome: any, progress: number) => {
        setCalculationProgress(progress);
      };

      setIsLaunchDisabled(true);

      launcher.calcTrajectory(onProgress).then(() => {
        setIsLaunchDisabled(false);
        setCalculationProgress(null);
      });
    };

    launcherPadListeners.onLaunchRocket = () => {
      const rocket = launcher.createRocket();

      if (!rocket) {
        console.error('Rocket could not be created. Check launcher settings.');
        return;
      }
      const rocketView = new RocketView(rocket, scene, camera);

      const frameTimeManager = new FrameTimeManager(
        rocket,
        rocketView,
        worldGui
      );

      const rocketGui = new RocketGui(
        rocketGuiPane,
        rocketGuiContainer!,
        rocket,
        rocketView,
        camera,
        controls
      );

      updateTriggers.push(frameTimeManager);
      updateTriggers.push(rocketGui);
    };

    // const garbageCollector = () => {
    //   updateTriggers.forEach((trigger) => {
    //     trigger.remove();
    //   });
    // };

    const onMouseDown = () => {
      const earthIntersection = earthView.clickToGeoCoordinates(
        mouseTracker.normalizedPosition,
        camera
      );

      if (earthIntersection == null) {
        return;
      }

      if (launchPadStatesRef.current.startPositionSetIsActive) {
        launcherView.setStartPosition(earthIntersection);
        launcher.setStartPosition(earthIntersection);

        setStartPositionGeo(Earth.positionToGeoCoordinates(earthIntersection));

        launchPadStatesRef.current.startPositionSetIsActive = false;
        setSetStartPositionActive(false);
      }

      if (launchPadStatesRef.current.targetPositionSetIsActive) {
        launcherView.setTargetPosition(earthIntersection);
        launcher.setTargetPosition(earthIntersection);

        setTargetPositionGeo(Earth.positionToGeoCoordinates(earthIntersection));

        launchPadStatesRef.current.targetPositionSetIsActive = false;
        setSetTargetPositionActive(false);
      }

      setIsCalculateTrajectoryDisabled(
        !(launcher.rocketStartPosition && launcher.rocketTargetPosition)
      );
      // launcher.handleEarthClick(earthIntersection);
    };

    const onMove = () => {
      if (
        !launchPadStatesRef.current.startPositionSetIsActive &&
        !launchPadStatesRef.current.targetPositionSetIsActive
      ) {
        return;
      }

      if (mouseFollower) {
        mouseFollower.style.left = `${mouseTracker.position.x}px`;
        mouseFollower.style.top = `${mouseTracker.position.y}px`;
      }

      const earthIntersection = earthView.clickToGeoCoordinates(
        mouseTracker.normalizedPosition,
        camera
      );

      if (earthIntersection == null) {
        return;
      }

      const geoCords = Earth.positionToGeoCoordinates(earthIntersection);

      if (launchPadStatesRef.current.startPositionSetIsActive) {
        launcherView.setStartPosition(earthIntersection);
        setStartPositionGeo(geoCords);
      }

      if (launchPadStatesRef.current.targetPositionSetIsActive) {
        launcherView.setTargetPosition(earthIntersection);
        setTargetPositionGeo(geoCords);
      }
    };

    window.addEventListener('mousedown', onMouseDown, false);

    const animateLoop = () => {
      // rocketGui.update();
      // controls.update();
      renderer.render(scene, camera);

      const deltaTime = clock.getDelta();

      // const tick = deltaTime * worldGui.timeMultiplier;
      // fix tick more 1 second

      // rockets.forEach((rocket) => {
      //   for (let i = 0; i < worldGui.timeMultiplier; i++) {
      //     rocket.update();
      //   }
      // });
      mouseTracker.update(deltaTime);
      updateControlSpeed(camera, controls);
      onMove();

      updateTriggers.forEach((trigger) => {
        trigger.update();
      });
    };

    renderer.setAnimationLoop(animateLoop);

    return () => {
      sceneContainer.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const handleStartPositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSetStartPositionActive((prev) => !prev);
    launchPadStatesRef.current.startPositionSetIsActive =
      !launchPadStatesRef.current.startPositionSetIsActive;
  };

  const handleTargetPositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSetTargetPositionActive((prev) => !prev);
    launchPadStatesRef.current.targetPositionSetIsActive =
      !launchPadStatesRef.current.targetPositionSetIsActive;
  };

  const handleCalculateTrajectoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isLoading = calculationProgress !== null;

    if (isLoading) {
      return;
    }

    launchPadListenersRef.current.onCalculateTrajectory();
  };

  const handleLaunchRocketClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    launchPadListenersRef.current.onLaunchRocket();
  };

  const isPositionSelectionActive =
    setStartPositionActive || setTargetPositionActive;

  return (
    <>
      <div id={sceneContainerId} className={s.sceneContainer}></div>
      <div
        className={clsx(s.container, { [s.hide]: isPositionSelectionActive })}
      >
        <div id={rocketGuiContainerId} className={s.rocketGui}></div>
        <div id={mainGuiContainerId} className={s.mainGui}></div>
        <div
          className={s.stats}
          ref={(el) => el && el.appendChild(stats.dom)}
        ></div>

        <div className={s.launchPad}>
          <div className={s.infoPanel}>
            {setStartPositionActive && (
              <div className={s.infoText}>
                Click on Earth to set Start Position
              </div>
            )}
            {setTargetPositionActive && (
              <div className={s.infoText}>
                Click on Earth to set Target Position
              </div>
            )}
          </div>

          <div className={s.controls}>
            <div className={s.positionBlock}>
              <button className={s.button} onClick={handleStartPositionClick}>
                Set Start
              </button>
              {startPositionGeo?.longitude != null && (
                <div className={s.coordinates}>
                  Lon: {startPositionGeo.longitude.toFixed(1)} <br />
                  Lat: {startPositionGeo.latitude.toFixed(1)}
                </div>
              )}
            </div>

            <div className={s.trajectoryBlock}>
              <button
                className={s.calculateButton}
                onClick={handleCalculateTrajectoryClick}
                disabled={isCalculateTrajectoryDisabled}
              >
                {calculationProgress !== null ? (
                  <div className={s.progressWrapper}>
                    <div
                      className={s.progressBar}
                      style={{ width: `${Math.round(calculationProgress)}%` }}
                    ></div>
                    <span className={s.progressText}>
                      {Math.round(calculationProgress)}%
                    </span>
                  </div>
                ) : (
                  'Calculate'
                )}
              </button>
              <button
                className={s.launchButton}
                disabled={isLaunchDisabled}
                onClick={handleLaunchRocketClick}
              >
                Launch 🚀
              </button>
            </div>

            <div className={s.positionBlock}>
              <button className={s.button} onClick={handleTargetPositionClick}>
                Set Target
              </button>
              {targetPositionGeo?.longitude != null && (
                <div className={s.coordinates}>
                  Lon: {targetPositionGeo.longitude.toFixed(1)} <br />
                  Lat: {targetPositionGeo.latitude.toFixed(1)}
                </div>
              )}
            </div>
          </div>
          {/* 
          <div className={s.timeManager}>
            <div>FPS*Sec</div>
            <button>⏮</button>
            <button>⏭</button>
          </div> */}
        </div>
      </div>

      <div
        id={mouseFollowerId}
        className={clsx(s.mouseFollower, {
          [s.hide]: !isPositionSelectionActive,
        })}
      >
        <div className={s.coordBox}>
          {setStartPositionActive && (
            <>
              <span className={s.coordItem}>
                ↔ {startPositionGeo?.longitude.toFixed(1)}
              </span>
              <span className={s.coordItem}>
                ↕ {startPositionGeo?.latitude.toFixed(1)}
              </span>
            </>
          )}
          {setTargetPositionActive && (
            <>
              <span className={s.coordItem}>
                ↔ {targetPositionGeo?.longitude.toFixed(1)}
              </span>
              <span className={s.coordItem}>
                ↕ {targetPositionGeo?.latitude.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default OrbitalVelocity;
