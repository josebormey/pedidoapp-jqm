// -------- Formato de moneda --------
function formatoMoneda(valor) {
  return parseFloat(valor).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " MN";
}

// -------- Funciones auxiliares --------
function obtenerCliente(idCliente, callback) {
  const url = `${API_URL}/customers/${idCliente}?ws_key=${WS_KEY}&output_format=JSON`;

  if (ES_CORDOVA) {
    cordova.plugin.http.sendRequest(url, { method: "get" }, function(resp) {
      try { const data = JSON.parse(resp.data); callback(null, data.customer || {}); }
      catch(e) { callback(e, {}); }
    }, function(err) { callback(err, {}); });
  } else {
    fetch(url)
      .then(resp => resp.json())
      .then(data => callback(null, data.customer || {}))
      .catch(err => callback(err, {}));
  }
}

function obtenerDireccion(idDireccion, callback) {
  const url = `${API_URL}/addresses/${idDireccion}?ws_key=${WS_KEY}&output_format=JSON`;

  if (ES_CORDOVA) {
    cordova.plugin.http.sendRequest(url, { method: "get" }, function(resp) {
      try { const data = JSON.parse(resp.data); callback(null, data.address || {}); }
      catch(e) { callback(e, {}); }
    }, function(err) { callback(err, {}); });
  } else {
    fetch(url)
      .then(resp => resp.json())
      .then(data => callback(null, data.address || {}))
      .catch(err => callback(err, {}));
  }
}

function obtenerPedidosCompletos(idCarrier, callback) {
  const url = `${API_URL}/orders?ws_key=${WS_KEY}&output_format=JSON&filter[id_carrier]=${idCarrier}&display=full`;

  if (ES_CORDOVA) {
    cordova.plugin.http.sendRequest(url, { method: "get", headers: { "Accept": "application/json" } }, function(response) {
      try { const data = JSON.parse(response.data); callback(null, data.orders || []); }
      catch (e) { callback(e, []); }
    }, function(error) { callback(error, []); });
  } else {
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(resp => resp.json())
      .then(data => callback(null, data.orders || []))
      .catch(err => callback(err, []));
  }
}
function procesarPedidos(idCarrier, callback) {
  obtenerPedidosCompletos(idCarrier, function(err, pedidos) {
    if (err) { callback(err, []); return; }
    const filtrados = pedidos.filter(p => ESTADOS_PEDIDO[parseInt(p.current_state)] === "En espera de validacion por contra reembolso");
    let enriquecidos = [], pendientes = filtrados.length;
    if (pendientes === 0) { callback(null, []); return; }

    filtrados.forEach(p => {
      obtenerCliente(p.id_customer, function(errC, cliente) {
        obtenerDireccion(p.id_address_delivery, function(errD, direccion) {
          enriquecidos.push({
            id: p.id,
            cliente: `${cliente.firstname || ""} ${cliente.lastname || ""}`,
            telefono: direccion.phone || direccion.phone_mobile || "Teléfono no disponible",
            direccion: `${direccion.address1 || ""}, ${direccion.postcode || ""} ${direccion.city || ""}`,
            total: p.total_paid,
            productos: p.associations?.order_rows || [],
            estado: ESTADOS_PEDIDO[parseInt(p.current_state)] || "Desconocido"
          });
          pendientes--;
          if (pendientes === 0) callback(null, enriquecidos);
        });
      });
    });
  });
}

// -------- Notificación de nuevos pedidos --------
function notificarNuevosPedidos(pedidos) {
  if (!ES_CORDOVA || !notificacionesDisponibles) return;
  pedidos.forEach(p => {
    if (!pedidosCache.find(pc => pc.id == p.id)) {
      cordova.plugins.notification.local.schedule({
        id: p.id,
        title: "Nuevo pedido en curso",
        text: `Pedido #${p.id} - ${p.cliente} (${formatoMoneda(p.total)})`
      });
    }
  });
}

// -------- Cargar pedidos --------
function cargarPedidos() {
  console.log("cargarPedidos ejecutado");
  $("#lista-pedidos").html("<p>Cargando...</p>");
  procesarPedidos(CARRIER_ID, function(err, pedidos) {
    $("#lista-pedidos").empty();
    if (err) { $("#lista-pedidos").html("<p>Error al cargar pedidos</p>"); return; }
    $("#contador-pedidos").text(pedidos.length);
    if (pedidos.length === 0) {
      $("#lista-pedidos").html("<p>No existen pedidos en 'Espera de validacion contra reembolso'</p>");
    } else {
      notificarNuevosPedidos(pedidos);
      pedidosCache = pedidos;
      pedidosListos = true;
      pedidosListosFlag = true;

      pedidos.forEach(p => {
        $("#lista-pedidos").append(
          `<div class="pedido-card">
             <h2 class="${claseEstado(p.estado)}">Pedido #${p.id} - ${p.estado}</h2>
             <p><strong>Cliente:</strong> ${p.cliente}</p>
             <p><strong>Teléfono:</strong> ${p.telefono}</p>
             <p><strong>Dirección:</strong> ${p.direccion}</p>
             <p><strong>Total:</strong> ${formatoMoneda(p.total)}</p>
             <a href="#" onclick="mostrarProductos(${p.id})"
                class="ui-btn ui-mini ui-btn-b">Ver productos</a>
             <a href="#" data-id="${p.id}" onclick="iniciarCierreConFirma(${p.id},5)"
                class="ui-btn ui-mini ui-btn-b">Cerrar pedido</a>
           </div>`
        );
      });
    }
  });
}

