// ============================================
// WHATSAPP BOT - INTEGRACIÓN COMPLETA
// ============================================

const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const app = express();

app.use(express.json());

// ============================================
// BASE DE DATOS (igual que el chatbot web)
// ============================================
const products = [
    { id: 1, name: "iPhone 15 Pro", price: 24999, category: "smartphones", stock: 15, rating: 4.8 },
    { id: 2, name: "Samsung Galaxy S24", price: 22999, category: "smartphones", stock: 23, rating: 4.7 },
    { id: 3, name: "MacBook Air M2", price: 28999, category: "laptops", stock: 8, rating: 4.9 },
    { id: 4, name: "Dell XPS 13", price: 25999, category: "laptops", stock: 12, rating: 4.6 },
    { id: 5, name: "AirPods Pro", price: 5999, category: "audio", stock: 45, rating: 4.8 },
    { id: 6, name: "Sony WH-1000XM5", price: 7999, category: "audio", stock: 18, rating: 4.9 },
    { id: 7, name: "iPad Pro 12.9", price: 26999, category: "tablets", stock: 10, rating: 4.8 },
    { id: 8, name: "Apple Watch Series 9", price: 8999, category: "wearables", stock: 25, rating: 4.7 },
    { id: 9, name: "PlayStation 5", price: 12999, category: "gaming", stock: 3, rating: 4.9 },
    { id: 10, name: "Nintendo Switch OLED", price: 7999, category: "gaming", stock: 20, rating: 4.8 }
];

const orders = [
    { id: "ORD-001", status: "delivered", total: 24999, items: 1, date: "2024-09-01" },
    { id: "ORD-002", status: "shipped", total: 5999, items: 2, date: "2024-09-05" },
    { id: "ORD-003", status: "processing", total: 12999, items: 1, date: "2024-09-06" }
];

// ============================================
// SISTEMA DE KEYWORD MATCHING (igual que web)
// ============================================
const keywordCategories = {
    search_products: {
        keywords: ['busco', 'buscar', 'quiero', 'necesito', 'donde esta', 'tienen', 'hay', 'producto', 'articulo'],
        context: ['iphone', 'samsung', 'laptop', 'macbook', 'dell', 'airpods', 'sony', 'ipad', 'watch', 'playstation', 'nintendo', 'audifonos', 'telefono', 'computadora', 'tablet']
    },
    prices_offers: {
        keywords: ['precio', 'cuesta', 'vale', 'caro', 'barato', 'oferta', 'descuento', 'promocion', 'especial', 'rebaja', 'cuanto'],
        context: []
    },
    track_order: {
        keywords: ['pedido', 'orden', 'compra', 'rastrear', 'seguimiento', 'donde esta', 'cuando llega', 'status', 'estado'],
        context: ['ord', 'pedido', 'numero', 'codigo']
    },
    shipping: {
        keywords: ['envio', 'entrega', 'delivery', 'enviar', 'llega', 'cuando', 'tiempo', 'dias', 'gratis', 'costo'],
        context: []
    },
    returns: {
        keywords: ['devolucion', 'regresar', 'cambio', 'reembolso', 'garantia', 'defectuoso', 'malo', 'no funciona'],
        context: []
    },
    payments: {
        keywords: ['pago', 'pagar', 'tarjeta', 'efectivo', 'transferencia', 'paypal', 'credito', 'debito', 'como pago'],
        context: []
    },
    support: {
        keywords: ['ayuda', 'soporte', 'problema', 'error', 'no puedo', 'agente', 'humano', 'persona'],
        context: []
    },
    info: {
        keywords: ['horarios', 'direccion', 'telefono', 'contacto', 'ubicacion', 'sucursal', 'tienda'],
        context: []
    }
};

function analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    let bestCategory = null;
    let maxScore = 0;
    let detectedProducts = [];
    
    // Analizar por categorías
    Object.entries(keywordCategories).forEach(([category, data]) => {
        let score = 0;
        
        data.keywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                score += 2;
            }
        });
        
        data.context.forEach(context => {
            if (lowerMessage.includes(context)) {
                score += 1;
            }
        });
        
        if (score > maxScore) {
            maxScore = score;
            bestCategory = category;
        }
    });
    
    // Detectar productos mencionados
    products.forEach(product => {
        const productWords = product.name.toLowerCase().split(' ');
        const productMatches = productWords.filter(word => lowerMessage.includes(word)).length;
        
        if (productMatches >= 1 || lowerMessage.includes(product.category)) {
            detectedProducts.push(product);
        }
    });
    
    return {
        category: bestCategory || 'general',
        score: maxScore,
        products: detectedProducts,
        originalMessage: message
    };
}

