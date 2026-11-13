import * as THREE from 'three';
import { makeIslandMap, axialToPixel, hexDistance } from '../systems/HexGrid.js';

const MAP_RADIUS = 5;
const HEX_SIZE = 1.28;
const VIEW_HEIGHT = 10.8;

export class ThreeWorld {
  constructor(root, state) {
    this.root = root;
    this.state = state;
    this.home = true;
    this.tiles = [];
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.drag = null;
    this.target = new THREE.Vector3(0, 0, 0);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b5368');
    this.scene.fog = new THREE.Fog('#0b5368', 24, 48);

    this.camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
    this.cameraOffset = new THREE.Vector3(10, 18, 10);
    this.viewHeight = VIEW_HEIGHT;
    this.camera.zoom = 1;
    this.camera.position.copy(this.target).add(this.cameraOffset);
    this.camera.lookAt(this.target);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.style.touchAction = 'none';
    root.appendChild(this.renderer.domElement);

    this.addLights();
    this.createOcean();
    this.createMap();
    this.createShip();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => this.pointerDown(e));
    canvas.addEventListener('pointermove', e => this.pointerMove(e));
    canvas.addEventListener('pointerup', e => this.pointerUp(e));
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.viewHeight = THREE.MathUtils.clamp(this.viewHeight + e.deltaY * 0.008, 8, 16);
      this.resize();
    }, { passive: false });

    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  material(color, roughness = 0.86, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x42545a, 2.05));
    const sun = new THREE.DirectionalLight(0xffe2b5, 3.1);
    sun.position.set(-9, 17, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  createOcean() {
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      this.material('#126d80', 0.38, 0.08)
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.42;
    ocean.receiveShadow = true;
    this.scene.add(ocean);

    // A few broad, understated current lines give the sea depth without
    // drawing a distracting grid over the playable board.
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: '#79c5c0',
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide
    });
    for (let i = 0; i < 9; i++) {
      const curve = new THREE.EllipseCurve(
        (i % 3 - 1) * 8,
        (Math.floor(i / 3) - 1) * 7,
        1.8 + (i % 2) * 0.8,
        0.22,
        0.15,
        Math.PI * 1.45,
        false,
        0
      );
      const points = curve.getPoints(48).map(p => new THREE.Vector3(p.x, 0, p.y));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: '#9bd8ce',
        transparent: true,
        opacity: 0.18
      }));
      line.position.y = -0.39;
      this.scene.add(line);
    }
  }

  tilePosition(q, r) {
    const p = axialToPixel(q, r, HEX_SIZE);
    return new THREE.Vector3(p.x * 0.88, 0, p.y * 0.88);
  }

  createMap() {
    const baseGeometry = new THREE.CylinderGeometry(HEX_SIZE * 0.98, HEX_SIZE * 0.98, 0.34, 6, 1);
    const sandGeometry = new THREE.CylinderGeometry(0.94, 1.00, 0.18, 6, 1);
    const grassGeometry = new THREE.CylinderGeometry(0.83, 0.91, 0.16, 6, 1);
    const tileMaterials = {
      sea: this.material('#247b88'),
      island: this.material('#cba36a'),
      storm: this.material('#647e91'),
      volcano: this.material('#927257')
    };

    for (const data of makeIslandMap(MAP_RADIUS)) {
      const pos = this.tilePosition(data.q, data.r);
      const group = new THREE.Group();
      group.position.copy(pos);

      const base = new THREE.Mesh(baseGeometry, tileMaterials[data.kind]);
      base.position.y = -0.12;
      base.castShadow = true;
      base.receiveShadow = true;
      base.userData.tile = data;
      group.add(base);
      this.tiles.push(base);

      if (data.kind === 'island') this.addIsland(group, sandGeometry, grassGeometry);
      if (data.kind === 'volcano') this.addVolcano(group);
      if (data.kind === 'storm') this.addStorm(group);

      this.scene.add(group);
    }
  }

  addIsland(group, sandGeometry, grassGeometry) {
    const sand = new THREE.Mesh(sandGeometry, this.material('#e5c17c'));
    sand.position.y = 0.10;
    sand.castShadow = true;
    sand.receiveShadow = true;
    group.add(sand);

    const grass = new THREE.Mesh(grassGeometry, this.material('#5f9d61'));
    grass.position.y = 0.25;
    grass.castShadow = true;
    grass.receiveShadow = true;
    group.add(grass);

    // Small rocks make the coastline feel layered, while keeping every
    // object deliberately low-poly and safely separated.
    for (const [x, z, s] of [[-0.48, 0.12, 0.13], [0.42, -0.30, 0.10], [0.18, 0.48, 0.09]]) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        this.material('#b9a17c')
      );
      rock.position.set(x, 0.37, z);
      rock.rotation.set(0.2, x * 2, 0.3);
      rock.castShadow = true;
      group.add(rock);
    }

    this.addPalm(group, -0.24, -0.08, 0.92);
    this.addPalm(group, 0.34, 0.20, 0.70);
  }

  addPalm(group, x, z, scale) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055 * scale, 0.085 * scale, 0.72 * scale, 6),
      this.material('#805338')
    );
    trunk.position.set(x, 0.69 * scale, z);
    trunk.rotation.z = -0.10;
    trunk.castShadow = true;
    group.add(trunk);

    const crownY = 1.08 * scale;
    const leafMaterial = this.material('#39864e');
    const leafLight = this.material('#5aa85c');
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.34 * scale, 7, 5),
        i % 2 ? leafMaterial : leafLight
      );
      leaf.scale.set(0.95, 0.20, 0.42);
      leaf.position.set(
        x + Math.cos(angle) * 0.25 * scale,
        crownY - 0.10 * scale,
        z + Math.sin(angle) * 0.25 * scale
      );
      leaf.rotation.y = -angle;
      leaf.rotation.z = Math.cos(angle) * 0.28;
      leaf.castShadow = true;
      group.add(leaf);
    }
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 7, 5), this.material('#d5a65d'));
    crown.position.set(x, crownY, z);
    group.add(crown);
  }

  addVolcano(group) {
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(0.76, 1.35, 7, 1),
      this.material('#596466')
    );
    mountain.position.y = 0.86;
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    group.add(mountain);

    const crater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.045, 8),
      new THREE.MeshStandardMaterial({
        color: '#d84c25',
        emissive: '#e84a1b',
        emissiveIntensity: 0.9,
        roughness: 0.5
      })
    );
    crater.position.y = 1.53;
    group.add(crater);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.045, 5, 8),
      this.material('#78665a')
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.55;
    group.add(rim);
  }

  addStorm(group) {
    const cloudMaterial = this.material('#c0d0d2');
    for (const [x, y, z, s] of [
      [-0.30, 0.78, 0, 0.30],
      [0, 0.91, 0, 0.38],
      [0.30, 0.78, 0, 0.28],
      [0.08, 0.70, 0.18, 0.25]
    ]) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), cloudMaterial);
      cloud.scale.y = 0.68;
      cloud.position.set(x, y, z);
      cloud.castShadow = true;
      group.add(cloud);
    }

    const lightningShape = new THREE.Shape();
    lightningShape.moveTo(0.06, 0.28);
    lightningShape.lineTo(-0.12, -0.02);
    lightningShape.lineTo(0.02, -0.02);
    lightningShape.lineTo(-0.06, -0.35);
    lightningShape.lineTo(0.20, 0.03);
    lightningShape.lineTo(0.06, 0.03);
    lightningShape.closePath();
    const lightning = new THREE.Mesh(
      new THREE.ShapeGeometry(lightningShape),
      new THREE.MeshBasicMaterial({ color: '#ffdb70', side: THREE.DoubleSide })
    );
    lightning.position.set(0.08, 0.39, 0.12);
    group.add(lightning);
  }

  createShip() {
    this.ship = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 7),
      this.material('#75472f')
    );
    hull.scale.set(0.95, 0.23, 0.38);
    hull.position.y = 0.40;
    hull.castShadow = true;
    this.ship.add(hull);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.12, 0.48),
      this.material('#bd8950')
    );
    deck.position.y = 0.55;
    deck.castShadow = true;
    this.ship.add(deck);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 1.52, 7),
      this.material('#69452f')
    );
    mast.position.set(0, 1.34, 0);
    mast.castShadow = true;
    this.ship.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(-0.04, 0.66);
    sailShape.lineTo(-0.04, -0.48);
    sailShape.lineTo(0.78, -0.34);
    sailShape.closePath();
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshStandardMaterial({
        color: '#f4e4c4',
        roughness: 0.95,
        side: THREE.DoubleSide
      })
    );
    sail.position.set(0.03, 1.43, 0.025);
    sail.castShadow = true;
    this.ship.add(sail);

    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.10, 0.36, 3),
      this.material('#bd5744')
    );
    flag.position.set(0.02, 2.20, 0);
    flag.rotation.z = -Math.PI / 2;
    this.ship.add(flag);

    const start = this.tilePosition(this.state.player.q, this.state.player.r);
    this.ship.position.copy(start);
    this.ship.position.y = 0.05;
    this.ship.rotation.y = Math.PI * 0.20;
    this.shipTarget = start.clone();
    this.scene.add(this.ship);
  }

  setHome(value) {
    this.home = value;
    this.target.set(0, 0, 0);
    this.viewHeight = value ? 13.2 : VIEW_HEIGHT;
    this.cameraOffset.set(10, 18, 10);
    this.resize();
  }

  pointerDown(event) {
    this.drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  pointerMove(event) {
    if (!this.drag || this.home) return;
    const dx = event.clientX - this.drag.lastX;
    const dy = event.clientY - this.drag.lastY;
    if (Math.abs(event.clientX - this.drag.x) + Math.abs(event.clientY - this.drag.y) > 7) this.drag.moved = true;
    if (this.drag.moved) {
      const scale = this.viewHeight / Math.max(1, this.renderer.domElement.clientHeight);
      this.target.x -= dx * scale * 0.72;
      this.target.z += dy * scale * 0.72;
      this.updateCamera();
    }
    this.drag.lastX = event.clientX;
    this.drag.lastY = event.clientY;
  }

  pointerUp(event) {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    if (!moved && !this.home) this.tap(event);
  }

  tap(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects(this.tiles, false)[0];
    if (!hit) return;

    const tile = hit.object.userData.tile;
    const destination = this.tilePosition(tile.q, tile.r);
    this.shipTarget.copy(destination);
    this.state.player = { q: tile.q, r: tile.r };

    if (tile.kind === 'island') this.state.gold += 5;
    if (tile.kind === 'storm') this.state.damagePlayer(2);
    if (tile.kind === 'volcano') this.state.gold += 12;
    this.state.emit();

    window.dispatchEvent(new CustomEvent('pirate-toast', {
      detail: tile.kind === 'island' ? 'Île découverte : +5 or !' :
        tile.kind === 'storm' ? 'La tempête secoue la coque !' :
        tile.kind === 'volcano' ? 'Volcan découvert : +12 or !' : 'Cap sur l’horizon !'
    }));

    if (hexDistance(tile, { q: 1, r: -1 }) <= 1) this.state.startCombat();
  }

  updateCamera() {
    this.camera.position.copy(this.target).add(this.cameraOffset);
    this.camera.lookAt(this.target);
  }

  resize() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = this.viewHeight / 2;
    const halfWidth = halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.updateCamera();
  }

  loop() {
    this.frame = requestAnimationFrame(this.loop);
    const time = performance.now() * 0.001;
    this.ship.position.lerp(this.shipTarget.clone().setY(0.05), 0.055);
    this.ship.position.y = 0.05 + Math.sin(time * 1.5) * 0.045;
    this.ship.rotation.z = Math.sin(time * 0.8) * 0.018;
    this.ship.rotation.y += (Math.PI * 0.20 - this.ship.rotation.y) * 0.008;
    if (this.home) {
      this.target.x = Math.sin(time * 0.10) * 0.35;
      this.updateCamera();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