// -------- Mostrar productos --------
function mostrarProductos(pedidoId) {
  const pedido = pedidosCache.find(p => p.id == pedidoId);
  $("#lista-productos").empty();
  if (pedido && pedido.productos.length > 0) {
    pedido.productos.forEach(row => {
      $("#lista-productos").append(
        `<li>${row.product_name} x${row.product_quantity} - ${formatoMoneda(row.unit_price_tax_incl)}</li>`
      );
    });
  } else {
    $("#lista-productos").append("<li>Este pedido no tiene productos asociados</li>");
  }
  $("#lista-productos").listview("refresh");
  $("#popup-productos").popup("open");
}
// -------- Obtener pedido por ID --------
function obtenerPedidoPorId(pedidoId, callback) {
  const url = `${API_URL}/orders/${pedidoId}?ws_key=${WS_KEY}&output_format=JSON`;

  if (ES_CORDOVA) {
    cordova.plugin.http.setDataSerializer("json");
    cordova.plugin.http.sendRequest(
      url,
      { method: "get", headers: { "Accept": "application/json" } },
      function(resp) {
        try {
          let data = resp.data;
          if (typeof data === "string") data = JSON.parse(data);
          callback(null, data.order || null);
        } catch (e) { callback(e, null); }
      },
      function(err) { callback(err, null); }
    );
  } else {
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(resp => resp.json())
      .then(data => callback(null, data.order || null))
      .catch(err => callback(err, null));
  }
}

// -------- Cerrar pedido en PrestaShop --------
function cerrarPedidoPrestashop(pedidoId, nuevoEstado) {
  if (!pedidosListos) {
    alert("Los pedidos aún se están cargando. Intenta de nuevo en unos segundos.");
    return;
  }

  obtenerPedidoPorId(pedidoId, function(err, pedido) {
    if (err || !pedido) {
      alert("Error al obtener datos del pedido: " + JSON.stringify(err));
      return;
    }

    const reciclable = pedido.recyclable === true || pedido.recyclable === "1" ? "1" : "0";
    const gift = pedido.gift === true || pedido.gift === "1" ? "1" : "0";

    const xmlData = `<prestashop><order>
      <id><![CDATA[${pedido.id}]]></id>
      <current_state><![CDATA[${nuevoEstado}]]></current_state>
      <secure_key><![CDATA[${pedido.secure_key}]]></secure_key>
      <payment><![CDATA[${pedido.payment}]]></payment>
      <recyclable><![CDATA[${reciclable}]]></recyclable>
      <gift><![CDATA[${gift}]]></gift>
      <reference><![CDATA[${pedido.reference}]]></reference>
    </order></prestashop>`;

    const url = `${API_URL}/orders/${pedidoId}?ws_key=${WS_KEY}&output_format=JSON`;

    if (ES_CORDOVA) {
      cordova.plugin.http.setDataSerializer("utf8");
      cordova.plugin.http.sendRequest(
        url,
        {
          method: "put",
          data: xmlData,
          headers: { "Content-Type": "application/xml", "Accept": "application/json" }
        },
        function(response) {
          alert("Pedido #" + pedidoId + " actualizado a estado Entregado");
          cargarPedidos();
        },
        function(error) {
          alert("Error al cerrar pedido:\nPor favor intentelo de nuevo");
        }
      );
    } else {
      fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/xml", "Accept": "application/json" },
        body: xmlData
      })
      .then(resp => resp.json())
      .then(() => {
        alert("Pedido #" + pedidoId + " actualizado a estado Entregado (web)");
        cargarPedidos();
      })
      .catch(() => alert("Error al cerrar pedido en web"));
    }
  });
}

// -------- Manejo de firma del cliente --------
function inicializarFirma() {
  firmaCanvas = document.getElementById("canvas-firma");
  ctx = firmaCanvas.getContext("2d");

  ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaDataURL = null;
  dibujando = false;

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
    cerrarPedidoPrestashop(pedidoEnFirma, 5);
    pedidoEnFirma = null;
  }
});

// Abre popup de firma
function iniciarCierreConFirma(pedidoId, nuevoEstado) {
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
