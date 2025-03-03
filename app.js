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

// Audio setup
let audioCtx, gainNode, filterNode, soundEnabled = false;

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create noise buffer
        const bufferSize = audioCtx.sampleRate * 2;  // 2 seconds buffer
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        // Generate pink-ish noise
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.5;
        }

        // Create noise source
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Create filter
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 400;
        filterNode.Q.value = 1.5;

        // Create gain node
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;

        // Connect nodes
        noiseSource.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Start noise
        noiseSource.start();
        
        console.log('Audio initialized successfully');
    } catch (error) {
        console.error('Audio initialization error:', error);
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
            // Initialize movement properties if they don't exist
            if (!point.movement) {
                point.movement = {
                    // Random 3D direction vector
                    dirX: Math.random() * 2 - 1,
                    dirY: Math.random() * 2 - 1,
                    dirZ: Math.random() * 2 - 1,
                    // Random speed
                    speed: 0.5 + Math.random() * 1.5,
                    // Time until next direction change
                    nextChange: Date.now() + 2000 + Math.random() * 5000
                };
                // Normalize direction vector
                const length = Math.sqrt(
                    point.movement.dirX * point.movement.dirX + 
                    point.movement.dirY * point.movement.dirY + 
                    point.movement.dirZ * point.movement.dirZ
                );
                point.movement.dirX /= length;
                point.movement.dirY /= length;
                point.movement.dirZ /= length;
            }

            // Check if it's time to change direction
            if (Date.now() > point.movement.nextChange) {
                // Gradually transition to new direction
                const newDirX = Math.random() * 2 - 1;
                const newDirY = Math.random() * 2 - 1;
                const newDirZ = Math.random() * 2 - 1;
                
                // Normalize new direction
                const length = Math.sqrt(newDirX * newDirX + newDirY * newDirY + newDirZ * newDirZ);
                
                // Smooth transition to new direction
                point.movement.dirX = 0.95 * point.movement.dirX + 0.05 * (newDirX / length);
                point.movement.dirY = 0.95 * point.movement.dirY + 0.05 * (newDirY / length);
                point.movement.dirZ = 0.95 * point.movement.dirZ + 0.05 * (newDirZ / length);
                
                // Random new speed
                point.movement.speed = 0.5 + Math.random() * 1.5;
                
                // Set next change time
                point.movement.nextChange = Date.now() + 2000 + Math.random() * 5000;
            }

            // Apply movement
            point.x += point.movement.dirX * point.movement.speed;
            point.y += point.movement.dirY * point.movement.speed;
            point.z += point.movement.dirZ * point.movement.speed;

            // Smooth boundary handling with direction reversal
            if (Math.abs(point.x) > 400) {
                point.x = Math.sign(point.x) * 400;
                point.movement.dirX *= -1;
                // Add slight random variation when bouncing
                point.movement.dirY += (Math.random() - 0.5) * 0.5;
                point.movement.dirZ += (Math.random() - 0.5) * 0.5;
            }
            if (Math.abs(point.y) > 400) {
                point.y = Math.sign(point.y) * 400;
                point.movement.dirY *= -1;
                point.movement.dirX += (Math.random() - 0.5) * 0.5;
                point.movement.dirZ += (Math.random() - 0.5) * 0.5;
            }
            if (point.z < 0 || point.z > 400) {
                point.z = point.z < 0 ? 0 : 400;
                point.movement.dirZ *= -1;
                point.movement.dirX += (Math.random() - 0.5) * 0.5;
                point.movement.dirY += (Math.random() - 0.5) * 0.5;
            }

            // Re-normalize direction vector after changes
            const length = Math.sqrt(
                point.movement.dirX * point.movement.dirX + 
                point.movement.dirY * point.movement.dirY + 
                point.movement.dirZ * point.movement.dirZ
            );
            point.movement.dirX /= length;
            point.movement.dirY /= length;
            point.movement.dirZ /= length;
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

function calculateSculptureState() {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let totalMovement = 0;
    let avgX = 0, avgY = 0, avgZ = 0;
    
    points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
        
        avgX += point.x;
        avgY += point.y;
        avgZ += point.z;
    });
    
    avgX /= points.length;
    avgY /= points.length;
    avgZ /= points.length;
    
    let totalDistanceFromCenter = 0;
    points.forEach(point => {
        const distFromCenter = Math.sqrt(
            Math.pow(point.x - avgX, 2) + 
            Math.pow(point.y - avgY, 2) + 
            Math.pow(point.z - avgZ, 2)
        );
        totalDistanceFromCenter += distFromCenter;
        
        if (point.lastPos) {
            const movement = Math.sqrt(
                Math.pow(point.x - point.lastPos.x, 2) +
                Math.pow(point.y - point.lastPos.y, 2) +
                Math.pow(point.z - point.lastPos.z, 2)
            );
            totalMovement += movement;
        }
        
        point.lastPos = { x: point.x, y: point.y, z: point.z };
    });
    
    const avgDistanceFromCenter = totalDistanceFromCenter / points.length;
    const avgMovement = totalMovement / points.length;
    
    return {
        size: avgDistanceFromCenter,
        maxSize: 400,
        movement: avgMovement,
        spread: avgDistanceFromCenter / 400,
        boundingBox: {
            width: maxX - minX,
            height: maxY - minY,
            depth: maxZ - minZ
        }
    };
}