// ============================================
// GENERADOR DE RESPUESTAS PARA WHATSAPP
// ============================================
function generateProductListWA(products) {
    let response = "";
    products.slice(0, 3).forEach((product, index) => {
        const stockStatus = product.stock > 10 ? 'En stock ✅' : product.stock > 0 ? `Solo ${product.stock} disponibles ⚠️` : 'Agotado ❌';
        
        response += `${index + 1}. *${product.name}*\n`;
        response += `   💰 $${product.price.toLocaleString('es-MX')}\n`;
        response += `   📦 ${stockStatus}\n`;
        response += `   ⭐ ${product.rating}/5\n\n`;
    });
    return response;
}

function generateOrderInfoWA(order) {
    const statusText = {
        'processing': 'En Proceso 🔄',
        'shipped': 'Enviado 📦',
        'delivered': 'Entregado ✅'
    };
    
    return `📋 *Pedido: ${order.id}*\n` +
           `📊 Estado: ${statusText[order.status]}\n` +
           `💰 Total: $${order.total.toLocaleString('es-MX')}\n` +
           `📦 Artículos: ${order.items}\n` +
           `📅 Fecha: ${order.date}\n`;
}

function getBotResponseWA(userMessage) {
    const analysis = analyzeMessage(userMessage);
    
    switch(analysis.category) {
        case 'search_products':
            if (analysis.products.length > 0) {
                let response = `🔍 *Encontré estos productos para ti:*\n\n`;
                response += generateProductListWA(analysis.products);
                response += `¿Te interesa alguno? Puedo darte más detalles! 😊`;
                return response;
            } else {
                return `🔍 *¿Qué producto estás buscando?*\n\n` +
                       `Tenemos disponible:\n` +
                       `📱 Smartphones (iPhone, Samsung)\n` +
                       `💻 Laptops y computadoras\n` +
                       `🎧 Audio y accesorios\n` +
                       `📱 Tablets\n` +
                       `⌚ Wearables\n` +
                       `🎮 Gaming\n\n` +
                       `Escribe el nombre del producto que buscas 👆`;
            }
        
        case 'prices_offers':
            return `💰 *¡OFERTAS ESPECIALES HOY!* 🔥\n\n` +
                   `📱 iPhone 15 Pro - $24,999 _(antes $27,999)_\n` +
                   `💻 MacBook Air M2 - $28,999 _(12 MSI sin intereses)_\n` +
                   `🎧 AirPods Pro - $5,999 _(envío gratis)_\n` +
                   `🎮 PlayStation 5 - $12,999 _(últimas 3 piezas)_\n\n` +
                   `✨ *Envío GRATIS* en compras +$500\n` +
                   `🎁 *12 meses sin intereses* disponible\n\n` +
                   `¿Qué producto te interesa? 😊`;
        
        case 'track_order':
            const randomOrder = orders[Math.floor(Math.random() * orders.length)];
            return `📦 *RASTREO DE PEDIDOS*\n\n` +
                   `Para rastrear tu pedido necesito el número de orden.\n\n` +
                   `📋 *Ejemplo de pedido reciente:*\n` +
                   generateOrderInfoWA(randomOrder) +
                   `\n💡 Puedes encontrar tu número de pedido en:\n` +
                   `• Email de confirmación 📧\n` +
                   `• Tu cuenta en línea 🔐\n` +
                   `• SMS de confirmación 📱\n\n` +
                   `Envíame tu número de pedido para ayudarte 😊`;
        
        case 'shipping':
            return `🚚 *INFORMACIÓN DE ENVÍOS*\n\n` +
                   `✅ *ENVÍO GRATIS* en compras +$500\n` +
                   `⏰ Tiempo: *2-5 días hábiles*\n` +
                   `📍 Cobertura: *Todo México*\n` +
                   `🏃‍♂️ Express: *24-48 hrs (+$150)*\n\n` +
                   `📋 *OPCIONES DE ENTREGA:*\n` +
                   `🏠 A domicilio\n` +
                   `📦 Punto de recolección\n` +
                   `🏪 Sucursal más cercana\n\n` +
                   `💡 *Tip:* Pedidos antes de las 2 PM se procesan el mismo día`;
        
        case 'returns':
            return `↩️ *POLÍTICA DE DEVOLUCIONES*\n\n` +
                   `✅ *30 días* para devoluciones\n` +
                   `✅ Producto en *condición original*\n` +
                   `✅ Con *empaque y accesorios*\n` +
                   `✅ *Reembolso completo* o cambio\n\n` +
                   `📋 *PROCESO SIMPLE:*\n` +
                   `1️⃣ Solicita devolución en línea\n` +
                   `2️⃣ Imprime etiqueta prepagada\n` +
                   `3️⃣ Empaca el producto\n` +
                   `4️⃣ Entrega al mensajero\n` +
                   `5️⃣ Reembolso en 3-5 días\n\n` +
                   `🔧 *GARANTÍA:* 12 meses defectos de fábrica`;
        
        case 'payments':
            return `💳 *MÉTODOS DE PAGO*\n\n` +
                   `💳 *TARJETAS:*\n` +
                   `• Visa, MasterCard, Amex\n` +
                   `• Débito y crédito\n` +
                   `• 12 MSI sin intereses*\n\n` +
                   `💰 *OTROS MÉTODOS:*\n` +
                   `• PayPal\n` +
                   `• Transferencia bancaria\n` +
                   `• OXXO Pay\n` +
                   `• Mercado Pago\n` +
                   `• Contra entrega (+$50)\n\n` +
                   `🛡️ *100% seguro* - Encriptación SSL\n` +
                   `*MSI disponible en compras +$3,000`;
        
        case 'support':
            return `🆘 *SOPORTE AL CLIENTE*\n\n` +
                   `👨‍💻 ¿Necesitas ayuda personalizada?\n\n` +
                   `📞 *CONTACTO:*\n` +
                   `• Teléfono: (656) 123-4567\n` +
                   `• WhatsApp: (656) 987-6543\n` +
                   `• Email: soporte@shopbot.mx\n\n` +
                   `⏰ *HORARIOS:*\n` +
                   `• Lun-Vie: 9 AM - 6 PM\n` +
                   `• Sáb-Dom: 10 AM - 4 PM\n\n` +
                   `Mientras tanto, puedo ayudarte con consultas básicas 😊`;
        
        case 'info':
            return `📍 *INFORMACIÓN DE LA TIENDA*\n\n` +
                   `🏢 *DIRECCIÓN:*\n` +
                   `Av. Tecnológico #1234\n` +
                   `Col. Centro, Juárez, Chih.\n` +
                   `CP 32000\n\n` +
                   `⏰ *HORARIOS:*\n` +
                   `• Lun-Vie: 9 AM - 8 PM\n` +
                   `• Sábados: 10 AM - 6 PM\n` +
                   `• Domingos: 11 AM - 5 PM\n\n` +
                   `📞 *CONTACTO:*\n` +
                   `• Ventas: (656) 123-4567\n` +
                   `• Soporte: (656) 987-6543\n\n` +
                   `🚗 Estacionamiento gratuito`;
        
        default:
            return getContextualResponseWA(analysis.originalMessage);
    }
}

