document.getElementById('upload').addEventListener('change', loadImage);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let img = new Image();
let points = [];
let segments = [];
let selectedSegment = null;
let isDragging = false;
let scaleFactor = 1;
let zoomFactor = 1;  // Fattore di zoom iniziale

function loadImage(event) {
    const file = event.target.files[0];
    img.src = URL.createObjectURL(file);

    img.onload = function() {
        resizeCanvas();
        segments = [];
        points = [];
        selectedSegment = null;
        drawCanvas();
    };
}

function resizeCanvas() {
    const maxCanvasWidth = 800;
    const maxCanvasHeight = 600;
    
    const widthRatio = maxCanvasWidth / img.width;
    const heightRatio = maxCanvasHeight / img.height;
    scaleFactor = Math.min(widthRatio, heightRatio);

    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;
}

function drawCanvas() {
    if (img.complete) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(zoomFactor, zoomFactor); // Applica lo zoom al canvas
      ctx.drawImage(img, imgX, imgY, img.width * scaleFactor, img.height * scaleFactor); // Apply panning offsets
      segments.forEach(segment => drawSegment(segment));
      ctx.restore();
    }
  }
  
  function drawSegment(segment) {
    // Calcola le coordinate corrette dei punti di inizio e fine in base allo zoom
    const startX = (segment.start.x * scaleFactor) + imgX;
    const startY = (segment.start.y * scaleFactor) + imgY;
    const endX = (segment.end.x * scaleFactor) + imgX;
    const endY = (segment.end.y * scaleFactor) + imgY;
  
    ctx.strokeStyle = segment === selectedSegment ? 'blue' : 'red';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  
    if (segment === selectedSegment) {
      const distance = calculateDistance(segment.start, segment.end);
      ctx.fillStyle = 'black';
      const poslabel = movedMidPoint(segment, 10);
      ctx.fillRect(
        poslabel.x * scaleFactor + imgX - 10,
        poslabel.y * scaleFactor + imgY - 12,
        70,
        15
      );
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(`${distance}`, poslabel.x * scaleFactor + imgX, poslabel.y * scaleFactor + imgY);
    }
  }

canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - imgX*zoomFactor) / (scaleFactor * zoomFactor);
    const y = (event.clientY - rect.top - imgY*zoomFactor) / (scaleFactor * zoomFactor);


    if (selectSegment(x, y)) {
        drawCanvas();
        return;
    }
    
    points.push({ x, y });
    if (points.length === 2) {
        const segment = { start: points[0], end: points[1] };
        segments.push(segment);
        drawCanvas();
        points = [];
    }
});

function calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    
    const scale = parseFloat(document.getElementById('scale').value) || 1;
    const scaledDistance = pixelDistance / scale;
    return scaledDistance.toFixed(2);
}

function movedMidPoint(segment, d) {
    const xMid = (segment.start.x + segment.end.x) / 2;
    const yMid = (segment.start.y + segment.end.y) / 2;

    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;

    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = dy / length;
    const ny = -dx / length;

    const xSpostato = xMid + d * nx;
    const ySpostato = yMid + d * ny;

    return { x: xSpostato, y: ySpostato };
}

function selectSegment(x, y) {
    selectedSegment = null;
    segments.forEach(segment => {
        if (isNearSegment(x, y, segment)) {
            selectedSegment = segment;
            points = [];
    
            const real = parseFloat(document.getElementById('real').value) || 1;
            const distance = calculateDistance(segment.start, segment.end);
            document.getElementById('realsel').value = (distance * real).toFixed(2);
        }
    });
    return selectedSegment !== null;
}

function isNearSegment(x, y, segment, maxDistance = 3) {
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

    return Math.sqrt(distanceSq) < maxDistance;
}

canvas.addEventListener('mousedown', function(event) {
    if (selectedSegment) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / (scaleFactor * zoomFactor);
        const y = (event.clientY - rect.top) / (scaleFactor * zoomFactor);

        selectedSegment.offsetStartX = x - selectedSegment.start.x;
        selectedSegment.offsetStartY = y - selectedSegment.start.y;
        selectedSegment.offsetEndX = x - selectedSegment.end.x;
        selectedSegment.offsetEndY = y - selectedSegment.end.y;
        isDragging = true;
        canvas.addEventListener('mousemove', moveSegment);
    }
});

canvas.addEventListener('mouseup', function() {
    isDragging = false;
    canvas.removeEventListener('mousemove', moveSegment);
});

function moveSegment(event) {
    if (!isDragging || !selectedSegment) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / (scaleFactor * zoomFactor);
    const y = (event.clientY - rect.top) / (scaleFactor * zoomFactor);

    selectedSegment.start.x = x - selectedSegment.offsetStartX;
    selectedSegment.start.y = y - selectedSegment.offsetStartY;
    selectedSegment.end.x = x - selectedSegment.offsetEndX;
    selectedSegment.end.y = y - selectedSegment.offsetEndY;

    drawCanvas();
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('delete').addEventListener('click', function() {
        if (selectedSegment) {
            segments = segments.filter(segment => segment !== selectedSegment);
            selectedSegment = null;
            drawCanvas();
        }
    });

    document.getElementById('deleteall').addEventListener('click', function() {
        segments = [];
        drawCanvas();
    });

    document.getElementById('zoom-in').addEventListener('click', function() {
        zoomFactor += 0.1;
        drawCanvas();
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        zoomFactor = Math.max(0.1, zoomFactor - 0.1);
        drawCanvas();
    });

    document.getElementById('xplus').addEventListener('click', moveRight);
    document.getElementById('xminus').addEventListener('click', moveLeft);
    document.getElementById('yplus').addEventListener('click', moveDown);
    document.getElementById('yminus').addEventListener('click', moveUp);
    document.getElementById('reset').addEventListener('click', reset);

});

let imgX = 0;
let imgY = 0;

// Funzioni per spostare l'immagine
function moveUp() {
    imgY -= 10; // Regola la quantità di spostamento
    drawCanvas();
}

function moveDown() {
    imgY += 10;
    drawCanvas();
}

function moveLeft() {
    imgX -= 10;
    drawCanvas();
}

function moveRight() {
    imgX += 10;
    drawCanvas();
}

function reset() {
    imgX = 0;
    imgY = 0;
    zoomFactor = 1;
    drawCanvas();
}
