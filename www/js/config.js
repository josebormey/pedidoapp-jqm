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

// Detectar entorno
const ES_CORDOVA = !!window.cordova;

// Variables globales
let pedidosCache = [];
let notificacionesDisponibles = false;
let pedidosListos = false;
let pedidosListosFlag = false;

// Firma digital
let firmaCanvas, ctx, dibujando = false;
let pedidoEnFirma = null;
let firmaDataURL = null;
const firmaObligatoria = true;

// Datos simulados para navegador
const PEDIDOS_FAKE = [
  {
    id: 1,
    estado: "En espera de validacion por contra reembolso",
    cliente: "Juan Pérez",
    telefono: "555-1234",
    direccion: "Calle 1, Habana",
    total: 150.00,
    productos: [
      { product_name: "Producto A", product_quantity: 2, unit_price_tax_incl: 50 }
    ]
  },
  {
    id: 2,
    estado: "En espera de validacion por contra reembolso",
    cliente: "Ana Gómez",
    telefono: "555-5678",
    direccion: "Calle 2, Habana",
    total: 250.00,
    productos: [
      { product_name: "Producto B", product_quantity: 1, unit_price_tax_incl: 250 }
    ]
  }
];
