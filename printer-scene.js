import * as THREE from './vendor/three/three.module.min.js';

// Procedural geometry only. No model, texture, controls, postprocessing or idle RAF.
export function createPrinter(host, onOutlet, onFailure) {
    const weakDevice = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !weakDevice, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, weakDevice ? 1 : 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4.7, 4.7, 1.88, -1.88, .1, 40);
    const machine = new THREE.Group();
    scene.add(machine);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x626758, 2.6));
    const key = new THREE.DirectionalLight(0xfff8e9, 3);
    key.position.set(-4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde6ed, .8);
    fill.position.set(5, 2, 0);
    scene.add(fill);
    const shell = new THREE.MeshStandardMaterial({ color: 0xb9baad, roughness: .76, metalness: .08 });
    const lidMaterial = new THREE.MeshStandardMaterial({ color: 0xd5d4c8, roughness: .72, metalness: .05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x252c27, roughness: .85 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x424940, roughness: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8c9289, roughness: .42, metalness: .65 });
    const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4636, emissive: 0x85a863, emissiveIntensity: 0, roughness: .4 });
    const geometries = new Set();
    function mesh(geometry, material, x, y, z, parent = machine) {
        geometries.add(geometry);
        const part = new THREE.Mesh(geometry, material);
        part.position.set(x, y, z);
        parent.add(part);
        return part;
    }
    function box(w, h, d, material, x, y, z, bevel = .035) {
        // Small bevels catch light without requiring a downloaded model.
        const shape = new THREE.Shape();
        const r = Math.min(bevel, h / 3, w / 3);
        shape.moveTo(-w / 2 + r, -h / 2);
        shape.lineTo(w / 2 - r, -h / 2);
        shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        shape.lineTo(w / 2, h / 2 - r);
        shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        shape.lineTo(-w / 2 + r, h / 2);
        shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        shape.lineTo(-w / 2, -h / 2 + r);
        shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: r / 2, bevelThickness: r / 2, curveSegments: 3 });
        geometry.translate(0, 0, -d / 2);
        return mesh(geometry, material, x, y, z);
    }
    box(7.75, 1.25, 2.2, shell, 0, .12, -.06, .13);
    box(7.66, .18, 2.12, dark, 0, -.57, -.06, .06);
    const lid = box(7.5, .12, 2.03, lidMaterial, 0, .82, -.06, .055);
    // Inset service lid and a seam, with a narrow front output cavity.
    box(6.7, .025, 1.56, steel, 0, .896, -.13);
    box(6.65, .027, 1.5, lidMaterial, 0, .914, -.13);
    box(7.35, .30, .05, dark, 0, -.31, 1.08);
    box(7.22, .035, .12, steel, 0, -.48, 1.14, .01);
    box(7.3, .07, .10, lidMaterial, 0, -.115, 1.14, .02);
    const roller = mesh(new THREE.CylinderGeometry(.065, .065, 7.12, 12), rubber, 0, -.32, 1.13);
    roller.rotation.z = Math.PI / 2;
    for (let i = -3; i <= 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.067, .011, 4, 10), steel);
        geometries.add(ring.geometry);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = i;
        roller.add(ring);
    }
    // Offset marks make rotation visible, including in the frontal mobile view.
    for (let i = 0; i < 3; i++) {
        const mark = mesh(new THREE.BoxGeometry(.012, 6.9, .012), steel, .065 * Math.cos(i * 2.094), 0, .065 * Math.sin(i * 2.094), roller);
        mark.rotation.y = i * 2.094;
    }
    const head = box(.44, .10, .07, steel, -3.2, -.22, 1.13, .01);
    for (const x of [-3.35, 3.35]) box(.55, .15, 1.3, dark, x, -.75, -.1);
    for (let i = 0; i < 7; i++) box(.24, .028, .025, dark, -3.2 + i * .33, .26, 1.065, .005);
    box(.75, .26, .05, dark, 2.95, .26, 1.08);
    mesh(new THREE.SphereGeometry(.036, 10, 6), ledMaterial, 2.71, .26, 1.13);
    box(.27, .012, .013, steel, 3.03, .26, 1.12, .003);
    const outletLeft = new THREE.Vector3(-3.55, -.44, 1.23);
    const outletRight = new THREE.Vector3(3.55, -.44, 1.23);
    const projectedLeft = new THREE.Vector3();
    const projectedRight = new THREE.Vector3();
    let disposed = false;
    let state = 'idle';
    function render() { if (!disposed && !document.hidden) renderer.render(scene, camera); }
    function resize() {
        if (disposed) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        const mobile = window.innerWidth <= 640;
        const span = mobile ? 8.1 : 9.4;
        camera.left = -span / 2;
        camera.right = span / 2;
        camera.top = span * height / width / 2;
        camera.bottom = -camera.top;
        camera.position.set(0, mobile ? 3 : 4.6, 14);
        camera.lookAt(0, .05, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        // Match the original paper's slight inclination in screen space.
        machine.rotation.z = THREE.MathUtils.degToRad(window.innerWidth <= 1024 ? .5 : 1.2);
        machine.updateMatrixWorld(true);
        renderer.setSize(width, height, false);
        projectedLeft.copy(outletLeft).applyMatrix4(machine.matrixWorld).project(camera);
        projectedRight.copy(outletRight).applyMatrix4(machine.matrixWorld).project(camera);
        const paperWidth = (projectedRight.x - projectedLeft.x) * width / 2;
        const outletY = (1 - (projectedLeft.y + projectedRight.y) / 2) * height / 2;
        onOutlet(paperWidth, height - outletY);
        render();
    }
    function update(nextState, elapsed) {
        state = nextState;
        const feeding = state === 'printing';
        ledMaterial.emissiveIntensity = state === 'idle' ? 0 : state === 'warming-up' ? .35 + .15 * Math.sin(elapsed * .008) : .45;
        lid.position.y = .82 + (state === 'powering-on' ? Math.sin(Math.min(elapsed / 600, 1) * Math.PI) * .025 : 0);
        head.position.x = state === 'warming-up' ? Math.sin(elapsed * .004 - Math.PI / 2) * 3.1 : -3.2;
        roller.rotation.x = feeding ? elapsed * .012 : 0;
        render();
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        geometries.forEach(g => g.dispose());
        [shell, lidMaterial, dark, rubber, steel, ledMaterial].forEach(m => m.dispose());
        renderer.dispose();
        renderer.domElement.remove();
        host.classList.remove('has-webgl');
    }
    renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        dispose();
        onFailure();
    }, { once: true });
    try {
        host.append(renderer.domElement);
        resize();
        host.classList.add('has-webgl');
    } catch (error) {
        dispose();
        throw error;
    }
    return { resize, update, dispose };
}
