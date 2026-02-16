import { qs, setCartBadge } from './ui.js';
import { listItems, totals, clearCart } from './cartBrowser.js';

console.log('✅ checkoutPage.js cargado');

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
  console.error('❌ Error:', message);
}

function init() {
  console.log('🔧 Iniciando checkout...');
  
  setCartBadge(totals().items_count);
  
  // Verificar que hay productos
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

  console.log('📦 Productos en carrito:', totals().items_count);

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

  // Mostrar resumen de productos
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

  console.log('💰 Total:', formatter.format(totals().subtotal_ars));

  // Manejar submit del formulario
  const form = document.getElementById('payForm');
  if (!form) {
    console.error('❌ Formulario #payForm no encontrado');
    return;
  }

  console.log('✅ Formulario encontrado, agregando listener');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('🚀 Submit del formulario capturado');
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn ? submitBtn.textContent : 'Continuar al pago';
    
    // Deshabilitar botón
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando...';
      console.log('⏳ Botón deshabilitado');
    }
    
    try {
      // Obtener datos del formulario
      const formData = new FormData(form);
      const cart = listItems();
      
      // Preparar datos para MercadoPago
      const paymentData = {
        items: cart.map(item => ({
          title: `${item.name} ${item.volume_ml}ml`,
          quantity: item.qty,
          unit_price: item.price_ars
        })),
        payer: {
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          dni: formData.get('dni'),
          address: formData.get('address'),
          apt: formData.get('apt') || '',
          zip: formData.get('zip'),
          city: formData.get('city'),
          province: formData.get('province'),
          notes: formData.get('notes') || ''
        }
      };

      console.log('📤 Enviando datos a MercadoPago:', paymentData);

      // Llamar a nuestra API
      const response = await fetch('/api/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      console.log('📥 Respuesta recibida. Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error del servidor:', errorText);
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.log('✅ Respuesta de MercadoPago:', data);

      if (!data.init_point) {
        console.error('❌ No se recibió init_point:', data);
        throw new Error('No se recibió URL de pago de MercadoPago');
      }

      console.log('🔗 URL de pago:', data.init_point);
      console.log('🎉 Redirigiendo a MercadoPago...');

      // Redirigir a MercadoPago
      window.location.href = data.init_point;
      
    } catch (error) {
      console.error('💥 Error capturado:', error);
      
      // Mostrar error detallado
      const errorMsg = error.message || 'Error desconocido al procesar el pago';
      showError(errorMsg);
      
      alert(`Error al procesar el pago:\n\n${errorMsg}\n\nPor favor, verifica:\n1. Que tengas internet\n2. Que MercadoPago esté configurado en Vercel\n3. O contactanos por WhatsApp`);
      
      // Rehabilitar botón
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        console.log('🔄 Botón rehabilitado');
      }
    }
  });

  console.log('✅ Listener agregado exitosamente');
}

// Inicializar cuando cargue la página
if (document.readyState === 'loading') {
  console.log('⏳ DOM cargando... esperando DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado completamente');
    init();
  });
} else {
  console.log('✅ DOM ya cargado, ejecutando init()');
  init();
}

console.log('📄 Fin del archivo checkoutPage.js');
