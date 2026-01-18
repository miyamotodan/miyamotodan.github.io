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
const MAX_DEBUG_ENTRIES = 1000; // Aumentato per vedere più storia

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
let drawingMode = 'segment'; // 'select', 'segment', 'rectangle', 'continuous', or 'circle'
let previewPoint = null; // Per l'anteprima del rettangolo/segmento/cerchio
let showPreview = true; // Flag per attivare/disattivare l'anteprima
let snapPreviewPoint = null; // Punto di snap visualizzato in anteprima
let showSegments = true; // Flag per mostrare/nascondere i segmenti

// Theme
let currentTheme = 'dark'; // 'light', 'dark', 'contrast'

// Feedback system
let feedbackShown = false; // Flag per tracciare se il modal è già stato mostrato in questa sessione
const FEEDBACK_TRIGGER_COUNT = 3; // Numero di segmenti dopo cui mostrare il modal

// === COSTANTI CONFIGURAZIONE GRAFICA ===
// NOTA: Queste dimensioni sono FISSE e indipendenti dallo zoom
// Vengono divise per zoomFactor durante il rendering per compensare ctx.scale()
const SEGMENT_LINE_WIDTH = 2;           // Spessore segmento normale (fisso sullo schermo)
const SEGMENT_SELECTED_LINE_WIDTH = 3;  // Spessore segmento selezionato (fisso sullo schermo)
const PREVIEW_LINE_WIDTH = 3;           // Spessore anteprima (fisso sullo schermo)
const CONTROL_POINT_RADIUS = 4;         // Raggio punto controllo normale (fisso sullo schermo)
const CONTROL_POINT_SELECTED_RADIUS = 6; // Raggio punto controllo selezionato (fisso sullo schermo)
const CONTROL_POINT_TEMP_RADIUS = 5;    // Raggio punti temporanei (fisso sullo schermo)
const LABEL_FONT_SIZE = 12;             // Dimensione font etichette (fisso sullo schermo)
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

    // Disegna tutti i segmenti solo se showSegments è true
    if (showSegments) {
        segments.forEach(segment => {
            if (segment.type === 'circle') {
                drawCircle(segment);
            } else {
                drawSegment(segment);
            }
        });

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
            } else if (drawingMode === 'circle') {
                drawCirclePreview();
            }
        }

        // Disegna indicatore di snap se presente
        if (snapPreviewPoint) {
            drawSnapIndicator(snapPreviewPoint);
        }
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

    // Linea principale - DIMENSIONE FISSA compensata per zoom
    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = (segment === selectedSegment ? SEGMENT_SELECTED_LINE_WIDTH : SEGMENT_LINE_WIDTH) / zoomFactor;
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
    ctx.lineWidth = 2 / zoomFactor; // Spessore fisso

    ctx.beginPath();
    // Raggio fisso compensato per zoom
    const radius = (isSelected ? CONTROL_POINT_SELECTED_RADIUS : CONTROL_POINT_RADIUS) / zoomFactor;
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
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
        ctx.lineWidth = 2 / zoomFactor; // Spessore fisso

        ctx.beginPath();
        const radius = CONTROL_POINT_TEMP_RADIUS / zoomFactor; // Raggio fisso
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
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

    // Disegna segmento semi-trasparente con linea tratteggiata - DIMENSIONE FISSA
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = PREVIEW_LINE_WIDTH / zoomFactor; // Spessore fisso
    ctx.setLineDash([8 / zoomFactor, 4 / zoomFactor]); // Pattern tratteggio fisso

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([]);

    // Disegna la label con la misura dell'anteprima
    drawPreviewMeasurementLabel(points[0], previewPoint, x1, y1, x2, y2);
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

    // I 4 vertici del rettangolo in coordinate immagine
    const topLeft = { x: minX, y: minY };
    const topRight = { x: maxX, y: minY };
    const bottomRight = { x: maxX, y: maxY };
    const bottomLeft = { x: minX, y: maxY };

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

    // Disegna rettangolo semi-trasparente - DIMENSIONE FISSA
    ctx.strokeStyle = previewStroke;
    ctx.fillStyle = previewFill;
    ctx.lineWidth = PREVIEW_LINE_WIDTH / zoomFactor; // Spessore fisso
    ctx.setLineDash([8 / zoomFactor, 4 / zoomFactor]); // Pattern tratteggio fisso

    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    ctx.setLineDash([]);

    // Disegna le label con le misure dei 4 lati
    // Calcola coordinate canvas per tutti i vertici
    let canvasTopLeft, canvasTopRight, canvasBottomRight, canvasBottomLeft;
    if (img.width && img.height && scaleFactor !== 1) {
        canvasTopLeft = { x: (topLeft.x * scaleFactor) + imgX, y: (topLeft.y * scaleFactor) + imgY };
        canvasTopRight = { x: (topRight.x * scaleFactor) + imgX, y: (topRight.y * scaleFactor) + imgY };
        canvasBottomRight = { x: (bottomRight.x * scaleFactor) + imgX, y: (bottomRight.y * scaleFactor) + imgY };
        canvasBottomLeft = { x: (bottomLeft.x * scaleFactor) + imgX, y: (bottomLeft.y * scaleFactor) + imgY };
    } else {
        canvasTopLeft = { x: topLeft.x + imgX, y: topLeft.y + imgY };
        canvasTopRight = { x: topRight.x + imgX, y: topRight.y + imgY };
        canvasBottomRight = { x: bottomRight.x + imgX, y: bottomRight.y + imgY };
        canvasBottomLeft = { x: bottomLeft.x + imgX, y: bottomLeft.y + imgY };
    }

    // Lato superiore
    drawPreviewMeasurementLabel(topLeft, topRight, canvasTopLeft.x, canvasTopLeft.y, canvasTopRight.x, canvasTopRight.y);
    // Lato destro
    drawPreviewMeasurementLabel(topRight, bottomRight, canvasTopRight.x, canvasTopRight.y, canvasBottomRight.x, canvasBottomRight.y);
    // Lato inferiore
    drawPreviewMeasurementLabel(bottomRight, bottomLeft, canvasBottomRight.x, canvasBottomRight.y, canvasBottomLeft.x, canvasBottomLeft.y);
    // Lato sinistro
    drawPreviewMeasurementLabel(bottomLeft, topLeft, canvasBottomLeft.x, canvasBottomLeft.y, canvasTopLeft.x, canvasTopLeft.y);
}

