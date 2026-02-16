webhook.js
import mercadopago from 'mercadopago';
import { Resend } from 'resend';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;

    if (type === 'payment') {
      const paymentId = data.id;
      const payment = await mercadopago.payment.findById(paymentId);
      const paymentData = payment.body;

      if (paymentData.status === 'approved') {
        const metadata = paymentData.metadata || {};
        
        // Email para vos (vendedor)
        await resend.emails.send({
          from: 'ANCESTRA Store <onboarding@resend.dev>',
          to: 'harriesmalu@gmail.com',
          subject: `🎉 Nueva compra - ${paymentData.external_reference}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">🎉 Nueva compra realizada</h2>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📦 Datos del comprador:</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>Nombre:</strong> ${metadata.customer_name || paymentData.payer.first_name + ' ' + paymentData.payer.last_name}</li>
                  <li><strong>Email:</strong> ${paymentData.payer.email}</li>
                  <li><strong>Teléfono:</strong> ${metadata.customer_phone || paymentData.payer.phone?.number || 'No proporcionado'}</li>
                  <li><strong>DNI:</strong> ${paymentData.payer.identification?.number || 'No proporcionado'}</li>
                </ul>
              </div>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">🚚 Datos de envío:</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>Dirección:</strong> ${metadata.customer_address || 'Ver en MercadoPago'}</li>
                  <li><strong>Piso/Depto:</strong> ${metadata.customer_apt || '-'}</li>
                  <li><strong>Ciudad:</strong> ${metadata.customer_city || '-'}</li>
                  <li><strong>Provincia:</strong> ${metadata.customer_province || '-'}</li>
                  <li><strong>Código postal:</strong> ${paymentData.payer.address?.zip_code || 'No proporcionado'}</li>
                  ${metadata.customer_notes ? `<li><strong>Notas:</strong> ${metadata.customer_notes}</li>` : ''}
                </ul>
              </div>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">💰 Detalles de la compra:</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>ID de pago:</strong> ${paymentId}</li>
                  <li><strong>Número de pedido:</strong> ${paymentData.external_reference}</li>
                  <li><strong>Monto:</strong> $${paymentData.transaction_amount.toLocaleString('es-AR')}</li>
                  <li><strong>Estado:</strong> ✅ Aprobado</li>
                  <li><strong>Fecha:</strong> ${new Date(paymentData.date_approved).toLocaleString('es-AR')}</li>
                </ul>
              </div>

              <p style="margin-top: 30px;">
                <strong>Ver detalles completos en:</strong><br>
                <a href="https://www.mercadopago.com.ar/activities" style="color: #0066ff;">MercadoPago Dashboard</a>
              </p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <p style="color: #666; font-size: 14px;">
                Este email es automático. Los datos fueron capturados al momento del pago.
              </p>
            </div>
          `
        });

        // Email para el cliente
        await resend.emails.send({
          from: 'ANCESTRA PARFUM <onboarding@resend.dev>',
          to: paymentData.payer.email,
          subject: '✅ Confirmación de compra - ANCESTRA PARFUM',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">✅ ¡Gracias por tu compra!</h2>
              
              <p>Hola <strong>${paymentData.payer.first_name}</strong>,</p>
              
              <p>Tu compra ha sido confirmada exitosamente. En breve nos contactaremos por WhatsApp para coordinar la entrega.</p>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Detalles de tu pedido:</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>Número de pedido:</strong> ${paymentData.external_reference}</li>
                  <li><strong>Monto pagado:</strong> $${paymentData.transaction_amount.toLocaleString('es-AR')}</li>
                  <li><strong>Fecha:</strong> ${new Date(paymentData.date_approved).toLocaleString('es-AR')}</li>
                </ul>
              </div>

              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0;"><strong>📍 Zona de entrega:</strong> CABA y GBA</p>
              </div>

              <p>Cualquier consulta, no dudes en contactarnos:</p>
              <ul style="line-height: 1.8;">
                <li>📧 Email: <a href="mailto:harriesmalu@gmail.com">harriesmalu@gmail.com</a></li>
                <li>📱 Instagram: <a href="https://instagram.com/ancestra.parfum">@ancestra.parfum</a></li>
              </ul>

              <p style="margin-top: 30px;">Saludos,<br><strong>ANCESTRA PARFUM</strong></p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <p style="color: #666; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} ANCESTRA PARFUM - Fragancias de autor
              </p>
            </div>
          `
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}


