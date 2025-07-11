import * as THREE from 'three';
import Earth from '../earth/Earth';

class Rocket {
  id = Math.random().toString(36).substring(2, 15);

  /**
   * Unit: km
   */
  position = new THREE.Vector3(0, 0, 0);
  /**
   * Unit: km
   */
  travelledDistance = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: km/s
   */
  velocity = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: km/s^2
   */
  thrust = new THREE.Vector3(0, 0, 0);

  gravityForce = new THREE.Vector3(0, 0, 0);

  /**
   * Unit: km
   */
  altitude = 0;
  /**
   * Unit: km
   */
  maxAltitude = 0;

  /**
   * Unit: kg
   */
  mass = 1;

  /**
   * Time passed after launch
   * Unit: seconds
   */
  flightTime = 0;

  /**
   * Indicates whether the rocket has finished its flight. (has displacement > 0.5 and altitude < 0)
   */
  hasLanded = false;

  /**
   * Creates a new Rocket instance.
   * @param earth The Earth instance to which the rocket is associated.
   * @param initialPosition The initial position of the rocket in 3D space.
   * @param targetInclineVector Thrust straight-line direction (Euclidean) towards the target.
   * @param startInclineAfterDistance The distance after which the rocket starts to incline (default is 8 km).
   * @param thrustInclineMaxDuration The maximum duration for the thrust incline (default is 160 seconds).
   * @param thrustInclineVelocity The velocity of the thrust incline in radians per second
   * @param fuelCombustionTime The total time for fuel combustion in seconds (default is 535 seconds).
   * @param maxThrust The maximum thrust of the rocket in km/s² (default is 0.05 km/s²).
   */
  constructor(
    private earth: Earth,
    public readonly initialPosition: THREE.Vector3,
    public readonly targetInclineVector: THREE.Vector3,
    public readonly startInclineAfterDistance: number = 8,
    public readonly thrustInclineMaxDuration: number = 160,
    public readonly thrustInclineVelocity: number = THREE.MathUtils.degToRad(
      0.5
    ),
    public readonly fuelCombustionTime = 535,
    public readonly maxThrust = 0.05 // km/s²
  ) {
    this.initialPosition = initialPosition;
    this.position.copy(this.initialPosition);
  }

  currentThrustInclineDuration = 0;
  /**
   * Unit: radians
   */
  thrustInclineAngle = 0;

  /**
   * @param tick The time step for the simulation, in seconds.
   * @param targetFlatThrustDirection The target direction for the thrust, in 3D space.
   */
  setThrust(tick: number, targetFlatThrustDirection: THREE.Vector3) {
    if (this.fuelCombustionTime <= this.flightTime) {
      this.thrust = new THREE.Vector3(0, 0, 0);
      return;
    }

    // Compute thrust magnitude (same as your original logic)
    const thrust =
      this.maxThrust *
      Math.sin((this.flightTime * Math.PI) / this.fuelCombustionTime);

    // --- 1. Initial thrust direction is opposite of gravity ---
    const gravityDirection = this.gravityForce.clone().normalize();
    const baseThrustDirection = gravityDirection.clone().negate(); // opposite to gravity

    // --- 3. Gradual interpolation between gravity-opposite and toTarget ---
    if (
      this.altitude > this.startInclineAfterDistance &&
      this.currentThrustInclineDuration <= this.thrustInclineMaxDuration
    ) {
      this.currentThrustInclineDuration += tick;
    }

    this.thrustInclineAngle =
      this.thrustInclineVelocity * this.currentThrustInclineDuration;

    // Compute axis of rotation
    const rotationAxis = baseThrustDirection
      .clone()
      .cross(targetFlatThrustDirection)
      .normalize();

    // Apply the rotation
    const inclinedThrustDirection = baseThrustDirection
      .clone()
      .applyAxisAngle(rotationAxis, this.thrustInclineAngle);

    // Final thrust vector
    this.thrust = inclinedThrustDirection.multiplyScalar(thrust);
  }

  calcThrustDirectionToIncline() {
    const gravityDir = this.earth.gravityForce(this.position);
    const gravityNorm = gravityDir.clone().normalize();

    // 3. Project targetInclineVector onto the plane perpendicular to gravity
    return this.targetInclineVector
      .clone()
      .projectOnPlane(gravityNorm)
      .normalize();
  }

  update(tick = 1) {
    this.setAltitude();
    this.gravityForce = this.earth.gravityForce(this.position);

    this.setThrust(tick, this.calcThrustDirectionToIncline());

    const displacementMagnitude = this.displacement.length();

    // todo fix (if too high time multipliyer)
    if (
      displacementMagnitude > 10 &&
      this.altitude <= 0
    ) {
      this.velocity.set(0, 0, 0);
      this.thrust.set(0, 0, 0);
      this.hasLanded = true;

      return;
    }
  
    if (
      this.thrust.length() > this.gravityForce.length() ||
      this.velocity.length() !== 0
    ) {
      this.velocity.add(this.gravityForce.clone().multiplyScalar(tick));
      this.velocity.add(this.thrust.clone().multiplyScalar(tick));

      this.position.add(this.velocity.clone().multiplyScalar(tick));

      this.travelledDistance.add(
        new THREE.Vector3()
          .set(
            Math.abs(this.velocity.x),
            Math.abs(this.velocity.y),
            Math.abs(this.velocity.z)
          )
          .multiplyScalar(tick)
      );
    }

    this.flightTime += tick;
  }

  private setAltitude() {
    this.altitude = this.earth.calcAltitude(this.position);
    if (this.altitude > this.maxAltitude) {
      this.maxAltitude = this.altitude;
    }
  }

  // private lookAtVelocity(): void {
  //   if (this.acceleration.lengthSq() === 0) return;

  // const direction = this.acceleration.clone().normalize();
  // const lookTarget = this.mesh.position.clone().add(direction);
  // this.mesh.lookAt(lookTarget);

  // this.mesh.quaternion.setFromUnitVectors(
  //   new THREE.Vector3(0, 1, 0), // current axis (Y-axis)
  //   this.velocity.clone().sub(this.mesh.position).normalize() // desired direction
  // );

  // this.mesh.rotateY(Math.PI);
  // this.mesh.rotateX(-Math.PI / 2);
  // }

  // private lookAtSky(target: THREE.Mesh): void {
  //   if (this.rocket) {
  //     const gravityForce = this.gravityForce(target.position);

  //     this.rocket.mesh.quaternion.setFromUnitVectors(
  //       new THREE.Vector3(0, 1, 0), // current axis (Y-axis)
  //       gravityForce.clone().sub(this.rocket.position).normalize() // desired direction
  //     );
  //   }
  // }

  get displacement() {
    return this.position.clone().sub(this.initialPosition);
  }
}

export default Rocket;
