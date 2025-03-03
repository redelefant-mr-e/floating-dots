// Basic setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Simple 3D point class
class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZ = 0;
    }

    project() {
        const focalLength = 400;
        const factor = focalLength / (focalLength + this.z);
        return {
            x: this.x * factor + canvas.width / 2,
            y: this.y * factor + canvas.height / 2
        };
    }
}

// Animation constants
const SPREAD_DURATION = 3000; // 3 seconds to spread
let startTime = Date.now();

let points = [];
let numPoints = 8;  // Make this variable for the restart function

// Starting position
let startPoint = {
    x: Math.random() * 800 - 400,
    y: Math.random() * 800 - 400,
    z: Math.random() * 400
};

// Add these new variables for line effects
let lineEffect = {
    type: 'distance',    // can be 'distance', 'center', 'random', 'wave'
    distanceMode: 'normal', // 'normal' or 'inverse'
    baseSegments: 12,
    baseIntensity: 30,
    speedMultiplier: 1
};

// Add this audio context and setup at the beginning of your code
let audioCtx;
let noiseNode;
let gainNode;
let filterNode;
let soundEnabled = false;

function initAudio() {
    try {
        // Create noise with shorter buffer for more immediate feedback
        const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 second buffer
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        // Fill buffer with more pronounced noise
        for (let i = 0; i < bufferSize; i++) {
            // Create pink-ish noise by adding weighted octaves
            let noise = 0;
            for (let octave = 0; octave < 3; octave++) {
                noise += (Math.random() * 2 - 1) * (1 / (octave + 1));
            }
            output[i] = noise * 0.5; // Scale down the amplitude
        }

        // Create and configure nodes
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        noiseNode.loop = true;

        // More relaxing filter settings
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = "bandpass";
        filterNode.frequency.setValueAtTime(300, audioCtx.currentTime); // Lower base frequency
        filterNode.Q.setValueAtTime(2, audioCtx.currentTime); // Wider bandwidth for softer sound

        // Add a second filter for more shaping
        const filter2 = audioCtx.createBiquadFilter();
        filter2.type = "lowpass";
        filter2.frequency.setValueAtTime(2000, audioCtx.currentTime);

        gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        // Connect nodes with second filter
        noiseNode.connect(filterNode);
        filterNode.connect(filter2);
        filter2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Start noise
        noiseNode.start();
        console.log('Audio nodes initialized with test volume');
    } catch (error) {
        console.error('Error initializing audio:', error);
    }
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function initializePoints() {
    points = [];
    for (let i = 0; i < numPoints; i++) {
        const point = new Point3D(
            startPoint.x,
            startPoint.y,
            startPoint.z
        );
        // Set random target positions within tighter bounds
        point.targetX = Math.random() * 800 - 400;  // ±400 range
        point.targetY = Math.random() * 800 - 400;  // ±400 range
        point.targetZ = Math.random() * 400;        // 0-400 range
        points.push(point);
    }
}

function updatePositions() {
    const currentTime = Date.now() - startTime;
    
    points.forEach(point => {
        if (currentTime < SPREAD_DURATION) {
            // Initial spreading phase
            const spreadProgress = easeInOutCubic(currentTime / SPREAD_DURATION);
            point.x = startPoint.x + (point.targetX - startPoint.x) * spreadProgress;
            point.y = startPoint.y + (point.targetY - startPoint.y) * spreadProgress;
            point.z = startPoint.z + (point.targetZ - startPoint.z) * spreadProgress;
        } else {
            // Organic movement phase
            const time = Date.now() * 0.0005; // Slowed down time factor (was 0.001)
            
            // Smoother sine wave movement
            point.x += Math.sin(time + point.targetX) * 1.5;  // Reduced amplitude (was 2)
            point.y += Math.cos(time + point.targetY) * 1.5;
            point.z += Math.sin(time * 0.3 + point.targetZ) * 1.5;  // Slower Z movement
            
            // Reduced random movement
            point.x += (Math.random() - 0.5) * 0.8;  // Reduced from 3 to 0.8
            point.y += (Math.random() - 0.5) * 0.8;
            point.z += (Math.random() - 0.5) * 0.8;
            
            // Boundary checks
            point.x = Math.max(-400, Math.min(400, point.x));
            point.y = Math.max(-400, Math.min(400, point.y));
            point.z = Math.max(0, Math.min(400, point.z));
        }
    });
}

function createLightningPoints(start, end) {
    const points = [];
    points.push({ x: start.x, y: start.y });

    let intensity = lineEffect.baseIntensity;
    let segments = lineEffect.baseSegments;
    
    switch(lineEffect.type) {
        case 'distance':
            const distance = Math.hypot(end.x - start.x, end.y - start.y);
            const normalizedDist = distance / 500;
            intensity *= lineEffect.distanceMode === 'normal' ? 
                normalizedDist : (1 - normalizedDist * 0.5);
            break;
        case 'center':
            const centerDist = Math.hypot(start.x - canvas.width/2, start.y - canvas.height/2);
            intensity *= (centerDist / 400);
            break;
        case 'random':
            intensity *= (0.5 + Math.random());
            break;
        case 'wave':
            const time = Date.now() * 0.001 * lineEffect.speedMultiplier;
            intensity *= (1 + Math.sin(time + (start.x + start.y) * 0.01)) * 0.5;
            break;
    }

    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = start.x + (end.x - start.x) * t;
        const baseY = start.y + (end.y - start.y) * t;

        const displacement = intensity * Math.sin(t * Math.PI);
        const angle = Math.atan2(end.y - start.y, end.x - start.x) + Math.PI/2;
        
        points.push({
            x: baseX + Math.cos(angle) * (Math.random() - 0.5) * displacement,
            y: baseY + Math.sin(angle) * (Math.random() - 0.5) * displacement
        });
    }

    points.push({ x: end.x, y: end.y });
    return points;
}

