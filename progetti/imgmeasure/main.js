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

// Debug logging
const DEBUG_MODE = true; // Imposta a false per nascondere il pulsante debug
let debugLog = [];
const MAX_DEBUG_ENTRIES = 100;

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

// Drawing mode
let drawingMode = 'segment'; // 'segment', 'rectangle', or 'continuous'
let previewPoint = null; // Per l'anteprima del rettangolo/segmento
let showPreview = true; // Flag per attivare/disattivare l'anteprima
let snapPreviewPoint = null; // Punto di snap visualizzato in anteprima

// Theme
let currentTheme = 'dark'; // 'light', 'dark', 'contrast'

// === COSTANTI CONFIGURAZIONE GRAFICA ===
const SEGMENT_LINE_WIDTH = 2;           // Spessore segmento normale
const SEGMENT_SELECTED_LINE_WIDTH = 3;  // Spessore segmento selezionato
const PREVIEW_LINE_WIDTH = 3;           // Spessore anteprima (segmento/rettangolo)
const CONTROL_POINT_RADIUS = 4;         // Raggio punto controllo normale
const CONTROL_POINT_SELECTED_RADIUS = 6; // Raggio punto controllo selezionato
const CONTROL_POINT_TEMP_RADIUS = 5;    // Raggio punti temporanei
const SNAP_DISTANCE = 20;               // Distanza massima per snap agli endpoint (in pixel immagine)
const SEGMENT_SELECT_DISTANCE = 15;     // Distanza massima per selezione segmento

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

    // Disegna anteprima se attiva e c'è un punto iniziale
    if (showPreview && points.length === 1 && previewPoint) {
        if (drawingMode === 'segment' || drawingMode === 'continuous') {
            drawSegmentPreview();
        } else if (drawingMode === 'rectangle') {
            drawRectanglePreview();
        }
    }

    // Disegna indicatore di snap se presente
    if (snapPreviewPoint) {
        drawSnapIndicator(snapPreviewPoint);
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

    // Usa colori CSS variabili dal tema
    const segmentColor = getComputedStyle(document.documentElement).getPropertyValue(
        segment === selectedSegment ? '--segment-selected-alpha' : '--segment-color-alpha'
    ).trim();

    // Linea principale
    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = segment === selectedSegment ? SEGMENT_SELECTED_LINE_WIDTH : SEGMENT_LINE_WIDTH;
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
    const pointColor = getComputedStyle(document.documentElement).getPropertyValue(
        isSelected ? '--segment-selected-alpha' : '--segment-color-alpha'
    ).trim();

    ctx.fillStyle = pointColor;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, isSelected ? CONTROL_POINT_SELECTED_RADIUS : CONTROL_POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
}

function drawTemporaryPoints() {
    const tempColor = getComputedStyle(document.documentElement).getPropertyValue('--temp-point-color').trim();

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

        ctx.fillStyle = tempColor;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(x, y, CONTROL_POINT_TEMP_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    });
}

function drawSegmentPreview() {
    if (!points[0] || !previewPoint) return;

    const previewColor = getComputedStyle(document.documentElement).getPropertyValue('--preview-color-alpha').trim();

    // Converti coordinate in coordinate canvas
    let x1, y1, x2, y2;
    if (img.width && img.height && scaleFactor !== 1) {
        x1 = (points[0].x * scaleFactor) + imgX;
        y1 = (points[0].y * scaleFactor) + imgY;
        x2 = (previewPoint.x * scaleFactor) + imgX;
        y2 = (previewPoint.y * scaleFactor) + imgY;
    } else {
        x1 = points[0].x + imgX;
        y1 = points[0].y + imgY;
        x2 = previewPoint.x + imgX;
        y2 = previewPoint.y + imgY;
    }

    // Disegna segmento semi-trasparente con linea tratteggiata
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = PREVIEW_LINE_WIDTH;
    ctx.setLineDash([8, 4]);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([]);
}

