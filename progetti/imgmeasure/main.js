// === VARIABILI GLOBALI ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const crosshair = document.getElementById('crosshair');
const touchIndicator = document.getElementById('touch-indicator');
const segmentsList = document.getElementById('segments-list');
const zoomLevel = document.getElementById('zoom-level');
const currentMeasurement = document.getElementById('current-measurement');
const segmentsStatus = document.getElementById('segments-status');
const segmentsCount = document.getElementById('segments-count');

let img = new Image();
let points = [];
let segments = [];
let selectedSegment = null;
let isDragging = false;
let scaleFactor = 1;
let zoomFactor = 1;
let imgX = 0;
let imgY = 0;
let centerX = 0;
let centerY = 0;
let panX = 0;
let panY = 0;

// Touch gesture variables
let touches = [];
let initialDistance = 0;
let initialZoom = 1;
// let lastTouchTime = 0; // Rimossa: ora si usa lastClickTime centralizzato
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
        segments = [];
        points = [];
        selectedSegment = null;
        segmentCounter = 1;
        zoomFactor = 1; // Reset zoom when loading new image
        drawCanvas();
        updateSegmentsList();
        showToast('Immagine caricata con successo', 'success');
    };
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Il canvas occupa sempre tutto lo spazio disponibile nel container
    let canvasWidth, canvasHeight;
    
    if (window.innerWidth >= 768 && window.matchMedia("(orientation: landscape)").matches) {
        // Tablet landscape: massimizza lo spazio orizzontale
        canvasWidth = containerRect.width - 20;
        canvasHeight = containerRect.height - 20;
    } else if (window.innerWidth >= 768) {
        // Tablet portrait
        canvasWidth = containerRect.width - 30;
        canvasHeight = containerRect.height - 30;
    } else {
        // Mobile
        canvasWidth = Math.min(containerRect.width - 40, window.innerWidth - 40);
        canvasHeight = Math.min(containerRect.height - 40, window.innerHeight - 140);
    }
    
    // Imposta sempre le dimensioni del canvas al massimo disponibile
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Calcola il fattore di scala per centrare l'immagine nel canvas
    if (img.width && img.height) {
        const widthRatio = canvasWidth / img.width;
        const heightRatio = canvasHeight / img.height;
        scaleFactor = Math.min(widthRatio, heightRatio);
        
        // Calcola l'offset di centraggio
        centerX = (canvasWidth - img.width * scaleFactor) / 2;
        centerY = (canvasHeight - img.height * scaleFactor) / 2;
        
        // Reset pan when resizing
        panX = 0;
        panY = 0;
        
        // Posizione finale dell'immagine
        imgX = centerX + panX;
        imgY = centerY + panY;
    } else {
        scaleFactor = 1;
        centerX = 0;
        centerY = 0;
        panX = 0;
        panY = 0;
        imgX = 0;
        imgY = 0;
    }
}

function drawCanvas() {
    if (!img.complete) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoomFactor, zoomFactor);
    
    // Disegna l'immagine
    if (img.width && img.height) {
        ctx.drawImage(img, imgX, imgY, img.width * scaleFactor, img.height * scaleFactor);
    }
    
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
    let startX, startY, endX, endY;
    
    if (img.width && img.height && scaleFactor !== 1) {
        // Con immagine: applica scale factor e offset
        startX = (segment.start.x * scaleFactor) + imgX;
        startY = (segment.start.y * scaleFactor) + imgY;
        endX = (segment.end.x * scaleFactor) + imgX;
        endY = (segment.end.y * scaleFactor) + imgY;
    } else {
        // Senza immagine: applica solo offset
        startX = segment.start.x + imgX;
        startY = segment.start.y + imgY;
        endX = segment.end.x + imgX;
        endY = segment.end.y + imgY;
    }
    
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
        let x, y;
        
        if (img.width && img.height && scaleFactor !== 1) {
            // Con immagine: applica scale factor e offset
            x = (point.x * scaleFactor) + imgX;
            y = (point.y * scaleFactor) + imgY;
        } else {
            // Senza immagine: applica solo offset
            x = point.x + imgX;
            y = point.y + imgY;
        }
        
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

// Mouse events per desktop pan
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Variabili per mouse pan
let isMousePanning = false;
let mouseStartX = 0;
let mouseStartY = 0;

// Variabile per prevenire eventi duplicati
let lastClickTime = 0;
let clickCooldown = 100; // ms

