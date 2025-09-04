// === VARIABILI GLOBALI ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const controlPanel = document.getElementById('control-panel');
const crosshair = document.getElementById('crosshair');
const touchIndicator = document.getElementById('touch-indicator');
const segmentsList = document.getElementById('segments-list');
const zoomLevel = document.getElementById('zoom-level');

let img = new Image();
let points = [];
let segments = [];
let selectedSegment = null;
let isDragging = false;
let scaleFactor = 1;
let zoomFactor = 1;
let imgX = 0;
let imgY = 0;

// Touch gesture variables
let touches = [];
let initialDistance = 0;
let initialZoom = 1;
let lastTouchTime = 0;
let panStartX = 0;
let panStartY = 0;
let isPanning = false;
let isMultiTouch = false;

// UI State
let panelOpen = false;
let segmentCounter = 1;

// === FUNZIONI CORE ===
function loadImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    img.src = URL.createObjectURL(file);
    
    img.onload = function() {
        resizeCanvas();
        resetView();
        segments = [];
        points = [];
        selectedSegment = null;
        segmentCounter = 1;
        drawCanvas();
        updateSegmentsList();
        showToast('Immagine caricata con successo', 'success');
    };
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Ottimizzazione per differenti orientamenti e dispositivi
    let maxCanvasWidth, maxCanvasHeight;
    
    if (window.innerWidth >= 768 && window.matchMedia("(orientation: landscape)").matches) {
        // Tablet landscape: massimizza lo spazio orizzontale
        maxCanvasWidth = containerRect.width - 20;
        maxCanvasHeight = containerRect.height - 20;
    } else if (window.innerWidth >= 768) {
        // Tablet portrait
        maxCanvasWidth = containerRect.width - 30;
        maxCanvasHeight = containerRect.height - 30;
    } else {
        // Mobile
        maxCanvasWidth = Math.min(containerRect.width - 40, window.innerWidth - 40);
        maxCanvasHeight = Math.min(containerRect.height - 40, window.innerHeight - 140);
    }
    
    if (img.width && img.height) {
        const widthRatio = maxCanvasWidth / img.width;
        const heightRatio = maxCanvasHeight / img.height;
        scaleFactor = Math.min(widthRatio, heightRatio);

        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;
    } else {
        canvas.width = maxCanvasWidth;
        canvas.height = maxCanvasHeight;
    }
}

function drawCanvas() {
    if (!img.complete) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoomFactor, zoomFactor);
    
    // Disegna l'immagine
    ctx.drawImage(img, imgX, imgY, img.width * scaleFactor, img.height * scaleFactor);
    
    // Disegna tutti i segmenti
    segments.forEach(segment => drawSegment(segment));
    
    // Disegna i punti temporanei se ci sono
    if (points.length > 0) {
        drawTemporaryPoints();
    }
    
    ctx.restore();
    updateZoomLevel();
}

function drawSegment(segment) {
    const startX = (segment.start.x * scaleFactor) + imgX;
    const startY = (segment.start.y * scaleFactor) + imgY;
    const endX = (segment.end.x * scaleFactor) + imgX;
    const endY = (segment.end.y * scaleFactor) + imgY;
    
    // Linea principale
    ctx.strokeStyle = segment === selectedSegment ? 'rgba(0, 123, 255, 0.7)' : 'rgba(220, 53, 69, 0.6)';
    ctx.lineWidth = segment === selectedSegment ? 2 : 1;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Punti di controllo
    drawControlPoint(startX, startY, segment === selectedSegment);
    drawControlPoint(endX, endY, segment === selectedSegment);
    
    // Etichetta con la misura
    if (segment === selectedSegment) {
        drawMeasurementLabel(segment, startX, startY, endX, endY);
    }
}

function drawControlPoint(x, y, isSelected) {
    ctx.fillStyle = isSelected ? 'rgba(0, 123, 255, 0.5)' : 'rgba(220, 53, 69, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 5 : 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
}