function drawRectanglePreview() {
    if (!points[0] || !previewPoint) return;

    const previewStroke = getComputedStyle(document.documentElement).getPropertyValue('--preview-color-alpha').trim();
    const previewFill = getComputedStyle(document.documentElement).getPropertyValue('--preview-fill-alpha').trim();

    // Calcola i vertici del rettangolo
    const minX = Math.min(points[0].x, previewPoint.x);
    const maxX = Math.max(points[0].x, previewPoint.x);
    const minY = Math.min(points[0].y, previewPoint.y);
    const maxY = Math.max(points[0].y, previewPoint.y);

    // Converti in coordinate canvas
    let x1, y1, x2, y2;
    if (img.width && img.height && scaleFactor !== 1) {
        x1 = (minX * scaleFactor) + imgX;
        y1 = (minY * scaleFactor) + imgY;
        x2 = (maxX * scaleFactor) + imgX;
        y2 = (maxY * scaleFactor) + imgY;
    } else {
        x1 = minX + imgX;
        y1 = minY + imgY;
        x2 = maxX + imgX;
        y2 = maxY + imgY;
    }

    // Disegna rettangolo semi-trasparente
    ctx.strokeStyle = previewStroke;
    ctx.fillStyle = previewFill;
    ctx.lineWidth = PREVIEW_LINE_WIDTH;
    ctx.setLineDash([8, 4]);

    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    ctx.setLineDash([]);
}

function drawSnapIndicator(point) {
    // Converti coordinate in coordinate canvas
    let x, y;
    if (img.width && img.height && scaleFactor !== 1) {
        x = (point.x * scaleFactor) + imgX;
        y = (point.y * scaleFactor) + imgY;
    } else {
        x = point.x + imgX;
        y = point.y + imgY;
    }

    // Disegna un cerchio pulsante per indicare lo snap
    const snapColor = getComputedStyle(document.documentElement).getPropertyValue('--segment-selected-alpha').trim();

    ctx.strokeStyle = snapColor;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;

    // Cerchio esterno
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Cerchio interno
    ctx.fillStyle = snapColor;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
}