function drawCircle(circle) {
    const radius = getPixelDistance(circle.center, circle.radiusPoint);

    // Converti coordinate del centro
    let centerX, centerY, radiusPointX, radiusPointY;
    if (img.width && img.height && scaleFactor !== 1) {
        centerX = (circle.center.x * scaleFactor) + imgX;
        centerY = (circle.center.y * scaleFactor) + imgY;
        radiusPointX = (circle.radiusPoint.x * scaleFactor) + imgX;
        radiusPointY = (circle.radiusPoint.y * scaleFactor) + imgY;
    } else {
        centerX = circle.center.x + imgX;
        centerY = circle.center.y + imgY;
        radiusPointX = circle.radiusPoint.x + imgX;
        radiusPointY = circle.radiusPoint.y + imgY;
    }

    const scaledRadius = radius * scaleFactor;

    // Usa colori CSS variabili dal tema
    const segmentColor = getComputedStyle(document.documentElement).getPropertyValue(
        circle === selectedSegment ? '--segment-selected-alpha' : '--segment-color-alpha'
    ).trim();

    // Disegna il cerchio - DIMENSIONE FISSA compensata per zoom
    ctx.strokeStyle = segmentColor;
    ctx.lineWidth = (circle === selectedSegment ? SEGMENT_SELECTED_LINE_WIDTH : SEGMENT_LINE_WIDTH) / zoomFactor;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Disegna linea del raggio (dal centro al punto sul bordo)
    if (circle === selectedSegment) {
        ctx.strokeStyle = segmentColor;
        ctx.lineWidth = SEGMENT_LINE_WIDTH / zoomFactor;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(radiusPointX, radiusPointY);
        ctx.stroke();
    }

    // Punti di controllo
    drawControlPoint(centerX, centerY, circle === selectedSegment);
    drawControlPoint(radiusPointX, radiusPointY, circle === selectedSegment);

    // Etichetta con le misure
    if (circle === selectedSegment) {
        drawCircleMeasurementLabel(circle, centerX, centerY, radiusPointX, radiusPointY);
    }
}