function getContextualResponseWA(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenos') || lowerMessage.includes('buenas')) {
        return `¡Hola! 👋 *Bienvenido a ShopBot*\n\n` +
               `Soy tu asistente personal de compras 🛍️\n\n` +
               `*Puedo ayudarte con:*\n` +
               `🔍 Buscar productos\n` +
               `💰 Consultar precios y ofertas\n` +
               `📦 Rastrear pedidos\n` +
               `🚚 Información de envíos\n` +
               `💳 Métodos de pago\n\n` +
               `¿En qué puedo ayudarte hoy? 😊`;
    }
    
    if (lowerMessage.includes('gracias') || lowerMessage.includes('thanks')) {
        return `¡De nada! 😊 Fue un placer ayudarte.\n\n` +
               `¿Hay algo más en lo que pueda asistirte?\n\n` +
               `Recuerda que estoy disponible *24/7* para resolver tus dudas 🌟`;
    }
    
    if (lowerMessage.includes('adios') || lowerMessage.includes('bye') || lowerMessage.includes('hasta')) {
        return `¡Hasta pronto! 👋 *Gracias por elegir nuestra tienda*\n\n` +
               `💡 *Recuerda:*\n` +
               `• Envío gratis en compras +$500\n` +
               `• 30 días para devoluciones\n` +
               `• Soporte 24/7 disponible\n\n` +
               `¡Que tengas un excelente día! 🌟`;
    }
    
    return `🤔 Entiendo que necesitas ayuda, pero necesito más detalles.\n\n` +
           `💡 *EJEMPLOS DE LO QUE PUEDO HACER:*\n\n` +
           `🔍 *Productos:* "busco un iPhone"\n` +
           `💰 *Precios:* "cuánto cuesta" o "ofertas"\n` +
           `📦 *Pedidos:* "rastrear pedido ORD-123"\n` +
           `🚚 *Envíos:* "cuándo llega mi pedido"\n` +
           `💳 *Pagos:* "formas de pago"\n` +
           `↩️ *Devoluciones:* "quiero devolver"\n\n` +
           `¿Podrías ser más específico? 😊`;
}