// Funzione centralizzata per gestire tutti i click/tap
function handlePointCreation(clientX, clientY) {
    const currentTime = Date.now();
    
    // Prevenire eventi duplicati
    if (currentTime - lastClickTime < clickCooldown) {
        return false;
    }
    lastClickTime = currentTime;
    
    // Verifica condizioni di blocco
    if (isMultiTouch || isPanning || isMousePanning) {
        return false;
    }
    
    const coords = getCanvasCoordinates(clientX, clientY);
    showTouchFeedback(clientX, clientY);
    
    // Prova a selezionare un segmento esistente
    if (selectSegment(coords.x, coords.y)) {
        drawCanvas();
        updateSegmentsList();
        return true; // Evento gestito
    }
    
    // Crea/continua la creazione di un segmento
    addPoint(coords.x, coords.y);
    return true; // Evento gestito
}

function handleMouseDown(event) {
    if (event.button === 2) { // Right click per pan
        event.preventDefault();
        isMousePanning = true;
        mouseStartX = event.clientX;
        mouseStartY = event.clientY;
        canvas.style.cursor = 'move';
    }
}

function handleMouseMove(event) {
    if (isMousePanning) {
        event.preventDefault();
        const deltaX = event.clientX - mouseStartX;
        const deltaY = event.clientY - mouseStartY;
        
        panX += deltaX / zoomFactor;
        panY += deltaY / zoomFactor;
        
        imgX = centerX + panX;
        imgY = centerY + panY;
        
        mouseStartX = event.clientX;
        mouseStartY = event.clientY;
        drawCanvas();
    }
}

function handleMouseUp() {
    if (isMousePanning) {
        isMousePanning = false;
        canvas.style.cursor = 'crosshair';
    }
}

function handleCanvasClick(event) {
    event.preventDefault();
    handlePointCreation(event.clientX, event.clientY);
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
        if (currentTime - lastClickTime < 300) {
            handleDoubleTap();
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
    
    // lastTouchTime = currentTime; // Non necessario, gestito da handlePointCreation
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
            panX += deltaX / zoomFactor;
            panY += deltaY / zoomFactor;
            
            imgX = centerX + panX;
            imgY = centerY + panY;
            
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
            handlePointCreation(touch.clientX, touch.clientY);
        }
        
        isPanning = false;
        isMultiTouch = false;
    }
    
    touches = Array.from(event.touches);
}

function handleDoubleTap() {
    // Double tap to reset zoom
    resetView();
    showToast('Zoom reimpostato', 'info');
}

function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // 1. Coordinate relative al canvas con compensazione per CSS scaling
    const rawCanvasX = clientX - rect.left;
    const rawCanvasY = clientY - rect.top;
    
    // Applica il fattore di scala per convertire da coordinate CSS a coordinate canvas reali
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = rawCanvasX * scaleX;
    const canvasY = rawCanvasY * scaleY;
    
    // 2. Converti in coordinate del sistema logico
    // Il sistema logico è il sistema di coordinate prima di ctx.scale()
    // Quindi dividiamo per zoomFactor per "annullare" il scale che verrà applicato
    const logicalX = canvasX / zoomFactor;
    const logicalY = canvasY / zoomFactor;
    
    // 3. Rimuovi l'offset dell'immagine per ottenere coordinate relative all'immagine
    const relativeX = logicalX - imgX;
    const relativeY = logicalY - imgY;
    
    // 4. Se c'è un'immagine, converti in coordinate dell'immagine originale
    // Altrimenti usa direttamente le coordinate relative
    let x, y;
    if (img.width && img.height && scaleFactor !== 1) {
        x = relativeX / scaleFactor;
        y = relativeY / scaleFactor;
    } else {
        // Senza immagine o scaleFactor=1, usa coordinate relative direttamente
        x = relativeX;
        y = relativeY;
    }
    
    
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
    
    // Se è stato trovato un segmento e non è quello già selezionato
    if (newSelectedSegment && newSelectedSegment !== selectedSegment) {
        selectedSegment = newSelectedSegment;
        points = []; // Reset punti temporanei
        
        // NUOVO: Quando si seleziona un segmento, imposta automaticamente il riferimento in pixel
        const pixelDistance = getPixelDistance(selectedSegment.start, selectedSegment.end);
        const scaleElement = document.getElementById('scale');
        if (scaleElement) {
            scaleElement.value = pixelDistance.toFixed(1);
        }
        showToast(`Selezionato: ${selectedSegment.name} - Riferimento: ${pixelDistance.toFixed(1)}px`, 'info');
        
        updateMeasurement();
        
        return true; // Evento gestito: segmento selezionato
    }
    
    // Restituisce true solo se è stato effettivamente selezionato un segmento
    return newSelectedSegment !== null;
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
        const realSelElement = document.getElementById('realsel');
        if (realSelElement) {
            realSelElement.value = realDistance;
        }
        
        // Aggiorna status bar
        if (currentMeasurement) {
            currentMeasurement.textContent = `${selectedSegment.name}: ${realDistance} mm`;
        }
    } else {
        const realSelElement = document.getElementById('realsel');
        if (realSelElement) {
            realSelElement.value = '';
        }
        if (currentMeasurement) {
            currentMeasurement.textContent = 'Nessuna selezione';
        }
    }
}