function drawCirclePreview() {
    if (!points[0] || !previewPoint) return;

    const radius = getPixelDistance(points[0], previewPoint);
    const previewColor = getComputedStyle(document.documentElement).getPropertyValue('--preview-color-alpha').trim();

    // Converti coordinate del centro
    let centerX, centerY, radiusPointX, radiusPointY;
    if (img.width && img.height && scaleFactor !== 1) {
        centerX = (points[0].x * scaleFactor) + imgX;
        centerY = (points[0].y * scaleFactor) + imgY;
        radiusPointX = (previewPoint.x * scaleFactor) + imgX;
        radiusPointY = (previewPoint.y * scaleFactor) + imgY;
    } else {
        centerX = points[0].x + imgX;
        centerY = points[0].y + imgY;
        radiusPointX = previewPoint.x + imgX;
        radiusPointY = previewPoint.y + imgY;
    }

    const scaledRadius = radius * scaleFactor;

    // Disegna cerchio semi-trasparente con linea tratteggiata - DIMENSIONE FISSA
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = PREVIEW_LINE_WIDTH / zoomFactor;
    ctx.setLineDash([8 / zoomFactor, 4 / zoomFactor]);

    ctx.beginPath();
    ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Disegna linea del raggio (dal centro al punto sul bordo)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(radiusPointX, radiusPointY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Disegna la label con le misure (raggio e diametro)
    drawCirclePreviewMeasurementLabel(points[0], previewPoint, centerX, centerY, radiusPointX, radiusPointY);
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

    // Disegna un cerchio pulsante per indicare lo snap - DIMENSIONE FISSA
    const snapColor = getComputedStyle(document.documentElement).getPropertyValue('--segment-selected-alpha').trim();

    ctx.strokeStyle = snapColor;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3 / zoomFactor; // Spessore fisso

    // Cerchio esterno - dimensione fissa
    ctx.beginPath();
    ctx.arc(x, y, 10 / zoomFactor, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Cerchio interno - dimensione fissa
    ctx.fillStyle = snapColor;
    ctx.beginPath();
    ctx.arc(x, y, 4 / zoomFactor, 0, 2 * Math.PI);
    ctx.fill();
}

function drawMeasurementLabel(segment, startX, startY, endX, endY) {
    const labelBg = getComputedStyle(document.documentElement).getPropertyValue('--label-bg').trim();
    const labelText = getComputedStyle(document.documentElement).getPropertyValue('--label-text').trim();

    const realDistance = calculateDistance(segment.start, segment.end);

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Calcola la posizione dell'etichetta spostata dalla linea - offset fisso
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const fixedOffset = 20 / zoomFactor; // Offset fisso
    const offsetX = (-dy / length) * fixedOffset;
    const offsetY = (dx / length) * fixedOffset;

    const labelX = midX + offsetX;
    const labelY = midY + offsetY;

    // Font size fisso compensato per zoom
    const fontSize = LABEL_FONT_SIZE / zoomFactor;
    ctx.font = `bold ${fontSize}px Arial`;

    // Sfondo dell'etichetta
    ctx.fillStyle = labelBg;
    const text = `${realDistance} mm`;
    const textWidth = ctx.measureText(text).width;
    const padding = 6 / zoomFactor;
    const boxHeight = 20 / zoomFactor;

    ctx.fillRect(labelX - textWidth/2 - padding, labelY - boxHeight * 0.8, textWidth + padding * 2, boxHeight);

    // Testo
    ctx.fillStyle = labelText;
    ctx.textAlign = 'center';
    ctx.fillText(text, labelX, labelY - 2 / zoomFactor);
}

function drawPreviewMeasurementLabel(point1, point2, startX, startY, endX, endY) {
    const labelBg = getComputedStyle(document.documentElement).getPropertyValue('--preview-color-alpha').trim();
    const labelText = getComputedStyle(document.documentElement).getPropertyValue('--label-text').trim();

    // Calcola la distanza in tempo reale
    const realDistance = calculateDistance(point1, point2);

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Calcola la posizione dell'etichetta spostata dalla linea - offset fisso
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Evita divisione per zero se i punti sono troppo vicini
    if (length < 1) return;

    const fixedOffset = 20 / zoomFactor; // Offset fisso
    const offsetX = (-dy / length) * fixedOffset;
    const offsetY = (dx / length) * fixedOffset;

    const labelX = midX + offsetX;
    const labelY = midY + offsetY;

    // Font size fisso compensato per zoom
    const fontSize = LABEL_FONT_SIZE / zoomFactor;
    ctx.font = `bold ${fontSize}px Arial`;

    // Sfondo dell'etichetta con opacità maggiore per l'anteprima
    ctx.fillStyle = labelBg;
    const text = `${realDistance} mm`;
    const textWidth = ctx.measureText(text).width;
    const padding = 6 / zoomFactor;
    const boxHeight = 20 / zoomFactor;

    ctx.fillRect(labelX - textWidth/2 - padding, labelY - boxHeight * 0.8, textWidth + padding * 2, boxHeight);

    // Testo
    ctx.fillStyle = labelText;
    ctx.textAlign = 'center';
    ctx.fillText(text, labelX, labelY - 2 / zoomFactor);
}

function drawCircleMeasurementLabel(circle, centerX, centerY, radiusPointX, radiusPointY) {
    const labelBg = getComputedStyle(document.documentElement).getPropertyValue('--label-bg').trim();
    const labelText = getComputedStyle(document.documentElement).getPropertyValue('--label-text').trim();

    // Calcola raggio e diametro
    const radiusReal = calculateDistance(circle.center, circle.radiusPoint);
    const diameterReal = (parseFloat(radiusReal) * 2).toFixed(2);

    // Posiziona la label lungo la linea del raggio, a metà strada
    const midX = (centerX + radiusPointX) / 2;
    const midY = (centerY + radiusPointY) / 2;

    // Calcola offset perpendicolare per non sovrapporre la linea
    const dx = radiusPointX - centerX;
    const dy = radiusPointY - centerY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 1) return;

    const fixedOffset = 15 / zoomFactor;
    const offsetX = (-dy / length) * fixedOffset;
    const offsetY = (dx / length) * fixedOffset;

    const labelX = midX + offsetX;
    const labelY = midY + offsetY;

    // Font size fisso compensato per zoom
    const fontSize = LABEL_FONT_SIZE / zoomFactor;
    ctx.font = `bold ${fontSize}px Arial`;

    // Testo con raggio e diametro
    const text = `r: ${radiusReal}mm | ø: ${diameterReal}mm`;
    const textWidth = ctx.measureText(text).width;
    const padding = 6 / zoomFactor;
    const boxHeight = 20 / zoomFactor;

    // Sfondo dell'etichetta
    ctx.fillStyle = labelBg;
    ctx.fillRect(labelX - textWidth/2 - padding, labelY - boxHeight * 0.8, textWidth + padding * 2, boxHeight);

    // Testo
    ctx.fillStyle = labelText;
    ctx.textAlign = 'center';
    ctx.fillText(text, labelX, labelY - 2 / zoomFactor);
}

function drawCirclePreviewMeasurementLabel(center, radiusPoint, centerX, centerY, radiusPointX, radiusPointY) {
    const labelBg = getComputedStyle(document.documentElement).getPropertyValue('--preview-color-alpha').trim();
    const labelText = getComputedStyle(document.documentElement).getPropertyValue('--label-text').trim();

    // Calcola raggio e diametro in tempo reale
    const radiusReal = calculateDistance(center, radiusPoint);
    const diameterReal = (parseFloat(radiusReal) * 2).toFixed(2);

    // Posiziona la label lungo la linea del raggio, a metà strada
    const midX = (centerX + radiusPointX) / 2;
    const midY = (centerY + radiusPointY) / 2;

    // Calcola offset perpendicolare per non sovrapporre la linea
    const dx = radiusPointX - centerX;
    const dy = radiusPointY - centerY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 1) return;

    const fixedOffset = 15 / zoomFactor;
    const offsetX = (-dy / length) * fixedOffset;
    const offsetY = (dx / length) * fixedOffset;

    const labelX = midX + offsetX;
    const labelY = midY + offsetY;

    // Font size fisso compensato per zoom
    const fontSize = LABEL_FONT_SIZE / zoomFactor;
    ctx.font = `bold ${fontSize}px Arial`;

    // Testo con raggio e diametro
    const text = `r: ${radiusReal}mm | ø: ${diameterReal}mm`;
    const textWidth = ctx.measureText(text).width;
    const padding = 6 / zoomFactor;
    const boxHeight = 20 / zoomFactor;

    // Sfondo dell'etichetta
    ctx.fillStyle = labelBg;
    ctx.fillRect(labelX - textWidth/2 - padding, labelY - boxHeight * 0.8, textWidth + padding * 2, boxHeight);

    // Testo
    ctx.fillStyle = labelText;
    ctx.textAlign = 'center';
    ctx.fillText(text, labelX, labelY - 2 / zoomFactor);
}

