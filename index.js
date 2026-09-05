const gameDetails = {
	"gravity-lab": "Gravity Lab",
	"orbital-run": "Orbital Run",
	"bridge-builder": "Bridge Builder",
	"rocket-yard": "Rocket Yard",
	"marble-circuit": "Marble Circuit",
	"crash-test": "Crash Test"
};

const gameId = new URLSearchParams(window.location.search).get("game");

if (gameId) {
	const gameName = gameDetails[gameId] || "Untitled Game";
	const startScreen = document.querySelector(".start-screen");
	const gameScreen = document.querySelector(".game-screen");
	const gameNameElement = document.querySelector("#game-name");
	const canvasContainer = document.querySelector("#game-canvas");

	startScreen.hidden = true;
	gameScreen.hidden = false;
	gameNameElement.textContent = gameName;
	document.title = `${gameName} | New Project(1)`;
	document.body.classList.add("game-mode");

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	const world = new CANNON.World();
	const dynamicObjects = [];
	const keys = {};
	const playerStart = {
		"gravity-lab": [-4, 3.2, 1.8],
		"orbital-run": [-3, 1.4, 2],
		"bridge-builder": [-4, 1.3, 2],
		"rocket-yard": [-3.2, 1.2, 2],
		"marble-circuit": [-4.5, 2.2, 2],
		"crash-test": [-4, 1.2, 2]
	};
	const puzzleStarts = {
		"gravity-lab": [-2.5, 3.4, 1.8],
		"orbital-run": [-1.2, 2, 2],
		"bridge-builder": [-2.4, 4, 2],
		"rocket-yard": [-1.5, 1.2, 2],
		"marble-circuit": [-2.5, 2.2, 2],
		"crash-test": [-2.2, 1.2, 2]
	};
	const puzzleTargets = {
		"gravity-lab": [2.8, 0.2, 0],
		"orbital-run": [2.8, 0.2, 0],
		"bridge-builder": [2.8, 0.2, 0],
		"rocket-yard": [2.8, 0.2, 0],
		"marble-circuit": [2.8, 0.2, 0],
		"crash-test": [2.8, 0.2, 0]
	};
	let playerBody;
	let playerGrounded = false;
	let heldObject = null;
	let puzzleTarget;
	let puzzleSolved = false;
	let yaw = 0;
	let pitch = 0;

	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	canvasContainer.appendChild(renderer.domElement);
	world.gravity.set(0, -9.82, 0);

	const materials = {
		ink: new THREE.MeshStandardMaterial({ color: 0x17212b, roughness: 0.8 }),
		red: new THREE.MeshStandardMaterial({ color: 0xd94b3d, roughness: 0.55 }),
		yellow: new THREE.MeshStandardMaterial({ color: 0xf0b94a, roughness: 0.55 }),
		teal: new THREE.MeshStandardMaterial({ color: 0x4c9b98, roughness: 0.6 }),
		blue: new THREE.MeshStandardMaterial({ color: 0x4c7982, roughness: 0.6 }),
		white: new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.7 })
	};

	function addBoxVisual(size, position, material, rotation = [0, 0, 0]) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
		mesh.position.set(...position);
		mesh.rotation.set(...rotation);
		scene.add(mesh);
		return mesh;
	}

	function addStaticBox(size, position, material, rotation = [0, 0, 0]) {
		const mesh = addBoxVisual(size, position, material, rotation);
		const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)) });
		body.position.set(...position);
		body.quaternion.setFromEuler(...rotation);
		world.addBody(body);
		return mesh;
	}

	function addDynamicBox(size, position, material) {
		const mesh = addBoxVisual(size, position, material);
		const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)) });
		body.position.set(...position);
		world.addBody(body);
		dynamicObjects.push({ mesh, body });
		return mesh;
	}

	function addDynamicSphere(radius, position, material) {
		const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
		mesh.position.set(...position);
		scene.add(mesh);
		const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius) });
		body.position.set(...position);
		world.addBody(body);
		dynamicObjects.push({ mesh, body });
		return mesh;
	}

	function createPlayer(position) {
		playerBody = new CANNON.Body({ mass: 5, shape: new CANNON.Box(new CANNON.Vec3(0.375, 0.6, 0.375)) });
		playerBody.position.set(...position);
		playerBody.fixedRotation = true;
		playerBody.updateMassProperties();
		playerBody.linearDamping = 0.1;
		world.addBody(playerBody);
	}

	function createPuzzle() {
		const crateMesh = addDynamicBox([1, 1, 1], puzzleStarts[gameId] || [-2, 1.2, 2], materials.yellow);
		const crateBody = dynamicObjects[dynamicObjects.length - 1].body;
		const targetPosition = puzzleTargets[gameId] || [2.8, 0.2, 0];
		puzzleTarget = new THREE.Mesh(
			new THREE.BoxGeometry(1.35, 0.08, 1.35),
			new THREE.MeshStandardMaterial({ color: 0x4c9b98, emissive: 0x153b3b, transparent: true, opacity: 0.8 })
		);
		puzzleTarget.position.set(...targetPosition);
		scene.add(puzzleTarget);
		return { mesh: crateMesh, body: crateBody };
	}

	function addFloor(color = 0x253541) {
		scene.background = new THREE.Color(color);
		addStaticBox([14, 0.25, 10], [0, -0.2, 0], materials.ink);
		const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
		floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
		world.addBody(floorBody);
		const grid = new THREE.GridHelper(14, 14, 0x60727c, 0x334650);
		grid.position.y = -0.05;
		scene.add(grid);
	}

	function createGravityLab() {
		addFloor(0x253541);
		addStaticBox([3.4, 0.35, 1.4], [-2.8, 1.3, 0], materials.blue, [0, 0, -0.18]);
		addStaticBox([3.2, 0.35, 1.4], [1.2, 2.3, 0], materials.teal, [0, 0, 0.2]);
		addStaticBox([2.4, 0.35, 1.4], [3.2, 0.7, 0], materials.yellow, [0, 0, -0.2]);
		addDynamicSphere(0.42, [-4, 4.5, 0], materials.red);
		camera.position.set(7, 5.5, 9);
		camera.lookAt(0, 1, 0);
	}

	function createOrbitalRun() {
		addFloor(0x28253f);
		const planet = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), materials.red);
		planet.position.set(0, 1.5, 0);
		scene.add(planet);
		const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.06, 12, 64), materials.yellow);
		ring.rotation.x = Math.PI / 2.7;
		ring.position.y = 1.5;
		scene.add(ring);
		addDynamicSphere(0.32, [0, 5, 0], materials.white);
		camera.position.set(6, 4.5, 8);
		camera.lookAt(0, 1.3, 0);
	}

	function createBridgeBuilder() {
		addFloor(0x3d302b);
		addStaticBox([1.4, 3.2, 1.4], [-4.2, 1.5, 0], materials.blue);
		addStaticBox([1.4, 3.2, 1.4], [4.2, 1.5, 0], materials.blue);
		for (let index = 0; index < 5; index += 1) {
			addDynamicBox([1.6, 0.28, 1.1], [-3.2 + index * 1.6, 3.1, 0], materials.yellow);
		}
		camera.position.set(7, 4.2, 9);
		camera.lookAt(0, 1.7, 0);
	}

	function createRocketYard() {
		addFloor(0x253541);
		addStaticBox([0.35, 4, 0.35], [-2, 2, 0], materials.yellow);
		addStaticBox([0.35, 4, 0.35], [2, 2, 0], materials.yellow);
		addStaticBox([5, 0.25, 2.5], [0, 0.1, 0], materials.red);
		const rocket = new THREE.Group();
		const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.3, 20), materials.white);
		const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 20), materials.red);
		nose.position.y = 1.65;
		rocket.add(body, nose);
		rocket.position.set(0, 2, 0);
		scene.add(rocket);
		addDynamicBox([1, 1, 1], [0, 5, 0], materials.yellow);
		camera.position.set(7, 4.5, 9);
		camera.lookAt(0, 2, 0);
	}

	function createMarbleCircuit() {
		addFloor(0x1d4142);
		for (let index = 0; index < 4; index += 1) {
			const x = -3.6 + index * 2.4;
			addStaticBox([1.8, 0.25, 1.8], [x, 0.7 + (index % 2) * 0.7, 0], materials.teal, [0, 0, index % 2 ? 0.15 : -0.15]);
		}
		addDynamicSphere(0.38, [-4.5, 3.5, 0], materials.yellow);
		camera.position.set(7, 5.8, 9);
		camera.lookAt(0, 1, 0);
	}

	function createCrashTest() {
		addFloor(0x3d302b);
		for (let index = 0; index < 4; index += 1) {
			addStaticBox([0.9, 1.1 + index * 0.35, 1.5], [2.6, 0.55 + index * 0.18, 0], index % 2 ? materials.yellow : materials.red);
		}
		addDynamicBox([1.7, 1, 2.3], [-4, 2.5, 0], materials.blue);
		camera.position.set(8, 4.5, 10);
		camera.lookAt(0, 1.2, 0);
	}

	const sceneFactories = {
		"gravity-lab": createGravityLab,
		"orbital-run": createOrbitalRun,
		"bridge-builder": createBridgeBuilder,
		"rocket-yard": createRocketYard,
		"marble-circuit": createMarbleCircuit,
		"crash-test": createCrashTest
	};

	(sceneFactories[gameId] || createGravityLab)();
	const puzzleObject = createPuzzle();
	createPlayer(playerStart[gameId] || [0, 2, 2]);
	scene.add(new THREE.HemisphereLight(0xf4f6f7, 0x17212b, 1.8));
	const keyLight = new THREE.DirectionalLight(0xffffff, 2);
	keyLight.position.set(4, 8, 5);
	scene.add(keyLight);

	function resizeScene() {
		const width = canvasContainer.clientWidth;
		const height = canvasContainer.clientHeight;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height, false);
	}

	function updateHeldObject() {
		if (!heldObject) {
			return;
		}

		const holdPosition = new THREE.Vector3(0, -0.15, -2).applyQuaternion(camera.quaternion).add(camera.position);
		heldObject.body.position.copy(holdPosition);
		heldObject.body.quaternion.set(0, 0, 0, 1);
		heldObject.body.velocity.set(0, 0, 0);
	}

	function interactWithPuzzle() {
		if (puzzleSolved) {
			return;
		}

		if (heldObject) {
			heldObject.body.type = CANNON.Body.DYNAMIC;
			heldObject.body.mass = 1;
			heldObject.body.collisionResponse = true;
			heldObject.body.updateMassProperties();
			heldObject.body.velocity.set(0, 0, 0);
			const distanceToTarget = heldObject.body.position.distanceTo(puzzleTarget.position);
			if (distanceToTarget < 1.1) {
				heldObject.body.position.set(puzzleTarget.position.x, puzzleTarget.position.y + 0.55, puzzleTarget.position.z);
				puzzleTarget.material.color.setHex(0xf0b94a);
				puzzleTarget.material.emissive.setHex(0x6b4f14);
				puzzleSolved = true;
				document.querySelector("#game-message").textContent = "Puzzle solved. Nice work.";
			} else {
				document.querySelector("#game-message").textContent = "Keep searching for the target.";
			}
			heldObject = null;
			return;
		}

		const distanceToCrate = playerBody.position.distanceTo(puzzleObject.body.position);
		if (distanceToCrate < 3.2) {
			heldObject = puzzleObject;
			heldObject.body.type = CANNON.Body.KINEMATIC;
			heldObject.body.mass = 0;
			heldObject.body.collisionResponse = false;
			heldObject.body.updateMassProperties();
			document.querySelector("#game-message").textContent = "Carrying crate. Face the target and press E to place it.";
		} else {
			document.querySelector("#game-message").textContent = "Move closer to the crate to pick it up.";
		}
	}

	function updatePlayer() {
		if (!playerBody) {
			return;
		}

		const forward = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
		const strafe = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
		const movement = new THREE.Vector2(
			-Math.sin(yaw) * forward + Math.cos(yaw) * strafe,
			-Math.cos(yaw) * forward - Math.sin(yaw) * strafe
		);
		if (movement.length() > 0) {
			const moveSpeed = keys.shift ? 12 : 8;
			movement.normalize().multiplyScalar(moveSpeed);
		}
		playerBody.velocity.x = movement.x;
		playerBody.velocity.z = movement.y;
		playerGrounded = playerBody.position.y <= 1.25 && Math.abs(playerBody.velocity.y) < 1.2;

		if (keys[" "] && playerGrounded) {
			playerBody.velocity.y = gameId === "rocket-yard" ? 9 : 6.5;
			playerGrounded = false;
		}
		updateHeldObject();
	}

	function updateCamera() {
		camera.position.set(playerBody.position.x, playerBody.position.y + 0.55, playerBody.position.z);
		camera.rotation.order = "YXZ";
		camera.rotation.y = yaw;
		camera.rotation.x = pitch;
	}

	function animate() {
		updatePlayer();
		world.step(1 / 60);
		dynamicObjects.forEach(({ mesh, body }) => {
			mesh.position.copy(body.position);
			mesh.quaternion.copy(body.quaternion);
		});
		updateCamera();
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
	}

	window.addEventListener("resize", resizeScene);
	window.addEventListener("keydown", (event) => {
		const key = event.key.toLowerCase();
		keys[key] = true;
		if (key === "e" && !event.repeat) {
			interactWithPuzzle();
		}
		if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
			event.preventDefault();
		}
	});
	window.addEventListener("keyup", (event) => {
		keys[event.key.toLowerCase()] = false;
	});
	window.addEventListener("blur", () => {
		Object.keys(keys).forEach((key) => {
			keys[key] = false;
		});
	});
	canvasContainer.addEventListener("click", () => {
		canvasContainer.requestPointerLock();
	});
	document.addEventListener("pointerlockchange", () => {
		if (document.pointerLockElement !== canvasContainer) {
			Object.keys(keys).forEach((key) => {
				keys[key] = false;
			});
		}
	});
	document.addEventListener("mousemove", (event) => {
		if (document.pointerLockElement !== canvasContainer) {
			return;
		}
		yaw -= event.movementX * 0.0025;
		pitch -= event.movementY * 0.0025;
		pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
	});
	resizeScene();
	animate();

	window.PhysXGame = { scene, camera, renderer, world, dynamicObjects, playerBody, puzzleObject };
}