function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw connections with lightning effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const p1 = points[i].project();
            const p2 = points[j].project();
            
            const lightningPoints = createLightningPoints(p1, p2);
            
            ctx.beginPath();
            ctx.moveTo(lightningPoints[0].x, lightningPoints[0].y);
            
            for (let k = 1; k < lightningPoints.length; k++) {
                ctx.lineTo(lightningPoints[k].x, lightningPoints[k].y);
            }
            
            ctx.stroke();
        }
    }

    // Draw points
    ctx.fillStyle = 'white';
    points.forEach(point => {
        const projected = point.project();
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Add this function to calculate overall "energy"
function calculateSystemEnergy() {
    let totalEnergy = 0;
    let maxDistance = 0;
    let totalIntensity = 0;
    let lineCount = 0;
    
    // Calculate line intensities along with other metrics
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const p1 = points[i].project();
            const p2 = points[j].project();
            
            // Get line intensity based on current effect
            let intensity = lineEffect.baseIntensity;
            const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            
            if (lineEffect.type === 'distance') {
                const normalizedDist = distance / 500;
                intensity *= lineEffect.distanceMode === 'normal' ? 
                    normalizedDist : (1 - normalizedDist * 0.5);
            }
            
            totalIntensity += intensity;
            lineCount++;
            
            maxDistance = Math.max(maxDistance, distance);
            const speed = Math.abs(points[i].x - (points[i].prevX || points[i].x)) +
                         Math.abs(points[i].y - (points[i].prevY || points[i].y));
            totalEnergy += speed;
        }
    }

    return {
        energy: totalEnergy / points.length,
        maxDistance: maxDistance,
        avgIntensity: totalIntensity / (lineCount || 1)
    };
}

// Modify your animation loop to include sound updates
function updateSound() {
    if (!audioCtx || !soundEnabled) return;

    const { energy, maxDistance, avgIntensity } = calculateSystemEnergy();
    
    // Amplify the intensity factor for more dramatic effect
    const intensityFactor = Math.pow(avgIntensity / lineEffect.baseIntensity, 2); // Square for more contrast
    
    // Base volume with more dramatic response to intensity
    const baseVolume = 0.02;
    const volume = Math.min(baseVolume + (energy * 0.2 + intensityFactor * 0.2), 0.4);
    gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.05);

    // Frequency affected by distance and line effect type
    const baseFreq = 100;
    const maxFreq = 800;
    let freqMod = 1;
    
    // More dramatic frequency modulation based on line effect type
    switch(lineEffect.type) {
        case 'wave':
            freqMod = 1 + Math.sin(Date.now() * 0.001 * lineEffect.speedMultiplier) * 0.5; // Increased range
            break;
        case 'random':
            freqMod = 0.5 + Math.random() * 1.0; // More random variation
            break;
        case 'distance':
            if (lineEffect.distanceMode === 'normal') {
                freqMod = 1 + intensityFactor * 0.5; // Intensity affects frequency more
            } else {
                freqMod = 1 / (1 + intensityFactor * 0.3);
            }
            break;
    }
    
    const frequency = (baseFreq + (maxDistance * (maxFreq - baseFreq) / 1000)) * freqMod;
    filterNode.frequency.setTargetAtTime(frequency, audioCtx.currentTime, 0.05);
    
    // More dramatic Q value modulation based on intensity
    const qBase = 1.5;
    const qRange = intensityFactor * 4; // Increased range
    const qValue = qBase + Math.sin(Date.now() * 0.002 * lineEffect.speedMultiplier) * qRange;
    filterNode.Q.setTargetAtTime(qValue, audioCtx.currentTime, 0.1);
    
    // Enhanced crackle effect for high intensity
    if (intensityFactor > 1.0) { // Trigger earlier
        const crackleIntensity = Math.pow(intensityFactor - 1.0, 2) * 0.2; // More dramatic crackling
        const time = audioCtx.currentTime;
        
        // Multiple crackle pulses for more electric feel
        for (let i = 0; i < 3; i++) {
            const pulseTime = time + i * 0.02;
            gainNode.gain.setValueAtTime(volume + crackleIntensity, pulseTime);
            gainNode.gain.setTargetAtTime(volume, pulseTime + 0.01, 0.01);
        }
    }
}