function drawTemporaryPoints() {
    points.forEach(point => {
        const x = (point.x * scaleFactor) + imgX;
        const y = (point.y * scaleFactor) + imgY;
        
        ctx.fillStyle = 'rgba(40, 167, 69, 0.6)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
}

function drawMeasurementLabel(segment, startX, startY, endX, endY) {
    const realDistance = calculateDistance(segment.start, segment.end);
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Calcola la posizione dell'etichetta spostata dalla linea
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const offsetX = (-dy / length) * 20;
    const offsetY = (dx / length) * 20;
    
    const labelX = midX + offsetX;
    const labelY = midY + offsetY;
    
    // Sfondo dell'etichetta
    ctx.fillStyle = 'rgba(0, 123, 255, 0.7)';
    const text = `${realDistance} mm`;
    ctx.font = '11px Arial';
    const textWidth = ctx.measureText(text).width;
    
    ctx.fillRect(labelX - textWidth/2 - 4, labelY - 14, textWidth + 8, 16);
    
    // Testo
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(text, labelX, labelY - 2);
}

// === GESTIONE EVENTI TOUCH E CLICK ===
canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

function handleCanvasClick(event) {
    if (isMultiTouch || isPanning) return;
    
    event.preventDefault();
    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    
    showTouchFeedback(event.clientX, event.clientY);
    
    if (selectSegment(coords.x, coords.y)) {
        drawCanvas();
        updateSegmentsList();
        return;
    }
    
    addPoint(coords.x, coords.y);
}

function handleTouchStart(event) {
    event.preventDefault();
    const currentTime = Date.now();
    touches = Array.from(event.touches);
    
    if (touches.length === 1) {
        // Single touch
        const touch = touches[0];
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
        
        // Check for double tap
        if (currentTime - lastTouchTime < 300) {
            handleDoubleTap(touch.clientX, touch.clientY);
            return;
        }
        
        panStartX = touch.clientX;
        panStartY = touch.clientY;
        
        // Check if touching a segment
        if (selectSegment(coords.x, coords.y)) {
            drawCanvas();
            updateSegmentsList();
        }
        
    } else if (touches.length === 2) {
        // Multi-touch for zoom
        isMultiTouch = true;
        initialDistance = getDistance(touches[0], touches[1]);
        initialZoom = zoomFactor;
    }
    
    lastTouchTime = currentTime;
}

function handleTouchMove(event) {
    event.preventDefault();
    
    if (event.touches.length === 1 && !isMultiTouch) {
        // Single touch pan
        const touch = event.touches[0];
        const deltaX = touch.clientX - panStartX;
        const deltaY = touch.clientY - panStartY;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            isPanning = true;
            imgX += deltaX / zoomFactor;
            imgY += deltaY / zoomFactor;
            
            panStartX = touch.clientX;
            panStartY = touch.clientY;
            drawCanvas();
        }
    } else if (event.touches.length === 2) {
        // Pinch to zoom
        const distance = getDistance(event.touches[0], event.touches[1]);
        const scale = distance / initialDistance;
        zoomFactor = Math.max(0.5, Math.min(5, initialZoom * scale));
        drawCanvas();
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    
    if (event.touches.length === 0) {
        // All fingers lifted
        if (!isPanning && !isMultiTouch && touches.length === 1) {
            // Single tap without pan
            const touch = touches[0];
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
            
            showTouchFeedback(touch.clientX, touch.clientY);
            
            if (!selectSegment(coords.x, coords.y)) {
                addPoint(coords.x, coords.y);
            }
        }
        
        isPanning = false;
        isMultiTouch = false;
    }
    
    touches = Array.from(event.touches);
}

function handleDoubleTap(clientX, clientY) {
    // Double tap to reset zoom
    resetView();
    showToast('Zoom reimpostato', 'info');
}

function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - imgX * zoomFactor) / (scaleFactor * zoomFactor);
    const y = (clientY - rect.top - imgY * zoomFactor) / (scaleFactor * zoomFactor);
    return { x, y };
}

function getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function addPoint(x, y) {
    points.push({ x, y });
    
    if (points.length === 2) {
        createSegment();
    }
    
    drawCanvas();
}

function createSegment() {
    const segment = {
        id: segmentCounter++,
        name: `Segmento ${segmentCounter - 1}`,
        start: points[0],
        end: points[1]
    };
    
    segments.push(segment);
    selectedSegment = segment;
    points = [];
    
    updateMeasurement();
    updateSegmentsList();
    showToast('Nuovo segmento creato', 'success');
}

function getPixelDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateDistance(point1, point2) {
    const pixelDistance = getPixelDistance(point1, point2);
    
    const referencePx = parseFloat(document.getElementById('scale').value) || 1;
    const realMm = parseFloat(document.getElementById('real').value) || 1;
    
    // Formula corretta: pixelDistance * (realMm / referencePx)
    const realDistance = pixelDistance * (realMm / referencePx);
    return realDistance.toFixed(2);
}

function selectSegment(x, y) {
    let newSelectedSegment = null;
    let minDistance = Infinity;
    
    // Trova il segmento più vicino
    segments.forEach(segment => {
        const distance = distanceToSegment(x, y, segment);
        if (distance < 15 && distance < minDistance) { // Area di selezione più ampia per mobile
            minDistance = distance;
            newSelectedSegment = segment;
        }
    });
    
    if (newSelectedSegment !== selectedSegment) {
        selectedSegment = newSelectedSegment;
        points = []; // Reset punti temporanei
        
        // NUOVO: Quando si seleziona un segmento, imposta automaticamente il riferimento in pixel
        if (selectedSegment) {
            const pixelDistance = getPixelDistance(selectedSegment.start, selectedSegment.end);
            document.getElementById('scale').value = pixelDistance.toFixed(1);
            showToast(`Selezionato: ${selectedSegment.name} - Riferimento: ${pixelDistance.toFixed(1)}px`, 'info');
        }
        
        updateMeasurement();
        
        return true;
    }
    
    return selectedSegment !== null;
}

