
// -----------MANEJADORES DE EVENTOS----------------
document.addEventListener("deviceready", function() {
  // Detectar y pedir permiso de notificaciones (sin romper si no existe el plugin)
  try {
    if (cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
      cordova.plugins.notification.local.requestPermission(function(granted) {
        notificacionesDisponibles = !!granted;
        console.log("Permiso notificaciones:", granted);
      });
    } else {
      notificacionesDisponibles = false;
      console.log("Plugin de notificaciones no disponible.");
    }
  } catch(e) {
    notificacionesDisponibles = false;
    console.log("Error inicializando notificaciones:", e);
  }

  $(document).ready(function() {
    cargarPedidos();
    $("#btn-refresh").on("click", function() { cargarPedidos(); });
  });

  $(document).on("pageshow", "#pedidos", function() { cargarPedidos(); });

  // Chequeo automático cada 1 minuto
  setInterval(cargarPedidos, 60 * 1000);
}, false);