function updateSegmentsList() {
    // Aggiorna status bar
    if (segmentsStatus) {
        segmentsStatus.textContent = `${segments.length} misure`;
    }
    if (segmentsCount) {
        segmentsCount.textContent = segments.length;
    }
    
    if (!segmentsList) return;
    
    if (segments.length === 0) {
        segmentsList.innerHTML = '<div class="list-group-item text-muted text-center">Nessun segmento creato</div>';
        return;
    }
    
    segmentsList.innerHTML = '';
    
    segments.forEach((segment, index) => {
        const segmentItem = createSegmentListItem(segment, index);
        segmentsList.appendChild(segmentItem);
    });
}

function createSegmentListItem(segment, index) {
    const item = document.createElement('div');
    item.className = `list-group-item d-flex justify-content-between align-items-center ${segment === selectedSegment ? 'active' : ''}`;
    
    const pixelDistance = getPixelDistance(segment.start, segment.end);
    const realDistance = calculateDistance(segment.start, segment.end);
    
    item.innerHTML = `
        <div class="flex-grow-1">
            <div class="fw-bold segment-name" contenteditable="true" style="font-size: 0.9rem;">${segment.name}</div>
            <div class="text-muted" style="font-size: 0.8rem;">${pixelDistance.toFixed(1)}px → ${realDistance}mm</div>
        </div>
        <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary select-btn" title="Seleziona">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-danger delete-btn" title="Elimina">
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
        updateMeasurement(); // Aggiorna la status bar
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
    const toast = document.getElementById('info-toast');
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
    if (zoomLevel) {
        zoomLevel.textContent = `Zoom: ${percentage}%`;
    }
}

function resetView() {
    zoomFactor = 1;
    
    // Reset pan (ricentra l'immagine)
    panX = 0;
    panY = 0;
    imgX = centerX + panX;
    imgY = centerY + panY;
    
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

// Funzione rimossa - ora usiamo Bootstrap Offcanvas

// === EVENT LISTENERS ===
document.addEventListener("DOMContentLoaded", function() {
    // Upload
    const uploadElement = document.getElementById('upload');
    if (uploadElement) {
        uploadElement.addEventListener('change', loadImage);
    }
    
    // Scale inputs
    const scaleElement = document.getElementById('scale');
    const realElement = document.getElementById('real');
    
    if (scaleElement) {
        scaleElement.addEventListener('input', () => {
            updateMeasurement();
            drawCanvas();
        });
    }
    
    if (realElement) {
        realElement.addEventListener('input', () => {
            updateMeasurement();
            updateSegmentsList();
            drawCanvas();
        });
    }
    
    // Controls
    const deleteAllElement = document.getElementById('deleteall');
    const zoomInElement = document.getElementById('zoom-in');
    const zoomOutElement = document.getElementById('zoom-out');
    const resetElement = document.getElementById('reset');
    const centerElement = document.getElementById('center');
    
    if (deleteAllElement) deleteAllElement.addEventListener('click', deleteAllSegments);
    if (zoomInElement) zoomInElement.addEventListener('click', zoomIn);
    if (zoomOutElement) zoomOutElement.addEventListener('click', zoomOut);
    if (resetElement) resetElement.addEventListener('click', resetView);
    if (centerElement) centerElement.addEventListener('click', resetView);
    
    
    // Resize canvas on window resize
    window.addEventListener('resize', () => {
        resizeCanvas();
        drawCanvas();
    });
    
    // Listener per cambio orientamento
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            resizeCanvas();
            drawCanvas();
        }, 100); // Piccolo delay per attendere il cambio viewport
    });
    
    // Initialize
    resizeCanvas();
    updateSegmentsList();
    showToast('Applicazione pronta. Carica un\'immagine per iniziare.', 'info');
});