// === GESTIONE EVENTI TOUCH E CLICK ===
canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

// Pointer events per supporto pennino/stylus
canvas.addEventListener('pointermove', handlePointerMove, { passive: false });

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

// Variabili per drag & drop punti
let isDraggingPoint = false;
let draggedSegment = null;
let draggedPointType = null; // 'start' o 'end'

// Variabile per prevenire eventi duplicati
let lastClickTime = 0;
let clickCooldown = 100; // ms
let lastTouchEndTime = 0; // Per bloccare eventi mouse dopo touch

// Funzione centralizzata per gestire tutti i click/tap
function handlePointCreation(clientX, clientY) {
    const currentTime = Date.now();

    addDebugLog('HANDLE_POINT', `mode=${drawingMode}, points.length=${points.length}, lastClickTime=${currentTime - lastClickTime}ms ago`);

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

    // MODALITÀ SELECT: solo selezione, nessun disegno
    if (drawingMode === 'select') {
        addDebugLog('SELECT_MODE', 'tentativo selezione segmento');
        if (selectSegment(coords.x, coords.y)) {
            addDebugLog('SEGMENT_SELECTED', 'segmento selezionato');
            drawCanvas();
            updateSegmentsList();
        } else {
            // Click su vuoto: deseleziona
            selectedSegment = null;
            updateMeasurement();
            drawCanvas();
            updateSegmentsList();
            addDebugLog('DESELECT', 'segmento deselezionato');
        }
        return true;
    }

    // MODALITÀ DISEGNO: logica combinata come prima

    // 1. Se c'è un disegno in corso (primo punto già piazzato), PRIORITÀ AL DISEGNO
    if (points.length > 0) {
        addDebugLog('CLOSING_SEGMENT', `points[0]=(${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}) clickPos=(${coords.x.toFixed(1)},${coords.y.toFixed(1)})`);

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

    // 3. Nessuno snap in modalità disegno: crea nuovo punto (NON selezionare)
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
    } else if (event.button === 0 && drawingMode === 'select') { // Left click in select mode
        event.preventDefault();
        const coords = getCanvasCoordinates(event.clientX, event.clientY);
        const nearestPoint = findNearestPoint(coords.x, coords.y);

        if (nearestPoint) {
            isDraggingPoint = true;
            draggedSegment = nearestPoint.segment;
            draggedPointType = nearestPoint.pointType;
            selectedSegment = draggedSegment;
            canvas.style.cursor = 'grabbing';
            updateMeasurement();
            updateSegmentsList();
            drawCanvas();
        }
    }
}

function handlePointerMove(event) {
    // Gestisce pennino e touch stylus
    if (event.pointerType === 'pen' || event.pointerType === 'touch') {
        if (showPreview && points.length === 1 && !isPanning && !isMousePanning) {
            event.preventDefault();
            const coords = getCanvasCoordinates(event.clientX, event.clientY);
            previewPoint = coords;

            // Cerca snap agli endpoint
            const snapPoint = findNearestEndpoint(coords.x, coords.y);
            snapPreviewPoint = snapPoint;

            drawCanvas();
        }
    }
}

function handleMouseMove(event) {
    if (isDraggingPoint) {
        // Drag del punto in modalità selezione
        event.preventDefault();
        const coords = getCanvasCoordinates(event.clientX, event.clientY);

        if (draggedSegment && draggedPointType) {
            // Aggiorna la posizione del punto trascinato
            if (draggedSegment.type === 'circle') {
                // Per i cerchi
                if (draggedPointType === 'center') {
                    // Sposta l'intero cerchio mantenendo il raggio costante
                    const deltaX = coords.x - draggedSegment.center.x;
                    const deltaY = coords.y - draggedSegment.center.y;

                    draggedSegment.center.x = coords.x;
                    draggedSegment.center.y = coords.y;
                    draggedSegment.radiusPoint.x += deltaX;
                    draggedSegment.radiusPoint.y += deltaY;
                } else if (draggedPointType === 'radiusPoint') {
                    // Modifica solo il raggio
                    draggedSegment.radiusPoint.x = coords.x;
                    draggedSegment.radiusPoint.y = coords.y;
                }
            } else {
                // Per i segmenti
                if (draggedPointType === 'start') {
                    draggedSegment.start.x = coords.x;
                    draggedSegment.start.y = coords.y;
                } else {
                    draggedSegment.end.x = coords.x;
                    draggedSegment.end.y = coords.y;
                }
            }

            updateMeasurement();
            updateSegmentsList();
            drawCanvas();
        }
    } else if (isMousePanning) {
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
    } else if (drawingMode === 'select') {
        // In modalità selezione, mostra cursore appropriato quando si passa su un punto
        const coords = getCanvasCoordinates(event.clientX, event.clientY);
        const nearestPoint = findNearestPoint(coords.x, coords.y);

        if (nearestPoint) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'crosshair';
        }
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
    if (isDraggingPoint) {
        isDraggingPoint = false;
        draggedSegment = null;
        draggedPointType = null;
        canvas.style.cursor = 'crosshair';
        showToast('Punto spostato', 'success');
    }
    if (isMousePanning) {
        isMousePanning = false;
        canvas.style.cursor = 'crosshair';
    }
}