// Modify your animate function to include sound
function animate() {
    updatePositions();
    if (soundEnabled) {
        updateSound();
    }
    draw();
    requestAnimationFrame(animate);
}

// Add randomize function for line effects
function randomizeLineEffect() {
    const effects = ['distance', 'center', 'random', 'wave'];
    lineEffect.type = effects[Math.floor(Math.random() * effects.length)];
    
    // Update button text and info box based on mode
    if (lineEffect.type === 'distance') {
        lineEffect.distanceMode = Math.random() < 0.5 ? 'normal' : 'inverse';
        randomizeButton.textContent = `Lines: ${lineEffect.type} (${lineEffect.distanceMode})`;
        
        if (lineEffect.distanceMode === 'normal') {
            infoBox.textContent = 'Distance Mode (Normal): Lines become more electric as dots move further apart.';
        } else {
            infoBox.textContent = 'Distance Mode (Inverse): Lines become more electric as dots move closer together.';
        }
    } else {
        lineEffect.distanceMode = 'normal';
        randomizeButton.textContent = `Lines: ${lineEffect.type}`;
        
        switch(lineEffect.type) {
            case 'center':
                infoBox.textContent = 'Center Mode: Lines become more electric as dots move away from the center of the canvas.';
                break;
            case 'random':
                infoBox.textContent = 'Random Mode: Each line has a randomly assigned electric intensity.';
                break;
            case 'wave':
                infoBox.textContent = 'Wave Mode: Line intensity pulses over time, creating flowing electric patterns.';
                break;
        }
    }
    
    lineEffect.baseSegments = Math.floor(Math.random() * 15) + 5;
    lineEffect.baseIntensity = Math.random() * 50 + 10;
    lineEffect.speedMultiplier = Math.random() * 2 + 0.5;
}

// Define viewport padding at the top of the file
const VIEWPORT_PADDING = 30;

// Add title after canvas setup
const title = document.createElement('h1');
title.textContent = 'Floating Dots';
Object.assign(title.style, {
    position: 'fixed',
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING}px`,
    color: 'white',
    fontFamily: 'monospace',
    fontSize: '20px',
    margin: '0',
    padding: '0',
    zIndex: '1000'
});
document.body.appendChild(title);

// Button styling (keep your existing style)
const buttonStyle = {
    position: 'fixed',
    padding: '12px 20px',
    background: 'black',
    color: 'white',
    border: '1px solid white',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '14px',
    transition: 'all 0.3s ease'
};

// Create and position randomize button
const randomizeButton = document.createElement('button');
randomizeButton.textContent = 'Lines: random';
Object.assign(randomizeButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 50}px`  // Position below title
});
randomizeButton.addEventListener('mouseover', () => randomizeButton.style.background = '#333');
randomizeButton.addEventListener('mouseout', () => randomizeButton.style.background = 'black');
randomizeButton.addEventListener('click', randomizeLineEffect);
document.body.appendChild(randomizeButton);

