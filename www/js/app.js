// ----------- INICIALIZACIÓN CROSS-PLATFORM -----------
// Detecta si estamos en Cordova o navegador y arranca la app
(function initApp() {
  if (window.cordova) {
    document.addEventListener("deviceready", onDeviceReady, false);
  } else {
    console.log("Modo navegador: inicializando sin Cordova");
    onDeviceReady(); // reutilizamos la misma función
  }
})();

function onDeviceReady() {
  // Notificaciones (solo si el plugin existe en Cordova)
  try {
      if (ES_CORDOVA && cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
         cordova.plugins.notification.local.requestPermission(function(granted) {
         notificacionesDisponibles = !!granted;
         console.log("Permiso notificaciones:", granted);
    });
     } else {
    notificacionesDisponibles = false;
    console.log("Plugin de notificaciones no disponible (o navegador).");
     }
    } catch(e) {
        notificacionesDisponibles = false;
        console.log("Error inicializando notificaciones:", e);
      }


  // jQuery Mobile listo
  $(function() {
    // Primera carga de pedidos
    cargarPedidos();

    // Botón refrescar
    $("#btn-refresh").on("click", function() { cargarPedidos(); });

    // Refrescar al mostrar la página (evita duplicar si ya cargó)
    $(document).on("pageshow", "#pedidos", function() {
      if (!pedidosListosFlag) cargarPedidos();
    });
  });

  // Chequeo automático cada 1 minuto (pausa si la página está oculta)
  let intervalId = setInterval(() => {
    if (!document.hidden) cargarPedidos();
  }, 60 * 1000);

  // Limpieza si cierras la pestaña
  window.addEventListener("beforeunload", function() {
    clearInterval(intervalId);
  });

  // Si vuelves a la pestaña, refresca una vez
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) cargarPedidos();
  });
}