function handleCanvasClick(event) {
    event.preventDefault();

    // Non gestire il click se abbiamo appena finito un drag
    if (isDraggingPoint) {
        return;
    }

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

        // Check for double tap (disabilitato in modalità selezione per evitare reset zoom accidentale)
        if (currentTime - lastClickTime < 300 && drawingMode !== 'select') {
            handleDoubleTap();
            return;
        }

        panStartX = touch.clientX;
        panStartY = touch.clientY;

        // In modalità selezione, controlla se si sta toccando un punto per il drag
        if (drawingMode === 'select') {
            const nearestPoint = findNearestPoint(coords.x, coords.y);

            if (nearestPoint) {
                isDraggingPoint = true;
                draggedSegment = nearestPoint.segment;
                draggedPointType = nearestPoint.pointType;
                selectedSegment = draggedSegment;
                updateMeasurement();
                updateSegmentsList();
                drawCanvas();
                return; // Non iniziare il pan
            }

            // Check if touching a segment (solo in modalità select)
            if (selectSegment(coords.x, coords.y)) {
                drawCanvas();
                updateSegmentsList();
            }
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

    if (DEBUG_MODE && points.length > 0) {
        addDebugLog('TOUCH_MOVE', `touches=${event.touches.length}, points.length=${points.length}`);
    }

    if (event.touches.length === 1 && !isMultiTouch) {
        const touch = event.touches[0];

        // Se stiamo trascinando un punto, aggiorna la sua posizione
        if (isDraggingPoint && draggedSegment && draggedPointType) {
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);

            if (draggedSegment.type === 'circle') {
                // Per i cerchi
                if (draggedPointType === 'center') {
                    // Sposta l'intero cerchio mantenendo il raggio costante
                    const deltaX = coords.x - draggedSegment.center.x;
                    const deltaY = coords.y - draggedSegment.center.y;

                    draggedSegment.center.x = coords.x;
                    draggedSegment.center.y = coords.y;
                    draggedSegment.radiusPoint.x += deltaX;
                    draggedSegment.radiusPoint.y += deltaY;
                } else if (draggedPointType === 'radiusPoint') {
                    // Modifica solo il raggio
                    draggedSegment.radiusPoint.x = coords.x;
                    draggedSegment.radiusPoint.y = coords.y;
                }
            } else {
                // Per i segmenti
                if (draggedPointType === 'start') {
                    draggedSegment.start.x = coords.x;
                    draggedSegment.start.y = coords.y;
                } else {
                    draggedSegment.end.x = coords.x;
                    draggedSegment.end.y = coords.y;
                }
            }

            updateMeasurement();
            updateSegmentsList();
            drawCanvas();
            return; // Non fare pan durante il drag
        }

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

    addDebugLog('TOUCH_END', `touches.length=${event.touches.length}, isPanning=${isPanning}, isMultiTouch=${isMultiTouch}, isDragging=${isDraggingPoint}`);

    if (event.touches.length === 0) {
        // All fingers lifted

        // Se stavamo trascinando un punto, termina il drag
        if (isDraggingPoint) {
            isDraggingPoint = false;
            draggedSegment = null;
            draggedPointType = null;
            showToast('Punto spostato', 'success');
        } else if (!isPanning && !isMultiTouch && touches.length === 1) {
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
    addDebugLog('ADD_POINT', `aggiunto punto ${points.length}: (${x.toFixed(1)}, ${y.toFixed(1)}) - points[0]=${points[0] ? `(${points[0].x.toFixed(1)},${points[0].y.toFixed(1)})` : 'null'}`);

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
        checkAndShowFeedbackModal(); // Controlla se mostrare il modal di feedback
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
        checkAndShowFeedbackModal(); // Controlla se mostrare il modal di feedback
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
        checkAndShowFeedbackModal(); // Controlla se mostrare il modal di feedback
        showToast('Nuovo rettangolo creato (4 segmenti)', 'success');
    } else if (drawingMode === 'circle') {
        // Modalità cerchio: crea un cerchio con centro e punto sul raggio
        const circle = {
            id: segmentCounter++,
            type: 'circle',
            name: `Cerchio ${segmentCounter - 1}`,
            center: points[0],
            radiusPoint: points[1]
        };

        segments.push(circle);
        selectedSegment = circle;
        points = [];
        previewPoint = null; // Resetta l'anteprima

        updateMeasurement();
        updateSegmentsList();
        checkAndShowFeedbackModal(); // Controlla se mostrare il modal di feedback
        showToast('Nuovo cerchio creato', 'success');
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

    // Log ridotto: solo quando c'è un disegno in corso
    // if (DEBUG_MODE && points.length > 0) {
    //     const segInfo = segments.map((s, i) => `[${i}]:(${s.start.x.toFixed(0)},${s.start.y.toFixed(0)})->(${s.end.x.toFixed(0)},${s.end.y.toFixed(0)})`).join(' ');
    //     addDebugLog('SNAP_CHECK_START', `segments.length=${segments.length} ${segInfo}, checking pos=(${x.toFixed(1)},${y.toFixed(1)}), hasFirstPoint=${points.length > 0}`);
    // }

    // Cerca tra tutti gli endpoint dei segmenti esistenti
    segments.forEach((segment, idx) => {
        // I cerchi non hanno endpoint per lo snap, salta
        if (segment.type === 'circle') {
            return;
        }

        // Controlla punto iniziale
        const distToStart = getPixelDistance({ x, y }, segment.start);

        // ESCLUDI il punto che corrisponde al primo punto del disegno corrente
        const isFirstPoint = points.length > 0 &&
                            Math.abs(points[0].x - segment.start.x) < 0.1 &&
                            Math.abs(points[0].y - segment.start.y) < 0.1;

        // Log solo se snap trovato E c'è un disegno in corso
        if (DEBUG_MODE && points.length > 0 && distToStart <= SNAP_DISTANCE) {
            const dx = Math.abs(points[0].x - segment.start.x);
            const dy = Math.abs(points[0].y - segment.start.y);
            addDebugLog('SNAP_DIST', `seg[${idx}].start=(${segment.start.x.toFixed(1)},${segment.start.y.toFixed(1)}) pt0=(${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}) dx=${dx.toFixed(3)} dy=${dy.toFixed(3)} isFirstPt=${isFirstPoint}`);
        }

        if (!isFirstPoint && distToStart <= minDistance) {
            minDistance = distToStart;
            nearestPoint = { ...segment.start };
        }

        // Controlla punto finale
        const distToEnd = getPixelDistance({ x, y }, segment.end);

        // ESCLUDI il punto che corrisponde al primo punto del disegno corrente
        const isFirstPointEnd = points.length > 0 &&
                                Math.abs(points[0].x - segment.end.x) < 0.1 &&
                                Math.abs(points[0].y - segment.end.y) < 0.1;

        // Log solo se snap trovato E c'è un disegno in corso
        if (DEBUG_MODE && points.length > 0 && distToEnd <= SNAP_DISTANCE) {
            addDebugLog('SNAP_DIST_END', `seg[${idx}].end=(${segment.end.x.toFixed(1)},${segment.end.y.toFixed(1)}) pt0=(${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}) isFirstPt=${isFirstPointEnd}`);
        }

        if (!isFirstPointEnd && distToEnd <= minDistance) {
            minDistance = distToEnd;
            nearestPoint = { ...segment.end };
        }
    });

    // Log ridotto: solo quando trova snap
    if (DEBUG_MODE && nearestPoint && points.length > 0) {
        addDebugLog('SNAP_FOUND_PREVIEW', `snap a (${nearestPoint.x.toFixed(1)},${nearestPoint.y.toFixed(1)})`);
    }

    return nearestPoint;
}

function calculateDistance(point1, point2) {
    const pixelDistance = getPixelDistance(point1, point2);

    const referencePx = parseFloat(document.getElementById('scale').value);
    const realMm = parseFloat(document.getElementById('real').value);

    // Se non è stato impostato un rapporto valido, mostra i pixel
    if (!referencePx || referencePx <= 0 || !realMm || realMm <= 0) {
        return pixelDistance.toFixed(2);
    }

    // Formula corretta: pixelDistance * (realMm / referencePx)
    const realDistance = pixelDistance * (realMm / referencePx);
    return realDistance.toFixed(2);
}

function selectSegment(x, y) {
    let newSelectedSegment = null;
    let minDistance = Infinity;

    // Trova il segmento più vicino
    segments.forEach(segment => {
        let distance;

        if (segment.type === 'circle') {
            // Per i cerchi: calcola distanza dal bordo del cerchio
            distance = distanceToCircle(x, y, segment);
        } else {
            // Per i segmenti: calcola distanza dalla linea
            distance = distanceToSegment(x, y, segment);
        }

        if (distance < SEGMENT_SELECT_DISTANCE && distance < minDistance) {
            minDistance = distance;
            newSelectedSegment = segment;
        }
    });

    // Se è stato trovato un segmento e non è quello già selezionato
    if (newSelectedSegment && newSelectedSegment !== selectedSegment) {
        selectedSegment = newSelectedSegment;
        // IMPORTANTE: NON resettare points[] se c'è un disegno in corso!
        // Altrimenti col pennino il touchStart del secondo click cancella il primo punto
        if (points.length === 0) {
            points = []; // Reset punti temporanei solo se non stiamo disegnando
        }

        // Abilita il pulsante "Imposta come riferimento"
        const setRefBtn = document.getElementById('set-reference-btn');
        if (setRefBtn) {
            setRefBtn.disabled = false;
        }

        showToast(`Selezionato: ${selectedSegment.name}`, 'info');
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

function distanceToCircle(x, y, circle) {
    // Calcola la distanza dal centro del cerchio
    const distanceFromCenter = getPixelDistance({ x, y }, circle.center);

    // Calcola il raggio del cerchio
    const radius = getPixelDistance(circle.center, circle.radiusPoint);

    // Restituisce la distanza dal bordo del cerchio
    // Se il punto è dentro il cerchio, la distanza è negativa (ma prendiamo il valore assoluto)
    return Math.abs(distanceFromCenter - radius);
}

function findNearestPoint(x, y) {
    let nearestSegment = null;
    let nearestPointType = null;
    let minDistance = CONTROL_POINT_SELECTED_RADIUS * 2; // Soglia di selezione

    segments.forEach(segment => {
        if (segment.type === 'circle') {
            // Per i cerchi: controlla centro e radiusPoint
            const distToCenter = getPixelDistance({ x, y }, segment.center);
            if (distToCenter < minDistance) {
                minDistance = distToCenter;
                nearestSegment = segment;
                nearestPointType = 'center';
            }

            const distToRadiusPoint = getPixelDistance({ x, y }, segment.radiusPoint);
            if (distToRadiusPoint < minDistance) {
                minDistance = distToRadiusPoint;
                nearestSegment = segment;
                nearestPointType = 'radiusPoint';
            }
        } else {
            // Per i segmenti: controlla start e end
            const distToStart = getPixelDistance({ x, y }, segment.start);
            if (distToStart < minDistance) {
                minDistance = distToStart;
                nearestSegment = segment;
                nearestPointType = 'start';
            }

            const distToEnd = getPixelDistance({ x, y }, segment.end);
            if (distToEnd < minDistance) {
                minDistance = distToEnd;
                nearestSegment = segment;
                nearestPointType = 'end';
            }
        }
    });

    return nearestSegment ? { segment: nearestSegment, pointType: nearestPointType } : null;
}

// === FUNZIONI UI E UTILITA' ===
function updateMeasurement() {
    if (selectedSegment) {
        let pixelDistance, realDistance, statusText;

        if (selectedSegment.type === 'circle') {
            // Per i cerchi: mostra raggio e diametro
            const radiusPixels = getPixelDistance(selectedSegment.center, selectedSegment.radiusPoint);
            const radiusReal = calculateDistance(selectedSegment.center, selectedSegment.radiusPoint);
            const diameterReal = (parseFloat(radiusReal) * 2).toFixed(2);

            pixelDistance = radiusPixels;
            realDistance = radiusReal;
            statusText = `${selectedSegment.name}: r=${radiusReal}mm | ø=${diameterReal}mm`;
        } else {
            // Per i segmenti: mostra distanza
            pixelDistance = getPixelDistance(selectedSegment.start, selectedSegment.end);
            realDistance = calculateDistance(selectedSegment.start, selectedSegment.end);
            statusText = `${selectedSegment.name}: ${pixelDistance.toFixed(1)}px → ${realDistance} mm`;
        }

        const pixelSelElement = document.getElementById('pixelsel');
        const realSelElement = document.getElementById('realsel');

        // Mostra i pixel del segmento selezionato con maggiore precisione
        if (pixelSelElement) {
            pixelSelElement.value = pixelDistance.toFixed(3);
        }

        // Mostra la misura calcolata con il rapporto corrente
        if (realSelElement) {
            realSelElement.value = realDistance;
        }

        // Aggiorna status bar
        if (currentMeasurement) {
            currentMeasurement.textContent = statusText;
        }
    } else {
        const pixelSelElement = document.getElementById('pixelsel');
        const realSelElement = document.getElementById('realsel');

        if (pixelSelElement) {
            pixelSelElement.value = '';
        }
        if (realSelElement) {
            realSelElement.value = '';
        }
        if (currentMeasurement) {
            currentMeasurement.textContent = 'Nessuna selezione';
        }
    }
}

function setAsReference() {
    const scaleElement = document.getElementById('scale');
    const realElement = document.getElementById('real');

    const referencePx = parseFloat(scaleElement?.value);
    const realMm = parseFloat(realElement?.value);

    // Validazione: entrambi i campi devono essere compilati e maggiori di zero
    if (!referencePx || referencePx <= 0 || !realMm || realMm <= 0) {
        showToast('Inserisci valori validi in "Riferimento (px)" e "Misura reale (mm)"', 'warning');
        return;
    }

    // Calcola il rapporto
    const ratio = realMm / referencePx;

    showToast(`Rapporto di scala applicato: ${referencePx.toFixed(1)}px = ${realMm}mm (${ratio.toFixed(4)} mm/px)`, 'success');

    // Ridisegna tutto con il nuovo rapporto
    updateMeasurement();
    updateSegmentsList();
    drawCanvas();
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

    let pixelDistance, realDistance, measurementText;

    if (segment.type === 'circle') {
        // Per i cerchi: mostra raggio e diametro
        pixelDistance = getPixelDistance(segment.center, segment.radiusPoint);
        realDistance = calculateDistance(segment.center, segment.radiusPoint);
        const diameterReal = (parseFloat(realDistance) * 2).toFixed(2);
        measurementText = `r: ${realDistance}mm | ø: ${diameterReal}mm`;
    } else {
        // Per i segmenti: mostra distanza
        pixelDistance = getPixelDistance(segment.start, segment.end);
        realDistance = calculateDistance(segment.start, segment.end);
        measurementText = `${pixelDistance.toFixed(1)}px → ${realDistance}mm`;
    }

    item.innerHTML = `
        <div class="flex-grow-1">
            <div class="fw-bold segment-name" contenteditable="true" style="font-size: 0.9rem;">${segment.name}</div>
            <div class="text-muted" style="font-size: 0.8rem;">${measurementText}</div>
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
        segment.name = nameElement.textContent.trim() || (segment.type === 'circle' ? `Cerchio ${index + 1}` : `Segmento ${index + 1}`);
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

function undoLastSegment() {
    if (segments.length === 0) {
        showToast('Nessun segmento da annullare', 'info');
        return;
    }

    // Rimuovi l'ultimo segmento inserito
    const removedSegment = segments.pop();

    // Se il segmento rimosso era selezionato, deseleziona
    if (selectedSegment === removedSegment) {
        selectedSegment = null;
        updateMeasurement();
    }

    updateSegmentsList();
    drawCanvas();
    showToast(`Annullato: ${removedSegment.name}`, 'info');
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

// === FUNZIONI FEEDBACK ===
function checkAndShowFeedbackModal() {
    // Controlla se il modal non è mai stato mostrato
    const feedbackStatus = localStorage.getItem('imgmeasure-feedback-status');

    // Se l'utente ha già risposto (yes, later, never), non mostrare più
    if (feedbackStatus) {
        return;
    }

    // Se è già stato mostrato in questa sessione, non mostrare di nuovo
    if (feedbackShown) {
        return;
    }

    // Controlla se abbiamo raggiunto il numero di segmenti richiesto
    if (segments.length === FEEDBACK_TRIGGER_COUNT) {
        feedbackShown = true; // Segna come mostrato in questa sessione

        // Mostra il modal dopo un piccolo delay per non essere troppo invasivo
        setTimeout(() => {
            const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
            feedbackModal.show();
        }, 1000);
    }
}

function handleFeedbackResponse(response) {
    // Salva la risposta in localStorage per non mostrare più il modal
    localStorage.setItem('imgmeasure-feedback-status', response);

    // Chiudi il modal
    const feedbackModal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
    if (feedbackModal) {
        feedbackModal.hide();
    }

    if (response === 'yes') {
        showToast('Grazie per il tuo feedback!', 'success');
    } else if (response === 'never') {
        showToast('Ok, non ti disturberemo più', 'info');
    }
}

function openFeedbackManually() {
    // Funzione chiamata quando si clicca il pulsante feedback nella navbar
    const feedbackModal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    feedbackModal.show();
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

    // Toggle segments visibility button
    const toggleSegmentsBtn = document.getElementById('toggle-segments');

    if (toggleSegmentsBtn) {
        toggleSegmentsBtn.addEventListener('click', () => {
            showSegments = !showSegments;
            if (showSegments) {
                toggleSegmentsBtn.classList.add('active');
                showToast('Segmenti visibili', 'info');
            } else {
                toggleSegmentsBtn.classList.remove('active');
                showToast('Segmenti nascosti - immagine pulita', 'info');
            }
            drawCanvas();
        });
    }

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

    // Mode buttons
    const modeSelectBtn = document.getElementById('mode-select');
    const modeSegmentBtn = document.getElementById('mode-segment');
    const modeContinuousBtn = document.getElementById('mode-continuous');
    const modeRectangleBtn = document.getElementById('mode-rectangle');
    const modeCircleBtn = document.getElementById('mode-circle');

    if (modeSelectBtn) {
        modeSelectBtn.addEventListener('click', () => {
            drawingMode = 'select';
            modeSelectBtn.classList.add('active');
            modeSegmentBtn?.classList.remove('active');
            modeContinuousBtn?.classList.remove('active');
            modeRectangleBtn?.classList.remove('active');
            modeCircleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Selezione attivata - clicca sui segmenti per selezionarli', 'info');
        });
    }

    if (modeSegmentBtn) {
        modeSegmentBtn.addEventListener('click', () => {
            drawingMode = 'segment';
            modeSelectBtn?.classList.remove('active');
            modeSegmentBtn.classList.add('active');
            modeContinuousBtn?.classList.remove('active');
            modeRectangleBtn?.classList.remove('active');
            modeCircleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Segmento attivata', 'info');
        });
    }

    if (modeContinuousBtn) {
        modeContinuousBtn.addEventListener('click', () => {
            drawingMode = 'continuous';
            modeSelectBtn?.classList.remove('active');
            modeSegmentBtn?.classList.remove('active');
            modeContinuousBtn.classList.add('active');
            modeRectangleBtn?.classList.remove('active');
            modeCircleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Segmento Continuativo attivata', 'info');
        });
    }

    if (modeRectangleBtn) {
        modeRectangleBtn.addEventListener('click', () => {
            drawingMode = 'rectangle';
            modeSelectBtn?.classList.remove('active');
            modeSegmentBtn?.classList.remove('active');
            modeContinuousBtn?.classList.remove('active');
            modeRectangleBtn.classList.add('active');
            modeCircleBtn?.classList.remove('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Rettangolo attivata', 'info');
        });
    }

    if (modeCircleBtn) {
        modeCircleBtn.addEventListener('click', () => {
            drawingMode = 'circle';
            modeSelectBtn?.classList.remove('active');
            modeSegmentBtn?.classList.remove('active');
            modeContinuousBtn?.classList.remove('active');
            modeRectangleBtn?.classList.remove('active');
            modeCircleBtn.classList.add('active');
            points = []; // Reset punti temporanei
            previewPoint = null;
            drawCanvas();
            showToast('Modalità Cerchio attivata - primo click centro, secondo click raggio', 'info');
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
    const setReferenceBtn = document.getElementById('set-reference-btn');

    if (scaleElement) {
        scaleElement.addEventListener('input', () => {
            updateMeasurement();
            updateSegmentsList();
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

    if (setReferenceBtn) {
        setReferenceBtn.addEventListener('click', setAsReference);
    }

    // Controls
    const undoBtn = document.getElementById('undo-btn');
    const deleteAllElement = document.getElementById('deleteall');
    const zoomInElement = document.getElementById('zoom-in');
    const zoomOutElement = document.getElementById('zoom-out');
    const resetElement = document.getElementById('reset');
    const centerElement = document.getElementById('center');

    if (undoBtn) undoBtn.addEventListener('click', undoLastSegment);
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
    // Listener per Ctrl+Z / Cmd+Z - undo ultimo segmento
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            cancelCurrentDrawing();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault(); // Previeni il comportamento predefinito del browser
            undoLastSegment();
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

    // Feedback system event listeners
    const feedbackBtn = document.getElementById('feedback-btn');
    const feedbackYesBtn = document.getElementById('feedback-yes-btn');
    const feedbackLaterBtn = document.getElementById('feedback-later-btn');
    const feedbackNeverBtn = document.getElementById('feedback-never-btn');

    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', openFeedbackManually);
    }

    if (feedbackYesBtn) {
        feedbackYesBtn.addEventListener('click', () => {
            handleFeedbackResponse('yes');
        });
    }

    if (feedbackLaterBtn) {
        feedbackLaterBtn.addEventListener('click', () => {
            handleFeedbackResponse('later');
        });
    }

    if (feedbackNeverBtn) {
        feedbackNeverBtn.addEventListener('click', () => {
            handleFeedbackResponse('never');
        });
    }

    // Initialize
    resizeCanvas();
    updateSegmentsList();
    showToast('Applicazione pronta. Carica un\'immagine per iniziare.', 'info');
    if (DEBUG_MODE) {
        addDebugLog('APP_START', 'Applicazione inizializzata');
    }
});

