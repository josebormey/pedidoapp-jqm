

const API_URL = "https://www.ferroclimaexpress.com/api";
const WS_KEY = "B4KYF7LZ714FYZ5KADYM6TZCCKCVS4Q7";
const CARRIER_ID = 6;

const ESTADOS_PEDIDO = {
  1: "En espera de pago por cheque",
  2: "Pago aceptado",
  3: "Preparacion en curso",
  4: "Enviado",
  5: "Entregado",
  6: "Cancelado",
  7: "Reembolsado",
  8: "Error en pago",
  9: "Pedido pendiente por falta de stock (pagado)",
  10: "En espera de pago por transferencia bancaria",
  11: "Pago remoto aceptado",
  12: "Pedido pendiente por falta de stock (no pagado)",
  13: "En espera de validacion por contra reembolso"
};

function claseEstado(estado) {
  switch(estado) {
    case "Preparacion en curso": return "estado-preparacion";
    case "Enviado": return "estado-enviado";
    case "Entregado": return "estado-entregado";
    case "Cancelado": return "estado-cancelado";
    default: return "";
  }
}

let pedidosCache = [];
let notificacionesDisponibles = false;
let pedidosListos = false;

// Firma digital (estado)
let firmaCanvas, ctx, dibujando = false;
let pedidoEnFirma = null;      // id del pedido que se está firmando
let firmaDataURL = null;       // imagen base64 de la firma
const firmaObligatoria = true; // cambia a false si quieres cerrar sin firma
