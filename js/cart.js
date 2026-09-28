// MONDO Cafe - Shopping Bag / Cart Controller
// Handles item customizations, calculations in PKR, checkout payload, and drawer UI

(function() {
  const CART_STORAGE_KEY = 'mondo_cart_state_v1';
  let cart = [];
  let appliedPromo = null; // { code: 'COZY10', discountPercent: 10 } or { code: 'FIRSTSIP', discountFlat: 200 }

  // Load from local storage
  function loadCart() {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        cart = JSON.parse(saved);
      } else {
        cart = [];
      }
    } catch (e) {
      cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartUI();
  }

  // Format Pakistani Rupee helper
  function formatPKR(val) {
    const num = Math.round(Number(val) || 0);
    return "Rs. " + num.toLocaleString('en-PK');
  }

  // Generate unique key for item + options combination
  function generateCartKey(itemId, options) {
    const milk = options.milk || 'Standard';
    const sweetness = options.sweetness || 'Standard';
    const ice = options.ice || 'Standard';
    const notes = options.notes || '';
    return `${itemId}_${milk}_${sweetness}_${ice}_${notes}`.replace(/\s+/g, '-');
  }

  // Add Item to Bag
  function addItem(product, options = {}, quantity = 1) {
    loadCart();

    const extraPrice = options.milkPrice || 0;
    const finalUnitPrice = Number(product.price) + Number(extraPrice);
    const cartKey = generateCartKey(product.id, options);

    const existingIndex = cart.findIndex(item => item.cartKey === cartKey);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        cartKey: cartKey,
        id: product.id,
        name: product.name,
        category: product.category,
        image_url: product.image_url,
        basePrice: Number(product.price),
        unitPrice: finalUnitPrice,
        quantity: quantity,
        options: {
          milk: options.milk || null,
          sweetness: options.sweetness || null,
          ice: options.ice || null,
          notes: options.notes || null,
          extraPrice: extraPrice
        }
      });
    }

    saveCart();
    showToast(`✨ Added <strong>${product.name}</strong> to your bag!`);
    openDrawer();
  }

  // Update item quantity
  function updateQuantity(cartKey, delta) {
    loadCart();
    const item = cart.find(i => i.cartKey === cartKey);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.cartKey !== cartKey);
      showToast(`Removed from your bag.`);
    }
    saveCart();
  }

  // Remove single line item
  function removeItem(cartKey) {
    loadCart();
    cart = cart.filter(i => i.cartKey !== cartKey);
    saveCart();
    showToast(`Item removed.`);
  }

  // Clear entire cart
  function clearCart() {
    cart = [];
    appliedPromo = null;
    saveCart();
  }

  // Calculate totals
  function getCalculations(deliveryType = 'delivery') {
    loadCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    
    // Delivery fee: Rs. 200 for delivery (Free delivery over Rs. 3,500), Rs. 0 for Dine-in/Pickup
    let deliveryFee = 0;
    if (deliveryType === 'delivery') {
      deliveryFee = subtotal > 3500 || subtotal === 0 ? 0 : 200;
    }

    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discountPercent) {
        discount = Math.round((subtotal * appliedPromo.discountPercent) / 100);
      } else if (appliedPromo.discountFlat) {
        discount = Math.min(appliedPromo.discountFlat, subtotal);
      }
    }

    const total = Math.max(0, subtotal - discount + deliveryFee);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      deliveryFee,
      discount,
      total,
      count,
      isFreeDelivery: deliveryType === 'delivery' && subtotal > 3500 && subtotal > 0
    };
  }

  // Apply Promo Codes
  function applyCoupon(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, message: "Please enter a voucher code" };

    if (cleanCode === 'COZY10' || cleanCode === 'GENZ10') {
      appliedPromo = { code: cleanCode, discountPercent: 10, label: "10% Off Cozy Perk" };
      saveCart();
      return { success: true, message: "🎉 10% discount applied!" };
    } else if (cleanCode === 'FIRSTSIP') {
      appliedPromo = { code: cleanCode, discountFlat: 200, label: "Rs. 200 Off First Sip" };
      saveCart();
      return { success: true, message: "🎉 Rs. 200 discount applied!" };
    } else if (cleanCode === 'MONDOLOVE') {
      appliedPromo = { code: cleanCode, discountPercent: 15, label: "15% Off VIP Perk" };
      saveCart();
      return { success: true, message: "💖 15% VIP discount applied!" };
    } else {
      return { success: false, message: "Invalid voucher code. Try 'COZY10' or 'FIRSTSIP'" };
    }
  }

  function removeCoupon() {
    appliedPromo = null;
    saveCart();
  }

  // Drawer open & close
  function openDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.add('is-open');
    if (overlay) overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (drawer) drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-visible');
    document.body.style.overflow = '';
  }

  // Toast Notification
  function showToast(htmlContent) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'cozy-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">☕</span>
        <span class="toast-text">${htmlContent}</span>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 20);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  // Render Cart UI Drawer
  function updateCartUI() {
    loadCart();
    const countBadges = document.querySelectorAll('.cart-badge-count');
    const calculations = getCalculations();

    countBadges.forEach(b => {
      b.textContent = calculations.count;
      b.style.display = calculations.count > 0 ? 'inline-flex' : 'none';
    });

    const floatingPill = document.getElementById('floatingCartPill');
    if (floatingPill) {
      if (calculations.count > 0) {
        floatingPill.classList.add('has-items');
        const pillCount = floatingPill.querySelector('.pill-count');
        const pillTotal = floatingPill.querySelector('.pill-total');
        if (pillCount) pillCount.textContent = `${calculations.count} item${calculations.count > 1 ? 's' : ''}`;
        if (pillTotal) pillTotal.textContent = formatPKR(calculations.total);
      } else {
        floatingPill.classList.remove('has-items');
      }
    }

    const itemsContainer = document.getElementById('cartDrawerItems');
    const summaryContainer = document.getElementById('cartDrawerSummary');
    const emptyState = document.getElementById('cartDrawerEmpty');

    if (!itemsContainer) return;

    if (cart.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      if (summaryContainer) summaryContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (summaryContainer) summaryContainer.style.display = 'block';

    itemsContainer.innerHTML = cart.map(item => {
      const optionsText = [];
      if (item.options.milk) optionsText.push(item.options.milk);
      if (item.options.sweetness) optionsText.push(`Sweetness: ${item.options.sweetness}`);
      if (item.options.ice) optionsText.push(item.options.ice);
      if (item.options.notes) optionsText.push(`Note: "${item.options.notes}"`);

      return `
        <div class="cart-item-card" data-key="${item.cartKey}">
          <img src="${item.image_url}" alt="${item.name}" class="cart-item-img" loading="lazy" />
          <div class="cart-item-info">
            <div class="cart-item-head">
              <h4 class="cart-item-title">${item.name}</h4>
              <button class="cart-item-remove" onclick="MondoCart.removeItem('${item.cartKey}')" title="Remove Item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            ${optionsText.length > 0 ? `<p class="cart-item-customs">${optionsText.join(' • ')}</p>` : ''}
            <div class="cart-item-bottom">
              <div class="cart-qty-control">
                <button type="button" class="qty-btn" onclick="MondoCart.updateQuantity('${item.cartKey}', -1)">-</button>
                <span class="qty-num">${item.quantity}</span>
                <button type="button" class="qty-btn" onclick="MondoCart.updateQuantity('${item.cartKey}', 1)">+</button>
              </div>
              <span class="cart-item-price">${formatPKR(item.unitPrice * item.quantity)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Summary block
    const subtotalEl = document.getElementById('cartSubtotalAmount');
    const discountRow = document.getElementById('cartDiscountRow');
    const discountEl = document.getElementById('cartDiscountAmount');
    const deliveryEl = document.getElementById('cartDeliveryAmount');
    const totalEl = document.getElementById('cartGrandTotalAmount');
    const promoPill = document.getElementById('appliedPromoPill');

    if (subtotalEl) subtotalEl.textContent = formatPKR(calculations.subtotal);
    
    if (discountRow && discountEl) {
      if (calculations.discount > 0 && appliedPromo) {
        discountRow.style.display = 'flex';
        discountEl.textContent = `-${formatPKR(calculations.discount)}`;
        if (promoPill) {
          promoPill.innerHTML = `
            <span>🏷️ ${appliedPromo.code} (${appliedPromo.label})</span>
            <button onclick="MondoCart.removeCoupon()" title="Remove code">✕</button>
          `;
          promoPill.style.display = 'inline-flex';
        }
      } else {
        discountRow.style.display = 'none';
        if (promoPill) promoPill.style.display = 'none';
      }
    }

    if (deliveryEl) {
      if (calculations.deliveryFee === 0) {
        deliveryEl.innerHTML = `<span class="free-tag">Free</span>`;
      } else {
        deliveryEl.textContent = formatPKR(calculations.deliveryFee);
      }
    }

    if (totalEl) totalEl.textContent = formatPKR(calculations.total);

    // Free delivery progress bar
    const freeBar = document.getElementById('freeDeliveryBar');
    const freeText = document.getElementById('freeDeliveryText');
    if (freeBar && freeText) {
      const threshold = 3500;
      if (calculations.subtotal >= threshold) {
        freeBar.style.width = '100%';
        freeText.innerHTML = `✨ You unlocked <strong>Free Delivery across town</strong>!`;
      } else {
        const pct = Math.min(100, Math.round((calculations.subtotal / threshold) * 100));
        freeBar.style.width = pct + '%';
        const remaining = threshold - calculations.subtotal;
        freeText.innerHTML = `Add <strong>${formatPKR(remaining)}</strong> more to unlock <strong>Free Delivery</strong>`;
      }
    }
  }

  // Setup DOM bindings
  function initCartUI() {
    loadCart();
    updateCartUI();

    // Drawer openers
    document.querySelectorAll('.js-open-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer();
      });
    });

    // Drawer closers
    const closeBtn = document.getElementById('cartCloseBtn');
    const overlay = document.getElementById('cartOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Promo code apply
    const promoForm = document.getElementById('cartPromoForm');
    if (promoForm) {
      promoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cartPromoInput');
        if (!input) return;
        const res = applyCoupon(input.value);
        if (res.success) {
          showToast(res.message);
          input.value = '';
        } else {
          showToast(`⚠️ ${res.message}`);
        }
      });
    }

    // Checkout button inside drawer
    const checkoutBtn = document.getElementById('cartCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        closeDrawer();
        if (window.MondoApp && typeof window.MondoApp.openCheckoutModal === 'function') {
          window.MondoApp.openCheckoutModal();
        }
      });
    }
  }

  // Expose API
  window.MondoCart = {
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItems: () => [...cart],
    getCalculations,
    applyCoupon,
    removeCoupon,
    openDrawer,
    closeDrawer,
    showToast,
    formatPKR,
    init: initCartUI,
    updateUI: updateCartUI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartUI);
  } else {
    initCartUI();
  }
})();