// ============================================
// CONFIGURACIÓN DEL CLIENTE WHATSAPP
// ============================================
const client = new Client({
    authStrategy: new LocalAuth({
        name: "shopbot-session"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// ============================================
// EVENTOS DEL CLIENTE
// ============================================
client.on('qr', (qr) => {
    console.log('\n🔲 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:');
    qrcode.generate(qr, {small: true});
    console.log('\n📱 1. Abre WhatsApp en tu teléfono');
    console.log('📱 2. Ve a Configuración > Dispositivos vinculados');
    console.log('📱 3. Toca "Vincular dispositivo"');
    console.log('📱 4. Escanea el código QR de arriba\n');
});

client.on('ready', () => {
    console.log('🚀 ¡ShopBot está listo y conectado a WhatsApp!');
    console.log('📞 Número conectado:', client.info.wid.user);
    console.log('✅ Bot funcionando correctamente\n');
});

client.on('authenticated', () => {
    console.log('✅ Autenticación exitosa con WhatsApp');
});

client.on('auth_failure', msg => {
    console.error('❌ Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Cliente desconectado:', reason);
});

// ============================================
// MANEJO DE MENSAJES
// ============================================
client.on('message_create', async (msg) => {
    // Solo responder a mensajes entrantes (no enviados por el bot)
    if (msg.fromMe) return;
    
    // Solo responder a mensajes de texto
    if (msg.type !== 'chat') return;
    
    const contact = await msg.getContact();
    const chat = await msg.getChat();
    
    console.log(`📱 Mensaje de ${contact.name || contact.number}: ${msg.body}`);
    
    try {
        // Simular "escribiendo..."
        await chat.sendStateTyping();
        
        // Generar respuesta
        const response = getBotResponseWA(msg.body);
        
        // Enviar respuesta después de un breve delay
        setTimeout(async () => {
            await msg.reply(response);
            console.log(`🤖 Respuesta enviada a ${contact.name || contact.number}`);
        }, 1000 + Math.random() * 2000);
        
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        await msg.reply('😅 Disculpa, tuve un problema técnico. Por favor intenta de nuevo.');
    }
});

// ============================================
// INICIALIZAR EL BOT
// ============================================
client.initialize();

// ============================================
// SERVIDOR WEB OPCIONAL (para monitoreo)
// ============================================
app.get('/', (req, res) => {
    res.json({
        status: 'ShopBot WhatsApp Running',
        timestamp: new Date().toISOString(),
        connected: client.info ? true : false
    });
});

app.get('/stats', (req, res) => {
    res.json({
        products: products.length,
        orders: orders.length,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web ejecutándose en puerto ${PORT}`);
    console.log(`📊 Estadísticas disponibles en http://localhost:${PORT}/stats`);
});

// ============================================
// MANEJO DE ERRORES
// ============================================
process.on('unhandledRejection', (err) => {
    console.error('❌ Error no manejado:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Excepción no capturada:', err);
    process.exit(1);
});