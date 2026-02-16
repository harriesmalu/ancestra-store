import { qs, setCartBadge } from './ui.js';
import { listItems, totals, clearCart } from './cartBrowser.js';

console.log('✅ checkoutPage.js cargado - Versión EmailJS');

// CONFIGURACIÓN EMAILJS (Gratis, sin backend)
// 1. Crear cuenta en: https://www.emailjs.com/
// 2. Crear un servicio (Gmail)
// 3. Crear un template
// 4. Copiar estas 3 claves aquí:
const EMAILJS_SERVICE_ID = 'service_mna6zji';
const EMAILJS_TEMPLATE_ID = 'template_6ihlsb9';
const EMAILJS_PUBLIC_KEY = 'RdNudoAPrZtX3Ri9P';


function showMessage(message, isError = false) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.color = isError ? '#ff4444' : '#44ff44';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

function init() {
  console.log('🔧 Iniciando checkout...');
  
  // Inicializar EmailJS con la clave pública
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log('✅ EmailJS inicializado');
  }
  
  setCartBadge(totals().items_count);
  
  if (totals().items_count === 0) {
    const root = document.getElementById('checkoutRoot');
    if (root) {
      root.innerHTML = `
        <div class="empty">
          No hay productos en el carrito. 
          <div style="margin-top:12px">
            <a class="btn" href="index.html">Volver al catálogo</a>
          </div>
        </div>`;
    }
    const summary = document.getElementById('summaryMini');
    if (summary) summary.innerHTML = '';
    return;
  }

  // Mostrar total
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  });
  
  const totalMiniEl = document.getElementById('totalMini');
  if (totalMiniEl) {
    totalMiniEl.textContent = formatter.format(totals().subtotal_ars);
  }

  // Mostrar resumen
  const cart = listItems();
  const summaryContent = document.getElementById('summaryContent');
  if (summaryContent) {
    summaryContent.innerHTML = cart.map(item => `
      <div class="sumLine">
        <span>${item.qty}x ${item.name} ${item.volume_ml}ml</span>
        <span>${formatter.format(item.price_ars * item.qty)}</span>
      </div>
    `).join('');
  }

  // Manejar formulario
  const form = document.getElementById('payForm');
  if (!form) {
    console.error('❌ Formulario no encontrado');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📨 Procesando pedido...');
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    
    try {
      const formData = new FormData(form);
      const cart = listItems();
      
      // Preparar datos del pedido
      const cartHTML = cart.map(item => 
        `<tr>
          <td>${item.qty}</td>
          <td>${item.name} ${item.volume_ml}ml</td>
          <td>$${item.price_ars.toLocaleString('es-AR')}</td>
          <td>$${(item.price_ars * item.qty).toLocaleString('es-AR')}</td>
        </tr>`
      ).join('');

      const emailParams = {
        to_email: 'harriesmalu@gmail.com',
        from_name: formData.get('name'),
        from_email: formData.get('email'),
        phone: formData.get('phone'),
        dni: formData.get('dni'),
        address: formData.get('address'),
        apt: formData.get('apt') || '-',
        zip: formData.get('zip'),
        city: formData.get('city'),
        province: formData.get('province'),
        notes: formData.get('notes') || '-',
        cart_items: cartHTML,
        total: formatter.format(totals().subtotal_ars),
        order_number: `ANCESTRA-${Date.now()}`,
        date: new Date().toLocaleString('es-AR')
      };

      console.log('📧 Enviando email con EmailJS...');

      // Verificar si EmailJS está configurado
      if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS no está cargado. Verificá la configuración.');
      }

      if (EMAILJS_SERVICE_ID === 'service_xxxxxxx') {
        // EmailJS no configurado - usar WhatsApp como fallback
        console.warn('⚠️ EmailJS no configurado, usando WhatsApp...');
        throw new Error('EmailJS no configurado');
      }

      // Enviar email usando el método send (con init ya llamado)
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams
      );

      if (response.status === 200) {
        console.log('✅ Email enviado exitosamente');
        showMessage('¡Pedido enviado! Te contactaremos pronto.', false);
        
        // Guardar orden para success page
        localStorage.setItem('ancestra_last_order', JSON.stringify({
          customer: {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone')
          },
          items: cart,
          totals: totals(),
          orderNumber: emailParams.order_number,
          date: new Date().toISOString()
        }));
        
        // Limpiar carrito
        clearCart();
        
        // Redirigir
        setTimeout(() => {
          window.location.href = 'success.html';
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      
      // FALLBACK: WhatsApp
      const cart = listItems();
      const formData = new FormData(form);
      
      const cartText = cart.map(item => 
        `- ${item.qty}x ${item.name} ${item.volume_ml}ml ($${(item.price_ars * item.qty).toLocaleString('es-AR')})`
      ).join('%0A');
      
      const message = encodeURIComponent(
        `🛍️ NUEVO PEDIDO\n\n` +
        `Productos:\n${cart.map(i => `- ${i.qty}x ${i.name} ${i.volume_ml}ml`).join('\n')}\n\n` +
        `Total: $${totals().subtotal_ars.toLocaleString('es-AR')}\n\n` +
        `Mis datos:\n` +
        `👤 ${formData.get('name')}\n` +
        `📧 ${formData.get('email')}\n` +
        `📱 ${formData.get('phone')}\n` +
        `🏠 ${formData.get('address')}, ${formData.get('city')}\n` +
        `📮 CP: ${formData.get('zip')}`
      );
      
      // IMPORTANTE: Reemplazar con tu número de WhatsApp
      const whatsappNumber = '5491165678354';  // Formato: 549 + código de área + número
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
      
      showMessage('Para confirmar tu pedido y completar tu pago te redirigimos a WhatsApp', true);
      
      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }, 2000);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