// Create and position restart button
const restartButton = document.createElement('button');
restartButton.textContent = 'New Sculpture';
Object.assign(restartButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 110}px`  // Position below randomize button
});
restartButton.addEventListener('mouseover', () => restartButton.style.background = '#333');
restartButton.addEventListener('mouseout', () => restartButton.style.background = 'black');
restartButton.addEventListener('click', () => {
    const minDots = 3;
    const maxDots = 55;
    numPoints = Math.floor(Math.random() * (maxDots - minDots + 1)) + minDots;
    startPoint = {
        x: Math.random() * 800 - 400,
        y: Math.random() * 800 - 400,
        z: Math.random() * 400
    };
    startTime = Date.now();
    initializePoints();
});
document.body.appendChild(restartButton);

// Create and position sound button
const soundButton = document.createElement('button');
soundButton.textContent = 'Sound: OFF';
Object.assign(soundButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 170}px`  // Position below restart button
});
soundButton.addEventListener('mouseover', () => soundButton.style.background = '#333');
soundButton.addEventListener('mouseout', () => soundButton.style.background = 'black');
soundButton.addEventListener('click', async () => {
    try {
        if (!audioCtx) {
            // Create audio context on first click
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            await audioCtx.resume();
            initAudio();
            soundEnabled = true;
            soundButton.textContent = 'Sound: ON';
            console.log('Audio initialized');
        } else {
            if (soundEnabled) {
                gainNode.gain.value = 0;
                soundEnabled = false;
                soundButton.textContent = 'Sound: OFF';
                console.log('Sound disabled');
            } else {
                await audioCtx.resume();
                soundEnabled = true;
                soundButton.textContent = 'Sound: ON';
                console.log('Sound enabled');
            }
        }
    } catch (error) {
        console.error('Audio error:', error);
    }
});
document.body.appendChild(soundButton);

// Create info box
const infoBox = document.createElement('div');
Object.assign(infoBox.style, {
    position: 'fixed',
    left: `${VIEWPORT_PADDING}px`,
    bottom: `${VIEWPORT_PADDING}px`,
    padding: '12px 20px',
    background: 'black',
    color: 'white',
    border: '1px solid white',
    fontFamily: 'monospace',
    fontSize: '14px',
    maxWidth: '300px',
    transition: 'all 0.3s ease'
});
document.body.appendChild(infoBox);

// Call randomizeLineEffect once at start to set initial info
randomizeLineEffect();

// Start animation
initializePoints();
animate();

// Add responsive handling
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Adjust viewport padding based on screen size
    VIEWPORT_PADDING = window.innerWidth < 480 ? 15 : 
                      window.innerWidth < 768 ? 20 : 30;
                      
    // Adjust point size based on screen size
    POINT_SIZE = window.innerWidth < 480 ? 2 : 
                 window.innerWidth < 768 ? 2.5 : 3;
                 
    // Adjust movement boundaries based on screen size
    const boundaryLimit = Math.min(window.innerWidth, window.innerHeight) * 0.4;
    BOUNDARY_LIMIT = {
        x: boundaryLimit,
        y: boundaryLimit,
        z: boundaryLimit
    };
    
    updateUIPositions();
    
    if (window.innerWidth < 480) { // Mobile
        title.style.fontSize = '16px';
    } else if (window.innerWidth < 768) { // Tablet
        title.style.fontSize = '18px';
    } else { // Desktop
        title.style.fontSize = '20px';
    }
}

// Function to update UI element positions
function updateUIPositions() {
    let container = document.querySelector('.controls-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'controls-container';
        document.body.appendChild(container);
    }

    if (window.innerWidth < 480) { // Mobile
        title.style.fontSize = '16px';
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING + 40}px`, // Space for title
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        });
    } else if (window.innerWidth < 768) { // Tablet
        title.style.fontSize = '18px';
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING + 45}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
        });
    } else { // Desktop
        title.style.fontSize = '20px';
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        });
    }

    // Move buttons to container if they're not already there
    if (!randomizeButton.parentElement === container) {
        container.appendChild(randomizeButton);
        container.appendChild(soundButton);
        container.appendChild(restartButton);
    }

    // Update button and info box positions
    if (window.innerWidth < 480) { // Mobile
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        });

        Object.assign(infoBox.style, {
            left: `${VIEWPORT_PADDING}px`,
            bottom: `${VIEWPORT_PADDING}px`,
            maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
            fontSize: '11px',
            padding: '8px 12px'
        });
    } else if (window.innerWidth < 768) { // Tablet
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
        });

        Object.assign(infoBox.style, {
            left: `${VIEWPORT_PADDING}px`,
            bottom: `${VIEWPORT_PADDING}px`,
            maxWidth: '250px',
            fontSize: '12px',
            padding: '10px 16px'
        });
    } else { // Desktop
        // Keep original desktop styling
        Object.assign(container.style, {
            position: 'fixed',
            left: `${VIEWPORT_PADDING}px`,
            top: `${VIEWPORT_PADDING}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        });

        Object.assign(infoBox.style, {
            left: `${VIEWPORT_PADDING}px`,
            bottom: `${VIEWPORT_PADDING}px`,
            maxWidth: '300px',
            fontSize: '14px',
            padding: '12px 20px'
        });
    }
}

// Add event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// Initial setup
handleResize();
