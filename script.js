// 1. CONFIGURACIÓN THREE.JS
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 180; 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x020202, 1);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 1.2; 
controls.autoRotate = true; 
controls.autoRotateSpeed = 2.0;

controls.enableZoom = false;
controls.enablePan = false;

// Control de trackpad con passive: false para evitar zoom/scroll de la página
renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    scene.rotation.y -= e.deltaX * 0.005;
    scene.rotation.x -= e.deltaY * 0.005;
}, { passive: false });

// 2. GEOMETRÍA (Resolución optimizada para nitidez)
const scanWidth = 160;
const scanHeight = 120;
const totalPoints = scanWidth * scanHeight;

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(totalPoints * 3);
const colors = new Float32Array(totalPoints * 3);

let i = 0;
for (let y = 0; y < scanHeight; y++) {
    for (let x = 0; x < scanWidth; x++) {
        positions[i * 3] = (x - scanWidth / 2) * 1.5; 
        positions[i * 3 + 1] = -(y - scanHeight / 2) * 1.5; 
        positions[i * 3 + 2] = 0; 
        colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1; 
        i++;
    }
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Índices para Malla Wireframe
const indices = [];
for (let y = 0; y < scanHeight - 1; y++) {
    for (let x = 0; x < scanWidth - 1; x++) {
        const a = x + scanWidth * y;
        const b = x + 1 + scanWidth * y;
        const c = x + scanWidth * (y + 1);
        const d = x + 1 + scanWidth * (y + 1);
        indices.push(a, b, d);
        indices.push(a, d, c);
    }
}
geometry.setIndex(indices);

// 3. MATERIALES NÍTIDOS PARA LOS EFECTOS
const pointsMat = new THREE.PointsMaterial({ 
    size: 1.4, vertexColors: true, transparent: true, opacity: 0.95 
});

const tCanvas = document.createElement('canvas');
tCanvas.width = 64; tCanvas.height = 64;
const tCtx = tCanvas.getContext('2d');
tCtx.fillStyle = '#ffffff';
tCtx.font = 'bold 36px monospace';
tCtx.textAlign = 'center';
tCtx.textBaseline = 'middle';
tCtx.fillText('01', 32, 32);
const numTexture = new THREE.CanvasTexture(tCanvas);

const numbersMat = new THREE.PointsMaterial({ 
    size: 3.2,
    map: numTexture,
    alphaTest: 0.2,
    vertexColors: true, 
    transparent: true
});

const wireframeMat = new THREE.MeshBasicMaterial({ 
    vertexColors: true, 
    wireframe: true, 
    transparent: true, 
    opacity: 0.35 
});

const pointCloud = new THREE.Points(geometry, pointsMat);
const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);

scene.add(pointCloud);
scene.add(wireframeMesh);
wireframeMesh.visible = false; 

// 4. CONTROLES Y LÓGICA
const video = document.getElementById('sourceVideo');
const upload = document.getElementById('videoUpload');
const depthRange = document.getElementById('depthRange');
const colorTopInput = document.getElementById('colorTop');
const colorBottomInput = document.getElementById('colorBottom');
const formatSelect = document.getElementById('formatSelect');
const effectSelect = document.getElementById('effectSelect');
const btnToggleDepth = document.getElementById('btnToggleDepth');
const statusDepth = document.getElementById('statusDepth');
const btnToggleRotate = document.getElementById('btnToggleRotate');
const statusRotate = document.getElementById('statusRotate');
const downloadBtn = document.getElementById('downloadBtn');

let isAutoRotate = true;
let is3DDepth = true;

function hexToRgb(hex) {
    return {
        r: parseInt(hex.substring(1, 3), 16) / 255,
        g: parseInt(hex.substring(3, 5), 16) / 255,
        b: parseInt(hex.substring(5, 7), 16) / 255
    };
}

const hiddenCanvas = document.createElement('canvas');
hiddenCanvas.width = scanWidth; hiddenCanvas.height = scanHeight;
const ctx2d = hiddenCanvas.getContext('2d', { willReadFrequently: true });

upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;
        video.play();
        e.target.previousElementSibling.innerText = file.name.substring(0, 15) + "...";
    }
});

btnToggleDepth.addEventListener('click', () => {
    is3DDepth = !is3DDepth;
    statusDepth.innerText = is3DDepth ? "ON" : "OFF";
    
    if(is3DDepth) {
        statusDepth.classList.replace("bg-neutral-800", "bg-blue-600");
        statusDepth.classList.add("text-white");
    } else {
        statusDepth.classList.replace("bg-blue-600", "bg-neutral-800");
        statusDepth.classList.remove("text-white");
        camera.position.set(0, 0, 180);
        controls.target.set(0, 0, 0);
        scene.rotation.set(0, 0, 0);
    }
});