function updateSound() {
    if (!audioCtx || !soundEnabled) return;

    try {
        const state = calculateSculptureState();
        
        const minFreq = 80;
        const maxFreq = 800;
        const sizeInfluence = Math.pow(1 - (state.size / state.maxSize), 1.5);
        let targetFreq = minFreq + (maxFreq - minFreq) * sizeInfluence;
        
        const movementInfluence = state.movement * 200;
        targetFreq += movementInfluence;
        
        targetFreq = Math.min(maxFreq, Math.max(minFreq, targetFreq));
        
        filterNode.frequency.exponentialRampToValueAtTime(
            targetFreq,
            audioCtx.currentTime + 0.05
        );
        
        const qMin = 0.5;
        const qMax = 4;
        const qValue = qMin + (qMax - qMin) * state.spread;
        filterNode.Q.linearRampToValueAtTime(
            qValue,
            audioCtx.currentTime + 0.05
        );
        
        const baseVolume = 0.05;
        const movementVolume = state.movement * 0.2;
        const spreadVolume = state.spread * 0.1;
        const targetVolume = Math.min(0.3, baseVolume + movementVolume + spreadVolume);
        
        gainNode.gain.linearRampToValueAtTime(
            targetVolume,
            audioCtx.currentTime + 0.05
        );
        
    } catch (error) {
        console.error('Sound update error:', error);
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

// Create and style buttons
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

// Update padding definition to be responsive
let VIEWPORT_PADDING = window.innerWidth < 480 ? 15 : 
                      window.innerWidth < 768 ? 20 : 30;

// Add title
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

// Create and position randomize button
const randomizeButton = document.createElement('button');
randomizeButton.textContent = 'Lines: random';
Object.assign(randomizeButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 50}px`
});
randomizeButton.addEventListener('mouseover', () => randomizeButton.style.background = '#333');
randomizeButton.addEventListener('mouseout', () => randomizeButton.style.background = 'black');
randomizeButton.addEventListener('click', randomizeLineEffect);
document.body.appendChild(randomizeButton);

// Create and position sound button
const soundButton = document.createElement('button');
soundButton.textContent = 'Sound: OFF';
Object.assign(soundButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 110}px`
});
soundButton.addEventListener('mouseover', () => soundButton.style.background = '#333');
soundButton.addEventListener('mouseout', () => soundButton.style.background = 'black');
soundButton.addEventListener('click', async () => {
    try {
        if (!audioCtx) {
            await initAudio();
            soundEnabled = true;
            soundButton.textContent = 'Sound: ON';
        } else {
            soundEnabled = !soundEnabled;
            gainNode.gain.setTargetAtTime(
                soundEnabled ? 0.1 : 0, 
                audioCtx.currentTime, 
                0.1
            );
            soundButton.textContent = `Sound: ${soundEnabled ? 'ON' : 'OFF'}`;
        }
    } catch (error) {
        console.error('Sound toggle error:', error);
    }
});
document.body.appendChild(soundButton);

// Create and position restart button
const restartButton = document.createElement('button');
restartButton.textContent = 'New Sculpture';
Object.assign(restartButton.style, buttonStyle, {
    left: `${VIEWPORT_PADDING}px`,
    top: `${VIEWPORT_PADDING + 170}px`
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

// Create info box
const infoBox = document.createElement('div');
Object.assign(infoBox.style, {
    position: 'fixed',
    left: `${VIEWPORT_PADDING}px`,
    bottom: '120px',  // Fixed larger value to prevent overlap
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

// Add copyright with responsive positioning
const copyright = document.createElement('div');
Object.assign(copyright.style, {
    position: 'fixed',
    right: `${VIEWPORT_PADDING}px`,  // Default to right side for desktop
    bottom: '30px',
    color: 'white',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: '1000'
});
copyright.innerHTML = '2025 Red Elephant - <a href="https://www.red-elephant.se/" target="_blank" style="color: white; text-decoration: none;">red-elephant.se</a>';
document.body.appendChild(copyright);

// Add responsive handling
window.addEventListener('resize', () => {
    VIEWPORT_PADDING = window.innerWidth < 480 ? 15 : 
                      window.innerWidth < 768 ? 20 : 30;
    
    if (window.innerWidth < 768) {  // Mobile breakpoint
        copyright.style.right = 'auto';
        copyright.style.left = `${VIEWPORT_PADDING}px`;
    } else {
        copyright.style.right = `${VIEWPORT_PADDING}px`;
        copyright.style.left = 'auto';
    }
    
    // Update all other element positions
    title.style.left = `${VIEWPORT_PADDING}px`;
    randomizeButton.style.left = `${VIEWPORT_PADDING}px`;
    soundButton.style.left = `${VIEWPORT_PADDING}px`;
    restartButton.style.left = `${VIEWPORT_PADDING}px`;
    infoBox.style.left = `${VIEWPORT_PADDING}px`;
});

// Trigger initial responsive layout
window.dispatchEvent(new Event('resize'));

// Initialize the first line effect
randomizeLineEffect();

// Start animation
initializePoints();
animate();
