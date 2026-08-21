(function() {
  'use strict';

  var API_BASE = 'https://aporaksha.com';

  function checkHealth() {
    return fetch(API_BASE + '/api/razorpay-config', { method: 'GET', mode: 'cors' })
      .then(function(res) {
        if (!res.ok) throw new Error('Aporaksha unavailable');
        return res.json();
      })
      .then(function(data) {
        return { available: !!data.keyId, keyId: data.keyId };
      })
      .catch(function() {
        return { available: false, keyId: null };
      });
  }

  function createOrder(productId, token, options) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var body = {
      product_id: productId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language
    };
    if (options && options.notes) body.notes = options.notes;

    return fetch(API_BASE + '/api/payments/create-order', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || 'Failed to create order');
        return data;
      });
    });
  }

  function verifyPayment(paymentData, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(API_BASE + '/api/payments/verify', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(paymentData)
    }).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || 'Payment verification failed');
        return data;
      });
    });
  }

  function openModal(orderData, config) {
    return new Promise(function(resolve, reject) {
      if (typeof Razorpay === 'undefined') {
        reject(new Error('Razorpay SDK not loaded'));
        return;
      }

      var options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.product_name || config.productName || 'Aporaksha',
        description: config.description || 'Purchase',
        theme: { color: (config.theme && config.theme.color) || '#ff671f' },
        handler: function(response) { resolve(response); },
        modal: { ondismiss: function() { reject(new Error('Payment cancelled')); } }
      };

      if (orderData.type === 'order' && orderData.order_id) {
        options.order_id = orderData.order_id;
      } else if (orderData.type === 'subscription' && orderData.subscription_id) {
        options.subscription_id = orderData.subscription_id;
      }

      if (config.notes) options.notes = config.notes;
      if (config.prefill) options.prefill = config.prefill;

      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp) {
        reject(new Error(resp.error && resp.error.description || 'Payment failed'));
      });
      rzp.open();
    });
  }

  function submit(config) {
    if (!config || !config.product_id) {
      var err = new Error('product_id is required');
      if (config && config.onError) config.onError(err);
      return Promise.reject(err);
    }

    var btn = config.buttonEl;
    var originalLabel = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = 'Processing...';

    var token = null;

    return checkHealth()
      .then(function(health) {
        if (!health.available) throw new Error('Payments are currently unavailable. Please try again later.');

        if (config.requireAuth !== false) {
          return window.Aporaksha.requireAuth(window.location.href);
        }
        return window.Aporaksha.getSessionToken().then(function(s) { return s || {}; });
      })
      .then(function(session) {
        if (!session) return null;
        token = session.token || null;
        return createOrder(config.product_id, token, { notes: config.notes });
      })
      .then(function(orderData) {
        if (!orderData) return null;
        return openModal(orderData, config);
      })
      .then(function(paymentResponse) {
        if (!paymentResponse) return null;

        var verifyData = {
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          product_id: config.product_id
        };
        if (paymentResponse.razorpay_order_id) verifyData.razorpay_order_id = paymentResponse.razorpay_order_id;
        if (paymentResponse.razorpay_subscription_id) verifyData.razorpay_subscription_id = paymentResponse.razorpay_subscription_id;

        return verifyPayment(verifyData, token).then(function(result) {
          if (btn) btn.innerHTML = 'Purchased';
          if (config.onSuccess) config.onSuccess(result, paymentResponse);
          return result;
        });
      })
      .catch(function(err) {
        if (btn) btn.innerHTML = originalLabel;
        if (err.message !== 'Payment cancelled') {
          console.error('[AporakshaCheckout]', err);
          if (config.onError) {
            config.onError(err);
          } else {
            alert(err.message);
          }
        }
        throw err;
      });
  }

  window.AporakshaCheckout = {
    checkHealth: checkHealth,
    createOrder: createOrder,
    verifyPayment: verifyPayment,
    openModal: openModal,
    submit: submit
  };
})();