btnToggleRotate.addEventListener('click', () => {
    isAutoRotate = !isAutoRotate;
    statusRotate.innerText = isAutoRotate ? "ON" : "OFF";
    
    if(isAutoRotate) {
        statusRotate.classList.replace("bg-neutral-800", "bg-blue-600");
        statusRotate.classList.add("text-white");
    } else {
        statusRotate.classList.replace("bg-blue-600", "bg-neutral-800");
        statusRotate.classList.remove("text-white");
    }
    controls.autoRotate = isAutoRotate;
});

// 5. BUCLE PRINCIPAL DE RENDERIZADO 3D
function animate() {
    requestAnimationFrame(animate);
    
    if (video.readyState >= video.HAVE_CURRENT_DATA && !video.paused) {
        
        ctx2d.drawImage(video, 0, 0, scanWidth, scanHeight);
        const imageData = ctx2d.getImageData(0, 0, scanWidth, scanHeight).data;
        
        const posAttribute = geometry.attributes.position;
        const colAttribute = geometry.attributes.color;
        const posArray = posAttribute.array;
        const colArray = colAttribute.array;
        
        const depthMult = depthRange.value;
        const cTop = hexToRgb(colorTopInput.value);
        const cBot = hexToRgb(colorBottomInput.value);

        const mode = effectSelect.value;
        if (mode === 'wireframe') {
            pointCloud.visible = false;
            wireframeMesh.visible = true;
        } else {
            pointCloud.visible = true;
            wireframeMesh.visible = false;
            pointCloud.material = (mode === 'numbers') ? numbersMat : pointsMat;
        }

        let pt = 0;
        for (let y = 0; y < scanHeight; y++) {
            for (let x = 0; x < scanWidth; x++) {
                const idx = (y * scanWidth + x) * 4;
                const r = imageData[idx];
                const g = imageData[idx+1];
                const b = imageData[idx+2];
                
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                
                let zPos = is3DDepth ? (brightness / 255) * depthMult : 0;
                
                if (brightness < 12 && mode !== 'wireframe') {
                    zPos = -9999; 
                }

                posArray[pt * 3 + 2] = zPos;

                if (r > g * 1.3 && r > b * 1.3 && r > 40) {
                    colArray[pt * 3] = cTop.r; 
                    colArray[pt * 3 + 1] = cTop.g; 
                    colArray[pt * 3 + 2] = cTop.b; 
                } else {
                    const intensity = Math.min(1.0, (brightness / 255) * 1.5);
                    colArray[pt * 3] = cBot.r * intensity; 
                    colArray[pt * 3 + 1] = cBot.g * intensity; 
                    colArray[pt * 3 + 2] = cBot.b * intensity; 
                }
                pt++;
            }
        }
        posAttribute.needsUpdate = true;
        colAttribute.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

// 6. FORMATOS Y DESCARGA (Con alta calidad de video y bitrate forzado)
function resizeCanvas() {
    const format = formatSelect.value;
    let aspect = 16 / 9;
    if (format === '9:16') aspect = 9 / 16;
    if (format === '1:1') aspect = 1;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let currentAspect = w / h;

    if (currentAspect > aspect) { w = h * aspect; } 
    else { h = w / aspect; }

    renderer.setSize(w, h);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeCanvas);
formatSelect.addEventListener('change', resizeCanvas);
resizeCanvas();

let mediaRecorder;
let recordedChunks = [];

downloadBtn.addEventListener('click', () => {
    if (downloadBtn.innerText.includes("RECORDING")) return;
    
    // Capturar a 60 fps con alta tasa de bits para evitar pixelación
    const stream = renderer.domElement.captureStream(60); 
    mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'video/webm; codecs=vp9',
        bitsPerSecond: 8000000 
    });
    
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'EX8_Render.webm';
        a.click();
        
        recordedChunks = [];
        downloadBtn.innerHTML = `<span>Export Video</span> <span class="font-pixel text-sm">↗</span>`;
    };
    
    mediaRecorder.start();
    downloadBtn.innerHTML = `<span>[ RECORDING... CLICK TO STOP ]</span> <span class="font-pixel text-sm">⬛</span>`;
    downloadBtn.classList.replace("bg-white", "bg-red-600");
    downloadBtn.classList.replace("text-black", "text-white");
    downloadBtn.classList.remove("hover:bg-blue-600");
    
    video.currentTime = 0; 
    
    downloadBtn.onclick = () => {
        mediaRecorder.stop();
        downloadBtn.classList.replace("bg-red-600", "bg-white");
        downloadBtn.classList.replace("text-white", "text-black");
        downloadBtn.classList.add("hover:bg-blue-600");
        downloadBtn.onclick = null; 
    };
});
