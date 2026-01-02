
// Funcion de formato moneda
function formatoMoneda(valor) {
  return parseFloat(valor).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " MN";
}

// Funciones auxiliares para cliente y dirección
function obtenerCliente(idCliente, callback) {
  const url = `${API_URL}/customers/${idCliente}?ws_key=${WS_KEY}&output_format=JSON`;
  cordova.plugin.http.sendRequest(url, { method: "get" }, function(resp) {
    try { const data = JSON.parse(resp.data); callback(null, data.customer || {}); }
    catch(e) { callback(e, {}); }
  }, function(err) { callback(err, {}); });
}

function obtenerDireccion(idDireccion, callback) {
  const url = `${API_URL}/addresses/${idDireccion}?ws_key=${WS_KEY}&output_format=JSON`;
  cordova.plugin.http.sendRequest(url, { method: "get" }, function(resp) {
    try { const data = JSON.parse(resp.data); callback(null, data.address || {}); }
    catch(e) { callback(e, {}); }
  }, function(err) { callback(err, {}); });
}

function obtenerPedidosCompletos(idCarrier, callback) {
  const url = `${API_URL}/orders?ws_key=${WS_KEY}&output_format=JSON&filter[id_carrier]=${idCarrier}&display=full`;
  cordova.plugin.http.sendRequest(url, { method: "get", headers: { "Accept": "application/json" } }, function(response) {
    try { const data = JSON.parse(response.data); callback(null, data.orders || []); }
    catch (e) { callback(e, []); }
  }, function(error) { callback(error, []); });
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

// Notificación de nuevos pedidos (solo si el plugin está disponible)
function notificarNuevosPedidos(pedidos) {
  if (!notificacionesDisponibles) return;
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

let pedidosListosFlag = false;

function cargarPedidos() {
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

function obtenerPedidoPorId(pedidoId, callback) {
  const url = `${API_URL}/orders/${pedidoId}?ws_key=${WS_KEY}&output_format=JSON`;
  cordova.plugin.http.setDataSerializer("json");
  cordova.plugin.http.sendRequest(
    url,
    { method: "get", headers: { "Accept": "application/json" } },
    function(resp) {
      try {
        let data = resp.data;
        if (typeof data === "string") data = JSON.parse(data);
        if (data && data.order) {
          console.log("Pedido obtenido correctamente:", data.order);
          callback(null, data.order);
        } else {
          console.log("Respuesta inesperada:", data);
          callback(new Error("No se encontró 'order' en la respuesta"), null);
        }
      } catch (e) {
        console.error("Error parseando respuesta:", e, resp.data);
        callback(e, null);
      }
    },
    function(err) {
      console.error("Error HTTP al obtener pedido:", err);
      callback(err || new Error("Error HTTP desconocido"), null);
    }
  );
}

// Flujo de firma antes de cerrar
function inicializarFirma() {
  firmaCanvas = document.getElementById("canvas-firma");
  ctx = firmaCanvas.getContext("2d");

  // limpiar estado
  ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaDataURL = null;

  firmaCanvas.addEventListener("mousedown", empezarDibujo);
  firmaCanvas.addEventListener("mouseup", terminarDibujo);
  firmaCanvas.addEventListener("mousemove", dibujar);

  firmaCanvas.addEventListener("touchstart", empezarDibujo);
  firmaCanvas.addEventListener("touchend", terminarDibujo);
  firmaCanvas.addEventListener("touchmove", dibujar);
}

function empezarDibujo(e) {
  dibujando = true;
  ctx.beginPath();
  ctx.moveTo(getX(e), getY(e));
}
function terminarDibujo() { dibujando = false; }
function dibujar(e) {
  if (!dibujando) return;
  ctx.lineTo(getX(e), getY(e));
  ctx.stroke();
}
function getX(e) { return e.touches ? e.touches[0].clientX - firmaCanvas.offsetLeft : e.clientX - firmaCanvas.offsetLeft; }
function getY(e) { return e.touches ? e.touches[0].clientY - firmaCanvas.offsetTop : e.clientY - firmaCanvas.offsetTop; }

$("#btn-limpiar-firma").on("click", function() {
  if (!ctx || !firmaCanvas) return;
  ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaDataURL = null;
});

$("#btn-guardar-firma").on("click", function() {
  if (!firmaCanvas) { alert("Canvas no inicializado"); return; }
  firmaDataURL = firmaCanvas.toDataURL("image/png");
  $("#popup-firma").popup("close");
  if (pedidoEnFirma) {
    // tras guardar firma, cerramos el pedido
    cerrarPedidoPrestashop(pedidoEnFirma, 5);
    pedidoEnFirma = null;
  }
});

// Abre popup de firma y guarda el id del pedido
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

function cerrarPedidoPrestashop(pedidoId, nuevoEstado) {
  if (!pedidosListos) {
    alert("Los pedidos aún se están cargando. Intenta de nuevo en unos segundos.");
    return;
  }

  obtenerPedidoPorId(pedidoId, function(err, pedido) {
    if (err || !pedido) {
      alert("Error al obtener datos del pedido: " + JSON.stringify(err));
      alert("El error es: " + err + " y el pedido es: " + pedido);
      return;
    }

    // Validación de campos críticos
    if (!pedido.module || pedido.module.trim() === "") { alert("Error: 'module' vacío."); return; }
    if (!pedido.payment || pedido.payment.trim() === "") { alert("Error: 'payment' vacío."); return; }
    if (!pedido.secure_key || pedido.secure_key.trim() === "") { alert("Error: 'secure_key' vacío."); return; }
    if (!pedido.id_shop || !pedido.id_shop_group) { alert("Error: faltan id_shop/id_shop_group."); return; }

    const reciclable = pedido.recyclable === true || pedido.recyclable === "1" ? "1" : "0";
    const gift = pedido.gift === true || pedido.gift === "1" ? "1" : "0";

    // Nota: firmaDataURL disponible si se usó el popup de firma (puedes enviarla a tu backend aparte)
    const xmlData = `
<prestashop>
  <order>
    <id><![CDATA[${pedido.id}]]></id>
    <id_address_delivery><![CDATA[${pedido.id_address_delivery}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${pedido.id_address_invoice}]]></id_address_invoice>
    <id_cart><![CDATA[${pedido.id_cart}]]></id_cart>
    <id_currency><![CDATA[${pedido.id_currency}]]></id_currency>
    <id_lang><![CDATA[${pedido.id_lang}]]></id_lang>
    <id_customer><![CDATA[${pedido.id_customer}]]></id_customer>
    <id_carrier><![CDATA[${pedido.id_carrier}]]></id_carrier>
    <current_state><![CDATA[${nuevoEstado}]]></current_state>
    <module><![CDATA[${pedido.module}]]></module>
    <invoice_number><![CDATA[${pedido.invoice_number}]]></invoice_number>
    <invoice_date><![CDATA[${pedido.invoice_date}]]></invoice_date>
    <delivery_number><![CDATA[${pedido.delivery_number}]]></delivery_number>
    <delivery_date><![CDATA[${pedido.delivery_date}]]></delivery_date>
    <valid><![CDATA[${pedido.valid}]]></valid>
    <date_add><![CDATA[${pedido.date_add}]]></date_add>
    <date_upd><![CDATA[${pedido.date_upd}]]></date_upd>
    <id_shop_group><![CDATA[${pedido.id_shop_group}]]></id_shop_group>
    <id_shop><![CDATA[${pedido.id_shop}]]></id_shop>
    <secure_key><![CDATA[${pedido.secure_key}]]></secure_key>
    <payment><![CDATA[${pedido.payment}]]></payment>
    <recyclable><![CDATA[${reciclable}]]></recyclable>
    <gift><![CDATA[${gift}]]></gift>
    <gift_message><![CDATA[${pedido.gift_message}]]></gift_message>
    <total_discounts><![CDATA[${pedido.total_discounts}]]></total_discounts>
    <total_discounts_tax_incl><![CDATA[${pedido.total_discounts_tax_incl}]]></total_discounts_tax_incl>
    <total_discounts_tax_excl><![CDATA[${pedido.total_discounts_tax_excl}]]></total_discounts_tax_excl>
    <total_paid><![CDATA[${pedido.total_paid}]]></total_paid>
    <total_paid_tax_incl><![CDATA[${pedido.total_paid_tax_incl}]]></total_paid_tax_incl>
    <total_paid_tax_excl><![CDATA[${pedido.total_paid_tax_excl}]]></total_paid_tax_excl>
    <total_paid_real><![CDATA[${pedido.total_paid_real}]]></total_paid_real>
    <total_products><![CDATA[${pedido.total_products}]]></total_products>
    <total_products_wt><![CDATA[${pedido.total_products_wt}]]></total_products_wt>
    <total_shipping><![CDATA[${pedido.total_shipping}]]></total_shipping>
    <total_shipping_tax_incl><![CDATA[${pedido.total_shipping_tax_incl}]]></total_shipping_tax_incl>
    <total_shipping_tax_excl><![CDATA[${pedido.total_shipping_tax_excl}]]></total_shipping_tax_excl>
    <carrier_tax_rate><![CDATA[${pedido.carrier_tax_rate}]]></carrier_tax_rate>
    <total_wrapping><![CDATA[${pedido.total_wrapping}]]></total_wrapping>
    <total_wrapping_tax_incl><![CDATA[${pedido.total_wrapping_tax_incl}]]></total_wrapping_tax_incl>
    <total_wrapping_tax_excl><![CDATA[${pedido.total_wrapping_tax_excl}]]></total_wrapping_tax_excl>
    <round_mode><![CDATA[${pedido.round_mode}]]></round_mode>
    <round_type><![CDATA[${pedido.round_type}]]></round_type>
    <conversion_rate><![CDATA[${pedido.conversion_rate}]]></conversion_rate>
    <reference><![CDATA[${pedido.reference}]]></reference>
  </order>
</prestashop>
`;

    const url = `${API_URL}/orders/${pedidoId}?ws_key=${WS_KEY}&output_format=JSON`;
    cordova.plugin.http.setDataSerializer("utf8");

    cordova.plugin.http.sendRequest(
      url,
      {
        method: "put",
        data: xmlData,
        headers: {
          "Content-Type": "application/xml",
          "Accept": "application/json"
        }
      },
      function(response) {
        alert("Pedido #" + pedidoId + " actualizado a estado Entregado");
        cargarPedidos();
      },
      function(error) {
        alert("Error al cerrar pedido:\n" + "Por favor intentelo de nuevo");
      }
    );
  });
}