function distanceToSegment(x, y, segment) {
    const v1 = { x: segment.end.x - segment.start.x, y: segment.end.y - segment.start.y };
    const v2 = { x: x - segment.start.x, y: y - segment.start.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const lenSq = v1.x * v1.x + v1.y * v1.y;
    let t = dot / lenSq;

    t = Math.max(0, Math.min(1, t));

    const projection = {
        x: segment.start.x + t * v1.x,
        y: segment.start.y + t * v1.y
    };

    const distanceSq = Math.pow(x - projection.x, 2) + Math.pow(y - projection.y, 2);
    return Math.sqrt(distanceSq);
}

// === FUNZIONI UI E UTILITA' ===
function updateMeasurement() {
    if (selectedSegment) {
        const realDistance = calculateDistance(selectedSegment.start, selectedSegment.end);
        document.getElementById('realsel').value = realDistance;
    } else {
        document.getElementById('realsel').value = '';
    }
}

function updateSegmentsList() {
    const noSegments = segmentsList.querySelector('.no-segments');
    
    if (segments.length === 0) {
        segmentsList.innerHTML = '<div class="no-segments text-muted small text-center py-2">Nessun segmento creato</div>';
        return;
    }
    
    if (noSegments) {
        noSegments.remove();
    }
    
    segmentsList.innerHTML = '';
    
    segments.forEach((segment, index) => {
        const segmentItem = createSegmentListItem(segment, index);
        segmentsList.appendChild(segmentItem);
    });
}

function createSegmentListItem(segment, index) {
    const item = document.createElement('div');
    item.className = `segment-item ${segment === selectedSegment ? 'selected' : ''}`;
    
    const pixelDistance = getPixelDistance(segment.start, segment.end);
    const realDistance = calculateDistance(segment.start, segment.end);
    
    item.innerHTML = `
        <div class="segment-info">
            <div class="segment-name" contenteditable="true">${segment.name}</div>
            <div class="segment-measurement">${pixelDistance.toFixed(1)}px → ${realDistance}mm</div>
        </div>
        <div class="segment-actions">
            <button class="btn btn-outline-primary btn-segment select-btn" title="Seleziona">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-danger btn-segment delete-btn" title="Elimina">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Event listeners
    const nameElement = item.querySelector('.segment-name');
    const selectBtn = item.querySelector('.select-btn');
    const deleteBtn = item.querySelector('.delete-btn');
    
    nameElement.addEventListener('blur', () => {
        segment.name = nameElement.textContent.trim() || `Segmento ${index + 1}`;
        nameElement.textContent = segment.name;
    });
    
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedSegment = segment;
        updateMeasurement();
        updateSegmentsList();
        drawCanvas();
        showToast(`Selezionato: ${segment.name}`, 'info');
    });
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSegment(segment);
    });
    
    item.addEventListener('click', () => {
        selectedSegment = segment;
        updateMeasurement();
        updateSegmentsList();
        drawCanvas();
    });
    
    return item;
}

function deleteSegment(segment) {
    showConfirmModal(
        `Vuoi eliminare "${segment.name}"?`,
        () => {
            segments = segments.filter(s => s !== segment);
            if (selectedSegment === segment) {
                selectedSegment = null;
                updateMeasurement();
            }
            updateSegmentsList();
            drawCanvas();
            showToast('Segmento eliminato', 'warning');
        }
    );
}

function deleteAllSegments() {
    if (segments.length === 0) {
        showToast('Nessun segmento da eliminare', 'info');
        return;
    }
    
    showConfirmModal(
        'Vuoi eliminare tutti i segmenti?',
        () => {
            segments = [];
            selectedSegment = null;
            points = [];
            updateMeasurement();
            updateSegmentsList();
            drawCanvas();
            showToast('Tutti i segmenti eliminati', 'warning');
        }
    );
}

function showTouchFeedback(x, y) {
    const rect = canvas.getBoundingClientRect();
    const indicator = touchIndicator;
    
    indicator.style.left = (x - rect.left) + 'px';
    indicator.style.top = (y - rect.top) + 'px';
    indicator.classList.add('active');
    
    setTimeout(() => {
        indicator.classList.remove('active');
    }, 200);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastBody = document.getElementById('toast-body');
    const toastHeader = toast.querySelector('.toast-header i');
    
    // Set icon and color based on type
    toastHeader.className = `fas me-2 ${
        type === 'success' ? 'fa-check-circle text-success' :
        type === 'warning' ? 'fa-exclamation-triangle text-warning' :
        type === 'error' ? 'fa-times-circle text-danger' :
        'fa-info-circle text-primary'
    }`;
    
    toastBody.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast, {
        delay: 3000
    });
    bsToast.show();
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalBody = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('confirm-action');
    
    modalBody.textContent = message;
    
    // Remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        const bsModal = bootstrap.Modal.getInstance(modal);
        bsModal.hide();
    });
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function updateZoomLevel() {
    const percentage = Math.round(zoomFactor * 100);
    zoomLevel.textContent = `${percentage}%`;
}

function resetView() {
    imgX = 0;
    imgY = 0;
    zoomFactor = 1;
    drawCanvas();
}

// Funzioni per spostare l'immagine
function moveUp() {
    imgY -= 20 / zoomFactor;
    drawCanvas();
}

function moveDown() {
    imgY += 20 / zoomFactor;
    drawCanvas();
}

function moveLeft() {
    imgX -= 20 / zoomFactor;
    drawCanvas();
}

function moveRight() {
    imgX += 20 / zoomFactor;
    drawCanvas();
}

function zoomIn() {
    zoomFactor = Math.min(5, zoomFactor + 0.2);
    drawCanvas();
}

function zoomOut() {
    zoomFactor = Math.max(0.5, zoomFactor - 0.2);
    drawCanvas();
}

function togglePanel() {
    // Su desktop (1024px+), il pannello è sempre visibile
    if (window.innerWidth >= 1024) {
        return;
    }
    
    panelOpen = !panelOpen;
    controlPanel.classList.toggle('open', panelOpen);
    
    const toggleBtn = document.getElementById('toggle-panel');
    toggleBtn.innerHTML = panelOpen ? 
        '<i class="fas fa-times"></i>' : 
        '<i class="fas fa-cog"></i>';
}

// === EVENT LISTENERS ===
document.addEventListener("DOMContentLoaded", function() {
    // Upload
    document.getElementById('upload').addEventListener('change', loadImage);
    
    // Panel toggle
    document.getElementById('toggle-panel').addEventListener('click', togglePanel);
    
    // Scale inputs
    document.getElementById('scale').addEventListener('input', () => {
        updateMeasurement();
        drawCanvas();
    });
    
    document.getElementById('real').addEventListener('input', () => {
        updateMeasurement();
        updateSegmentsList();
        drawCanvas();
    });
    
    // Controls
    document.getElementById('deleteall').addEventListener('click', deleteAllSegments);
    document.getElementById('zoom-in').addEventListener('click', zoomIn);
    document.getElementById('zoom-out').addEventListener('click', zoomOut);
    document.getElementById('reset').addEventListener('click', resetView);
    document.getElementById('center').addEventListener('click', resetView);
    
    // Navigation
    document.getElementById('xplus').addEventListener('click', moveRight);
    document.getElementById('xminus').addEventListener('click', moveLeft);
    document.getElementById('yplus').addEventListener('click', moveDown);
    document.getElementById('yminus').addEventListener('click', moveUp);
    
    // Panel auto-open on mobile
    if (window.innerWidth < 768) {
        controlPanel.addEventListener('click', (e) => {
            if (e.target === controlPanel && !panelOpen) {
                togglePanel();
            }
        });
        
        // Swipe up gesture to open panel
        let startY;
        controlPanel.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });
        
        controlPanel.addEventListener('touchmove', (e) => {
            if (!panelOpen) {
                const currentY = e.touches[0].clientY;
                const diff = startY - currentY;
                
                if (diff > 50) {
                    togglePanel();
                }
            }
        });
    }
    
    // Initialize panel state based on screen size
    function initializePanelState() {
        if (window.innerWidth >= 1024) {
            // Desktop: pannello sempre aperto
            panelOpen = true;
            controlPanel.classList.add('open');
            const toggleBtn = document.getElementById('toggle-panel');
            toggleBtn.style.display = 'none'; // Nascondi il bottone su desktop
        } else if (window.innerWidth >= 768) {
            // Tablet: pannello chiuso di default ma toggle visibile
            panelOpen = false;
            controlPanel.classList.remove('open');
            const toggleBtn = document.getElementById('toggle-panel');
            toggleBtn.style.display = 'block';
        } else {
            // Mobile: pannello chiuso di default
            panelOpen = false;
            controlPanel.classList.remove('open');
            const toggleBtn = document.getElementById('toggle-panel');
            toggleBtn.style.display = 'block';
        }
    }
    
    // Resize canvas on window resize
    window.addEventListener('resize', () => {
        initializePanelState(); // Re-inizializza il pannello
        resizeCanvas();
        drawCanvas();
    });
    
    // Listener per cambio orientamento
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            initializePanelState(); // Re-inizializza il pannello
            resizeCanvas();
            drawCanvas();
        }, 100); // Piccolo delay per attendere il cambio viewport
    });
    
    // Initialize
    initializePanelState();
    resizeCanvas();
    updateSegmentsList();
    showToast('Applicazione pronta. Carica un\'immagine per iniziare.', 'info');
});