function drawMeasurementLabel(segment, startX, startY, endX, endY) {
    const labelBg = getComputedStyle(document.documentElement).getPropertyValue('--label-bg').trim();
    const labelText = getComputedStyle(document.documentElement).getPropertyValue('--label-text').trim();

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
    ctx.fillStyle = labelBg;
    const text = `${realDistance} mm`;
    ctx.font = 'bold 12px Arial';
    const textWidth = ctx.measureText(text).width;

    ctx.fillRect(labelX - textWidth/2 - 6, labelY - 16, textWidth + 12, 20);

    // Testo
    ctx.fillStyle = labelText;
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
let lastTouchEndTime = 0; // Per bloccare eventi mouse dopo touch

// Funzione centralizzata per gestire tutti i click/tap
function handlePointCreation(clientX, clientY) {
    const currentTime = Date.now();

    addDebugLog('HANDLE_POINT', `points.length=${points.length}, lastClickTime=${currentTime - lastClickTime}ms ago`);

    // Prevenire eventi duplicati
    if (currentTime - lastClickTime < clickCooldown) {
        addDebugLog('POINT_BLOCKED', `duplicato (${currentTime - lastClickTime}ms < ${clickCooldown}ms)`);
        return false;
    }
    lastClickTime = currentTime;

    // Verifica condizioni di blocco
    if (isMultiTouch || isPanning || isMousePanning) {
        addDebugLog('POINT_BLOCKED', `gesture attiva: multiTouch=${isMultiTouch}, panning=${isPanning}, mousePan=${isMousePanning}`);
        return false;
    }

    const coords = getCanvasCoordinates(clientX, clientY);
    showTouchFeedback(clientX, clientY);

    // SOLUZIONE 4: Logica combinata

    // 1. Se c'è un disegno in corso (primo punto già piazzato), PRIORITÀ AL DISEGNO
    if (points.length > 0) {
        // Se c'è uno snapPreviewPoint attivo, usalo direttamente
        if (snapPreviewPoint) {
            addDebugLog('SNAP_FOUND', `chiusura con preview snap (${snapPreviewPoint.x.toFixed(1)}, ${snapPreviewPoint.y.toFixed(1)})`);
            addPoint(snapPreviewPoint.x, snapPreviewPoint.y);
            showToast('Punto agganciato all\'endpoint', 'success');
            snapPreviewPoint = null; // Reset
        } else {
            // Nessuno snap nel preview, prova a cercarlo
            const snapPoint = findNearestEndpoint(coords.x, coords.y);
            if (snapPoint) {
                // Snap trovato! Usa il punto esatto dell'endpoint
                addDebugLog('SNAP_FOUND', `chiusura segmento su endpoint (${snapPoint.x.toFixed(1)}, ${snapPoint.y.toFixed(1)})`);
                addPoint(snapPoint.x, snapPoint.y);
                showToast('Punto agganciato all\'endpoint', 'success');
            } else {
                // Nessuno snap, usa coordinate normali
                addDebugLog('POINT_ADDED', `normale (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)})`);
                addPoint(coords.x, coords.y);
            }
        }
        return true;
    }

    // 2. Nessun disegno in corso: prima prova lo snap per iniziare da un endpoint
    const snapPoint = findNearestEndpoint(coords.x, coords.y);
    if (snapPoint) {
        // Inizia un nuovo disegno da un endpoint esistente
        addDebugLog('SNAP_FOUND', `inizio segmento da endpoint (${snapPoint.x.toFixed(1)}, ${snapPoint.y.toFixed(1)})`);
        addPoint(snapPoint.x, snapPoint.y);
        showToast('Punto agganciato all\'endpoint', 'success');
        return true;
    }

    // 3. Nessuno snap: prova a selezionare un segmento esistente
    if (selectSegment(coords.x, coords.y)) {
        addDebugLog('SEGMENT_SELECTED', 'segmento selezionato');
        drawCanvas();
        updateSegmentsList();
        return true; // Evento gestito
    }

    // 4. Niente di tutto ciò: crea nuovo punto
    addDebugLog('POINT_ADDED', `nuovo (${coords.x.toFixed(1)}, ${coords.y.toFixed(1)})`);
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
    } else if (showPreview && points.length === 1) {
        // Aggiorna l'anteprima (segmento o rettangolo)
        const coords = getCanvasCoordinates(event.clientX, event.clientY);
        previewPoint = coords;

        // Cerca snap agli endpoint
        const snapPoint = findNearestEndpoint(coords.x, coords.y);
        snapPreviewPoint = snapPoint;

        drawCanvas();
    } else {
        // Anche senza disegno in corso, mostra snap indicator
        const coords = getCanvasCoordinates(event.clientX, event.clientY);
        const snapPoint = findNearestEndpoint(coords.x, coords.y);

        if (snapPoint !== snapPreviewPoint) {
            snapPreviewPoint = snapPoint;
            drawCanvas();
        }
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

    const currentTime = Date.now();
    const timeSinceTouchEnd = currentTime - lastTouchEndTime;

    addDebugLog('CLICK', `timeSinceTouchEnd=${timeSinceTouchEnd}ms, points.length=${points.length}`);

    // Su tablet con pennino, previeni eventi mouse duplicati dopo touch
    // Se è passato meno di 500ms dall'ultimo touchEnd, ignora il click
    if (timeSinceTouchEnd < 500) {
        addDebugLog('CLICK_IGNORED', `troppo vicino a touchEnd (${timeSinceTouchEnd}ms)`);
        return;
    }

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
        const touch = event.touches[0];
        const deltaX = touch.clientX - panStartX;
        const deltaY = touch.clientY - panStartY;

        // SOGLIA PIÙ ALTA: Se c'è un disegno in corso, richiedi movimento significativo per attivare pan
        const panThreshold = points.length > 0 ? 15 : 5;

        if (Math.abs(deltaX) > panThreshold || Math.abs(deltaY) > panThreshold) {
            // Single touch pan
            isPanning = true;
            panX += deltaX / zoomFactor;
            panY += deltaY / zoomFactor;

            imgX = centerX + panX;
            imgY = centerY + panY;

            panStartX = touch.clientX;
            panStartY = touch.clientY;
            drawCanvas();
        } else if (showPreview && points.length === 1 && !isPanning) {
            // Aggiorna l'anteprima (segmento o rettangolo) durante il movimento
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
            previewPoint = coords;

            // Cerca snap agli endpoint
            const snapPoint = findNearestEndpoint(coords.x, coords.y);
            snapPreviewPoint = snapPoint;

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

    addDebugLog('TOUCH_END', `touches.length=${event.touches.length}, isPanning=${isPanning}, isMultiTouch=${isMultiTouch}`);

    if (event.touches.length === 0) {
        // All fingers lifted
        if (!isPanning && !isMultiTouch && touches.length === 1) {
            // Single tap without pan
            const touch = touches[0];
            addDebugLog('TOUCH_TAP', `calling handlePointCreation, points.length=${points.length}`);
            handlePointCreation(touch.clientX, touch.clientY);
        } else {
            addDebugLog('TOUCH_END_NO_ACTION', `isPanning=${isPanning}, isMultiTouch=${isMultiTouch}, touches.length=${touches.length}`);
        }

        isPanning = false;
        isMultiTouch = false;

        // Aggiorna timestamp per bloccare eventi mouse successivi
        lastTouchEndTime = Date.now();
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
    // Al primo punto, deseleziona il segmento corrente per nascondere le misure
    if (points.length === 0) {
        selectedSegment = null;
        updateMeasurement();
    }

    points.push({ x, y });

    if (points.length === 2) {
        createSegment();
    }

    drawCanvas();
}

function cancelCurrentDrawing() {
    if (points.length > 0) {
        points = [];
        previewPoint = null;
        snapPreviewPoint = null;
        drawCanvas();
        showToast('Disegno annullato', 'info');
        return true;
    }
    return false;
}

function createSegment() {
    if (drawingMode === 'segment') {
        // Modalità segmento singolo
        const segment = {
            id: segmentCounter++,
            name: `Segmento ${segmentCounter - 1}`,
            start: points[0],
            end: points[1]
        };

        segments.push(segment);
        selectedSegment = segment;
        addDebugLog('SEGMENT_CREATED', `id=${segment.id}, start=(${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}), end=(${points[1].x.toFixed(1)},${points[1].y.toFixed(1)})`);
        points = [];
        previewPoint = null; // Reset preview per evitare bug

        updateMeasurement();
        updateSegmentsList();
        showToast('Nuovo segmento creato', 'success');
    } else if (drawingMode === 'continuous') {
        // Modalità segmento continuativo
        const segment = {
            id: segmentCounter++,
            name: `Cont ${segmentCounter - 1}`,
            start: points[0],
            end: points[1]
        };

        segments.push(segment);
        selectedSegment = segment;

        // In modalità continuativa, il punto finale diventa il punto iniziale del prossimo segmento
        points = [points[1]];
        // Non resettiamo previewPoint per mantenere l'anteprima

        updateMeasurement();
        updateSegmentsList();
        showToast('Segmento aggiunto alla catena', 'success');
    } else if (drawingMode === 'rectangle') {
        // Modalità rettangolo: crea 4 segmenti
        const minX = Math.min(points[0].x, points[1].x);
        const maxX = Math.max(points[0].x, points[1].x);
        const minY = Math.min(points[0].y, points[1].y);
        const maxY = Math.max(points[0].y, points[1].y);

        // I 4 vertici del rettangolo
        const topLeft = { x: minX, y: minY };
        const topRight = { x: maxX, y: minY };
        const bottomRight = { x: maxX, y: maxY };
        const bottomLeft = { x: minX, y: maxY };

        // Crea i 4 segmenti del rettangolo
        const rectSegments = [
            { start: topLeft, end: topRight, name: `Rett${segmentCounter} - Superiore` },
            { start: topRight, end: bottomRight, name: `Rett${segmentCounter} - Destro` },
            { start: bottomRight, end: bottomLeft, name: `Rett${segmentCounter} - Inferiore` },
            { start: bottomLeft, end: topLeft, name: `Rett${segmentCounter} - Sinistro` }
        ];

        rectSegments.forEach(seg => {
            const segment = {
                id: segmentCounter++,
                name: seg.name,
                start: seg.start,
                end: seg.end
            };
            segments.push(segment);
        });

        selectedSegment = segments[segments.length - 1]; // Seleziona l'ultimo segmento creato
        points = [];
        previewPoint = null; // Resetta l'anteprima

        updateMeasurement();
        updateSegmentsList();
        showToast('Nuovo rettangolo creato (4 segmenti)', 'success');
    }
}

function getPixelDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function findNearestEndpoint(x, y) {
    let nearestPoint = null;
    let minDistance = SNAP_DISTANCE;

    // Cerca tra tutti gli endpoint dei segmenti esistenti
    segments.forEach(segment => {
        // Controlla punto iniziale
        const distToStart = getPixelDistance({ x, y }, segment.start);
        if (distToStart < minDistance) {
            minDistance = distToStart;
            nearestPoint = { ...segment.start };
        }

        // Controlla punto finale
        const distToEnd = getPixelDistance({ x, y }, segment.end);
        if (distToEnd < minDistance) {
            minDistance = distToEnd;
            nearestPoint = { ...segment.end };
        }
    });

    if (DEBUG_MODE) {
        // Log tutte le chiamate con dettagli
        const inDrawing = points.length > 0 ? 'IN_DRAWING' : 'NO_DRAWING';
        addDebugLog('SNAP_CHECK', `${inDrawing} pos=(${x.toFixed(1)},${y.toFixed(1)}) minDist=${minDistance.toFixed(1)} threshold=${SNAP_DISTANCE} found=${nearestPoint ? 'YES' : 'NO'}`);
    }

    return nearestPoint;
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
        if (distance < SEGMENT_SELECT_DISTANCE && distance < minDistance) {
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

function addDebugLog(eventType, details) {
    if (!DEBUG_MODE) return; // Non loggare se debug è disabilitato

    try {
        // Timestamp semplice compatibile con tutti i browser
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');

        const logEntry = {
            time: timestamp,
            event: eventType,
            details: details
        };

        debugLog.push(logEntry);

        // Mantieni solo le ultime MAX_DEBUG_ENTRIES voci
        if (debugLog.length > MAX_DEBUG_ENTRIES) {
            debugLog.shift();
        }

        updateDebugDisplay();
    } catch (error) {
        // Fallback se c'è un errore
        console.error('Debug log error:', error);
        debugLog.push({
            time: Date.now(),
            event: eventType,
            details: details
        });
    }
}

function updateDebugDisplay() {
    const debugLogElement = document.getElementById('debug-log');
    if (!debugLogElement) return;

    if (debugLog.length === 0) {
        debugLogElement.innerHTML = '<div class="text-muted">Log eventi pronto...</div>';
        return;
    }

    const html = debugLog.map(entry => {
        const colorClass =
            entry.event.includes('CLICK') ? 'text-primary' :
            entry.event.includes('TOUCH') ? 'text-success' :
            entry.event.includes('SNAP') ? 'text-warning' :
            entry.event.includes('SEGMENT') ? 'text-info' :
            entry.event.includes('IGNORED') ? 'text-danger' :
            'text-secondary';

        return `<div class="${colorClass}">
            <strong>[${entry.time}]</strong> ${entry.event}: ${entry.details}
        </div>`;
    }).reverse().join('');

    debugLogElement.innerHTML = html;
    debugLogElement.scrollTop = 0;
}

function clearDebugLog() {
    debugLog = [];
    updateDebugDisplay();
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
        delay: 1000
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

// === FUNZIONI TEMA ===
function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Salva preferenza in localStorage
    localStorage.setItem('imgmeasure-theme', theme);

    // Ridisegna canvas con nuovi colori
    drawCanvas();

    // Feedback visivo
    const themeNames = {
        'light': 'Tema Chiaro',
        'dark': 'Tema Scuro',
        'contrast': 'Alto Contrasto'
    };
    showToast(`${themeNames[theme]} attivato`, 'info');
}

function loadThemeFromStorage() {
    const savedTheme = localStorage.getItem('imgmeasure-theme');
    if (savedTheme && ['light', 'dark', 'contrast'].includes(savedTheme)) {
        currentTheme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

// Funzione rimossa - ora usiamo Bootstrap Offcanvas

// === EVENT LISTENERS ===
document.addEventListener("DOMContentLoaded", function() {
    // Carica tema salvato
    loadThemeFromStorage();

    // Upload
    const uploadElement = document.getElementById('upload');
    if (uploadElement) {
        uploadElement.addEventListener('change', loadImage);
    }

    // Theme buttons
    const themeLightBtn = document.getElementById('theme-light');
    const themeDarkBtn = document.getElementById('theme-dark');
    const themeContrastBtn = document.getElementById('theme-contrast');

    if (themeLightBtn) {
        themeLightBtn.addEventListener('click', () => {
            setTheme('light');
            themeLightBtn.classList.add('active');
            themeDarkBtn.classList.remove('active');
            themeContrastBtn.classList.remove('active');
        });
    }

    if (themeDarkBtn) {
        themeDarkBtn.addEventListener('click', () => {
            setTheme('dark');
            themeDarkBtn.classList.add('active');
            themeLightBtn.classList.remove('active');
            themeContrastBtn.classList.remove('active');
        });
    }

    if (themeContrastBtn) {
        themeContrastBtn.addEventListener('click', () => {
            setTheme('contrast');
            themeContrastBtn.classList.add('active');
            themeLightBtn.classList.remove('active');
            themeDarkBtn.classList.remove('active');
        });
    }

    // Imposta il pulsante attivo in base al tema corrente
    if (currentTheme === 'light') themeLightBtn?.classList.add('active');
    else if (currentTheme === 'dark') themeDarkBtn?.classList.add('active');
    else if (currentTheme === 'contrast') themeContrastBtn?.classList.add('active');

    // Toggle preview button
    const togglePreviewBtn = document.getElementById('toggle-preview');

    if (togglePreviewBtn) {
        togglePreviewBtn.addEventListener('click', () => {
            showPreview = !showPreview;
            if (showPreview) {
                togglePreviewBtn.classList.add('active');
                showToast('Anteprima attivata', 'info');
            } else {
                togglePreviewBtn.classList.remove('active');
                previewPoint = null; // Resetta l'anteprima corrente
                showToast('Anteprima disattivata', 'info');
            }
            drawCanvas();
        });
    }

    // Drawing mode buttons
    const modeSegmentBtn = document.getElementById('mode-segment');
    const modeContinuousBtn = document.getElementById('mode-continuous');
    const modeRectangleBtn = document.getElementById('mode-rectangle');

    if (modeSegmentBtn) {
        modeSegmentBtn.addEventListener('click', () => {
            drawingMode = 'segment';
            modeSegmentBtn.classList.add('active');
            modeContinuousBtn?.classList.remove('active');
            modeRectangleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Segmento attivata', 'info');
        });
    }

    if (modeContinuousBtn) {
        modeContinuousBtn.addEventListener('click', () => {
            drawingMode = 'continuous';
            modeContinuousBtn.classList.add('active');
            modeSegmentBtn?.classList.remove('active');
            modeRectangleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Segmento Continuativo attivata', 'info');
        });
    }

    if (modeRectangleBtn) {
        modeRectangleBtn.addEventListener('click', () => {
            drawingMode = 'rectangle';
            modeRectangleBtn.classList.add('active');
            modeSegmentBtn?.classList.remove('active');
            modeContinuousBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Rettangolo attivata', 'info');
        });
    }

    // Cancel drawing button
    const cancelDrawingBtn = document.getElementById('cancel-drawing');
    if (cancelDrawingBtn) {
        cancelDrawingBtn.addEventListener('click', () => {
            cancelCurrentDrawing();
        });
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

    // Listener per tasto ESC - annulla disegno corrente
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            cancelCurrentDrawing();
        }
    });

    // Debug log clear button
    const clearDebugBtn = document.getElementById('clear-debug-log');
    if (clearDebugBtn) {
        clearDebugBtn.addEventListener('click', clearDebugLog);
    }

    // Mostra/nascondi pulsante debug in base a DEBUG_MODE
    const debugButton = document.querySelector('[data-bs-target="#debugModal"]');
    if (debugButton) {
        debugButton.style.display = DEBUG_MODE ? '' : 'none';
    }

    // Initialize
    resizeCanvas();
    updateSegmentsList();
    showToast('Applicazione pronta. Carica un\'immagine per iniziare.', 'info');
    if (DEBUG_MODE) {
        addDebugLog('APP_START', 'Applicazione inizializzata');
    }
});

