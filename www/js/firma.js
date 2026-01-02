// -------- Manejo de firma del cliente --------

// Variables de estado
let firmaCanvas, ctx, dibujando = false;
let firmaDataURL = null;
let pedidoEnFirma = null;

// Inicializa el canvas de firma
function inicializarFirma() {
  firmaCanvas = document.getElementById("canvas-firma");
  ctx = firmaCanvas.getContext("2d");

  // limpiar estado
  ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaDataURL = null;
  dibujando = false;

  // Elimina listeners previos clonando el canvas
  const nuevoCanvas = firmaCanvas.cloneNode(true);
  firmaCanvas.parentNode.replaceChild(nuevoCanvas, firmaCanvas);
  firmaCanvas = nuevoCanvas;
  ctx = firmaCanvas.getContext("2d");

  // ratón
  firmaCanvas.addEventListener("mousedown", empezarDibujo);
  firmaCanvas.addEventListener("mouseup", terminarDibujo);
  firmaCanvas.addEventListener("mouseleave", terminarDibujo);
  firmaCanvas.addEventListener("mousemove", dibujar);

  // táctil
  firmaCanvas.addEventListener("touchstart", empezarDibujo, { passive: false });
  firmaCanvas.addEventListener("touchend", terminarDibujo, { passive: false });
  firmaCanvas.addEventListener("touchcancel", terminarDibujo, { passive: false });
  firmaCanvas.addEventListener("touchmove", dibujar, { passive: false });
}

// Funciones de dibujo
function empezarDibujo(e) {
  e.preventDefault();
  dibujando = true;
  ctx.beginPath();
  ctx.moveTo(getX(e), getY(e));
}

function terminarDibujo(e) {
  e.preventDefault();
  dibujando = false;
}

function dibujar(e) {
  e.preventDefault();
  if (!dibujando) return;
  ctx.lineTo(getX(e), getY(e));
  ctx.stroke();
}

// Coordenadas relativas al canvas
function getX(e) {
  const rect = firmaCanvas.getBoundingClientRect();
  return e.touches ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
}
function getY(e) {
  const rect = firmaCanvas.getBoundingClientRect();
  return e.touches ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
}

// Botón limpiar
$("#btn-limpiar-firma").on("click", function() {
  if (!ctx || !firmaCanvas) return;
  ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaDataURL = null;
});

// Botón guardar
$("#btn-guardar-firma").on("click", function() {
  if (!firmaCanvas) { alert("Canvas no inicializado"); return; }
  firmaDataURL = firmaCanvas.toDataURL("image/png");
  $("#popup-firma").popup("close");
  if (pedidoEnFirma) {
    cerrarPedidoPrestashop(pedidoEnFirma, 5); // usa tu función de cierre
    pedidoEnFirma = null;
  }
});

// Abre popup de firma y guarda el id del pedido
function iniciarCierreConFirma(pedidoId, nuevoEstado) {
    alert('Forma inicializada');
  if (!pedidosListos) {
    alert("Los pedidos aún se están cargando. Intenta de nuevo en unos segundos.");
    return;
  }
  if (firmaObligatoria) {
    pedidoEnFirma = pedidoId;
    $("#popup-firma").popup("open");
    inicializarFirma();
  } else {
    cerrarPedidoPrestashop(pedidoId, nuevoEstado);
  }
}
