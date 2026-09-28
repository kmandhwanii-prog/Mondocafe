// MONDO Cafe - Main Application Logic
// Orchestrates menu filtering, quick customization modal, Supabase sync, checkout flow and cozy vibes

(function() {
  let menuItems = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let selectedItemForModal = null;

  // Initialize Application
  async function initApp() {
    loadCategoryPills();
    await loadMenu();
    setupEventListeners();
    setupMoodGallery();
  }

  // Load Categories into Filter Bar
  function loadCategoryPills() {
    const container = document.getElementById('categoryFilters');
    if (!container) return;

    container.innerHTML = window.CATEGORIES.map(cat => `
      <button class="filter-pill ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}">
        <span class="pill-icon">${cat.icon}</span>
        <span class="pill-name">${cat.name}</span>
      </button>
    `).join('');

    container.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-cat');
        renderMenu();
      });
    });
  }

  // Load Menu Items from Supabase or Fallback
  async function loadMenu() {
    const grid = document.getElementById('menuGrid');
    if (grid) {
      grid.innerHTML = `
        <div class="menu-loading-state">
          <div class="steaming-cup">☕</div>
          <p>Brewing our seasonal menu...</p>
        </div>
      `;
    }

    try {
      if (window.MondoDB && typeof window.MondoDB.getMenuItems === 'function') {
        menuItems = await window.MondoDB.getMenuItems();
      } else {
        menuItems = window.DEFAULT_MENU || [];
      }
    } catch (e) {
      console.warn("Failed to load menu, using default:", e);
      menuItems = window.DEFAULT_MENU || [];
    }

    renderMenu();
  }

  // Render Menu Grid based on Category & Search
  function renderMenu() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;

    let filtered = menuItems;

    // Filter by Category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(item => item.category === activeCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.badge_tag && item.badge_tag.toLowerCase().includes(q))
      );
    }

    if (menuItems.length === 0) {
      grid.innerHTML = `
        <div class="empty-menu-state">
          <div class="empty-icon">☕✨</div>
          <h3 style="font-family:var(--font-serif); font-size:1.6rem; color:var(--c-espresso); margin-bottom:8px;">Your Menu is Ready to be Crafted</h3>
          <p style="max-width:440px; margin:0 auto 20px; color:var(--c-text-secondary); font-size:0.95rem;">
            Dummy dishes have been cleared so you can add your own signature sips, artisan roasts, and fresh bakes.
          </p>
          <a href="admin.html" class="btn btn-primary">
            <span>Open Staff Portal (+ Add Dish)</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-menu-state">
          <div class="empty-icon">☕🍃</div>
          <h3>No items found in this section</h3>
          <p>Try searching for something else or reset your category filter.</p>
          <button class="btn btn-outline" onclick="MondoApp.resetFilters()">View All Items</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const isAvailable = item.is_available !== false;
      return `
        <article class="menu-card ${!isAvailable ? 'sold-out' : ''}" data-id="${item.id}">
          <div class="menu-card-media" onclick="MondoApp.openCustomizationModal('${item.id}')">
            <img src="${item.image_url}" alt="${item.name}" loading="lazy" class="menu-card-img" />
            <div class="card-overlay-badges">
              ${item.badge_tag ? `<span class="aesthetic-badge">${item.badge_tag}</span>` : ''}
              ${!isAvailable ? `<span class="sold-out-badge">Sold Out Today</span>` : ''}
            </div>
            <button class="quick-view-btn" aria-label="View Details">
              <span>Quick View</span>
            </button>
          </div>
          <div class="menu-card-body">
            <div class="menu-card-header">
              <h3 class="menu-card-title" onclick="MondoApp.openCustomizationModal('${item.id}')">${item.name}</h3>
              <span class="menu-card-price">${MondoCart.formatPKR(item.price)}</span>
            </div>
            <p class="menu-card-desc">${item.description}</p>
            <div class="menu-card-footer">
              <span class="menu-card-calorie">${item.calories || 'Crafted with Love'}</span>
              <button 
                class="btn-add-bag" 
                onclick="MondoApp.handleQuickAdd('${item.id}')"
                ${!isAvailable ? 'disabled' : ''}
                title="${isAvailable ? 'Customize & Add' : 'Sold Out'}"
              >
                ${isAvailable ? `
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Add</span>
                ` : 'Sold Out'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Quick Add / Open Customization Modal
  function handleQuickAdd(itemId) {
    const item = menuItems.find(i => i.id == itemId);
    if (!item) return;

    // If item is customizable (coffee/drink), open the modal for options
    if (item.customizable !== false && (item.category.includes('iced') || item.category.includes('espresso') || item.category.includes('tea'))) {
      openCustomizationModal(itemId);
    } else {
      // Direct add to bag
      MondoCart.addItem(item, {}, 1);
    }
  }

  // Open Customization Modal
  function openCustomizationModal(itemId) {
    const item = menuItems.find(i => i.id == itemId);
    if (!item) return;

    selectedItemForModal = item;
    const modal = document.getElementById('customizationModal');
    if (!modal) return;

    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalItemDesc').textContent = item.description;
    document.getElementById('modalItemPrice').textContent = MondoCart.formatPKR(item.price);
    document.getElementById('modalItemImg').src = item.image_url;
    document.getElementById('modalItemTag').textContent = item.badge_tag || 'Specialty Recipe';
    document.getElementById('modalItemCalories').textContent = item.calories || 'Freshly Crafted';

    // Reset customization selectors
    const milkRadios = document.querySelectorAll('input[name="modalMilk"]');
    if (milkRadios.length) milkRadios[0].checked = true;

    const sweetRadios = document.querySelectorAll('input[name="modalSweet"]');
    if (sweetRadios.length) sweetRadios[0].checked = true;

    const iceRadios = document.querySelectorAll('input[name="modalIce"]');
    if (iceRadios.length) iceRadios[0].checked = true;

    const notesInput = document.getElementById('modalItemNotes');
    if (notesInput) notesInput.value = '';

    const qtyEl = document.getElementById('modalItemQty');
    if (qtyEl) qtyEl.textContent = '1';

    // Show/hide drink-specific options for bakery vs drinks
    const drinkOptions = document.getElementById('modalDrinkOptions');
    if (drinkOptions) {
      const isDrink = item.category === 'signature-iced' || item.category === 'espresso-hot' || item.category === 'matcha-tea';
      drinkOptions.style.display = isDrink ? 'block' : 'none';
    }

    updateModalCalculatedPrice();
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeCustomizationModal() {
    const modal = document.getElementById('customizationModal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
    selectedItemForModal = null;
  }

  function updateModalCalculatedPrice() {
    if (!selectedItemForModal) return;
    const qty = parseInt(document.getElementById('modalItemQty').textContent || '1', 10);
    
    // Check milk extra
    const selectedMilkRadio = document.querySelector('input[name="modalMilk"]:checked');
    const milkPrice = selectedMilkRadio ? parseInt(selectedMilkRadio.getAttribute('data-extra') || '0', 10) : 0;

    const unitPrice = selectedItemForModal.price + milkPrice;
    const totalPrice = unitPrice * qty;

    const btnPriceEl = document.getElementById('modalAddBtnPrice');
    if (btnPriceEl) {
      btnPriceEl.textContent = MondoCart.formatPKR(totalPrice);
    }
  }

  function submitCustomizationModal() {
    if (!selectedItemForModal) return;

    const qty = parseInt(document.getElementById('modalItemQty').textContent || '1', 10);
    const selectedMilkRadio = document.querySelector('input[name="modalMilk"]:checked');
    const selectedSweetRadio = document.querySelector('input[name="modalSweet"]:checked');
    const selectedIceRadio = document.querySelector('input[name="modalIce"]:checked');
    const notesInput = document.getElementById('modalItemNotes');

    const isDrink = selectedItemForModal.category === 'signature-iced' || 
                    selectedItemForModal.category === 'espresso-hot' || 
                    selectedItemForModal.category === 'matcha-tea';

    const options = {
      milk: isDrink && selectedMilkRadio ? selectedMilkRadio.value : null,
      milkPrice: isDrink && selectedMilkRadio ? parseInt(selectedMilkRadio.getAttribute('data-extra') || '0', 10) : 0,
      sweetness: isDrink && selectedSweetRadio ? selectedSweetRadio.value : null,
      ice: isDrink && selectedIceRadio ? selectedIceRadio.value : null,
      notes: notesInput && notesInput.value.trim() ? notesInput.value.trim() : null
    };

    MondoCart.addItem(selectedItemForModal, options, qty);
    closeCustomizationModal();
  }

  // --- CHECKOUT MODAL FLOW ---

  function openCheckoutModal() {
    const cart = MondoCart.getItems();
    if (cart.length === 0) {
      MondoCart.showToast("Your shopping bag is empty! Pick your favorite sip.");
      return;
    }

    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    renderCheckoutReview();
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function renderCheckoutReview() {
    const deliveryTypeRadio = document.querySelector('input[name="orderType"]:checked');
    const orderType = deliveryTypeRadio ? deliveryTypeRadio.value : 'delivery';
    const calcs = MondoCart.getCalculations(orderType);
    const cart = MondoCart.getItems();

    // Toggle address or table input
    const addressGroup = document.getElementById('checkoutAddressGroup');
    const tableGroup = document.getElementById('checkoutTableGroup');
    if (orderType === 'delivery') {
      if (addressGroup) addressGroup.style.display = 'block';
      if (tableGroup) tableGroup.style.display = 'none';
    } else if (orderType === 'dine_in') {
      if (addressGroup) addressGroup.style.display = 'none';
      if (tableGroup) tableGroup.style.display = 'block';
    } else {
      // pickup
      if (addressGroup) addressGroup.style.display = 'none';
      if (tableGroup) tableGroup.style.display = 'none';
    }

    // List items
    const listEl = document.getElementById('checkoutItemsList');
    if (listEl) {
      listEl.innerHTML = cart.map(item => `
        <div class="checkout-line-item">
          <div class="checkout-item-details">
            <span class="checkout-qty">${item.quantity}x</span>
            <span class="checkout-name">${item.name}</span>
            ${item.options.milk ? `<small class="checkout-opt">${item.options.milk}</small>` : ''}
          </div>
          <span class="checkout-price">${MondoCart.formatPKR(item.unitPrice * item.quantity)}</span>
        </div>
      `).join('');
    }

    // Totals
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const deliveryEl = document.getElementById('checkoutDelivery');
    const discountEl = document.getElementById('checkoutDiscount');
    const totalEl = document.getElementById('checkoutTotal');

    if (subtotalEl) subtotalEl.textContent = MondoCart.formatPKR(calcs.subtotal);
    if (deliveryEl) deliveryEl.textContent = calcs.deliveryFee === 0 ? 'Free' : MondoCart.formatPKR(calcs.deliveryFee);
    if (discountEl) discountEl.textContent = `-${MondoCart.formatPKR(calcs.discount)}`;
    if (totalEl) totalEl.textContent = MondoCart.formatPKR(calcs.total);
  }

  // Handle Order Submit to Supabase
  async function submitOrder(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('checkoutSubmitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Confirm Order';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Brewing your order... ☕</span>`;
    }

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'delivery';
    const address = document.getElementById('custAddress')?.value.trim() || '';
    const tableNumber = document.getElementById('custTable')?.value.trim() || '';
    const notes = document.getElementById('custNotes')?.value.trim() || '';
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash_on_delivery';

    // Validation
    if (!name) {
      alert("Please enter your name.");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
      return;
    }

    if (!phone || phone.length < 8) {
      alert("Please enter a valid Pakistani contact number (e.g. 0300-1234567).");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
      return;
    }

    if (orderType === 'delivery' && !address) {
      alert("Please provide your delivery address in Pakistan.");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
      return;
    }

    const calcs = MondoCart.getCalculations(orderType);
    const cartItems = MondoCart.getItems();

    const orderPayload = {
      name,
      phone,
      orderType,
      address: orderType === 'delivery' ? address : null,
      tableNumber: orderType === 'dine_in' ? tableNumber : null,
      notes,
      paymentMethod,
      items: cartItems,
      subtotal: calcs.subtotal,
      deliveryFee: calcs.deliveryFee,
      discount: calcs.discount,
      total: calcs.total
    };

    try {
      const savedOrder = await window.MondoDB.createOrder(orderPayload);
      
      // Clear Cart
      MondoCart.clearCart();
      closeCheckoutModal();

      // Show Success Modal
      showOrderSuccess(savedOrder);
    } catch (err) {
      console.error("Order submission failed:", err);
      alert("Could not process order: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  // Display Order Success Screen
  function showOrderSuccess(order) {
    const modal = document.getElementById('orderSuccessModal');
    if (!modal) return;

    document.getElementById('successOrderCode').textContent = order.order_code || 'MND-RECEIPT';
    document.getElementById('successCustName').textContent = order.customer_name;
    document.getElementById('successTotalAmount').textContent = MondoCart.formatPKR(order.total_amount);
    document.getElementById('successOrderType').textContent = (order.order_type || 'delivery').toUpperCase();
    
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeOrderSuccessModal() {
    const modal = document.getElementById('orderSuccessModal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // Mood Gallery Interactions
  function setupMoodGallery() {
    const likeButtons = document.querySelectorAll('.gallery-heart-btn');
    likeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('liked');
        const countSpan = btn.querySelector('.heart-count');
        if (countSpan) {
          let count = parseInt(countSpan.textContent, 10) || 0;
          count = btn.classList.contains('liked') ? count + 1 : count - 1;
          countSpan.textContent = count;
        }
      });
    });
  }

  // Setup DOM Event Listeners
  function setupEventListeners() {
    // Search bar
    const searchInput = document.getElementById('menuSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderMenu();
      });
    }

    // Modal Qty controls
    const qtyMinus = document.getElementById('modalQtyMinus');
    const qtyPlus = document.getElementById('modalQtyPlus');
    const qtyDisplay = document.getElementById('modalItemQty');

    if (qtyMinus && qtyDisplay) {
      qtyMinus.addEventListener('click', () => {
        let q = parseInt(qtyDisplay.textContent || '1', 10);
        if (q > 1) {
          qtyDisplay.textContent = q - 1;
          updateModalCalculatedPrice();
        }
      });
    }

    if (qtyPlus && qtyDisplay) {
      qtyPlus.addEventListener('click', () => {
        let q = parseInt(qtyDisplay.textContent || '1', 10);
        qtyDisplay.textContent = q + 1;
        updateModalCalculatedPrice();
      });
    }

    // Milk radio changes
    document.querySelectorAll('input[name="modalMilk"]').forEach(radio => {
      radio.addEventListener('change', updateModalCalculatedPrice);
    });

    // Customization modal close
    const modalCloseBtn = document.getElementById('customizationModalClose');
    const modalOverlay = document.getElementById('customizationModalOverlay');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCustomizationModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeCustomizationModal);

    // Add to bag from modal
    const modalAddBtn = document.getElementById('modalAddToBagBtn');
    if (modalAddBtn) modalAddBtn.addEventListener('click', submitCustomizationModal);

    // Checkout modal openers & closers
    const checkoutCloseBtn = document.getElementById('checkoutModalClose');
    const checkoutOverlay = document.getElementById('checkoutModalOverlay');
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);
    if (checkoutOverlay) checkoutOverlay.addEventListener('click', closeCheckoutModal);

    // Checkout order type radio changes (delivery / pickup / dine-in)
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
      radio.addEventListener('change', renderCheckoutReview);
    });

    // Checkout Form Submit
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', submitOrder);
    }

    // Success modal close
    const successCloseBtn = document.getElementById('orderSuccessCloseBtn');
    if (successCloseBtn) successCloseBtn.addEventListener('click', closeOrderSuccessModal);

    // Mobile Navigation Hamburger
    const navToggle = document.getElementById('mobileNavToggle');
    const navMenu = document.getElementById('headerNavLinks');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('nav-open');
        navToggle.classList.toggle('is-active');
      });

      // Close on link click
      navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navMenu.classList.remove('nav-open');
          navToggle.classList.remove('is-active');
        });
      });
    }

    // Vibe Generator Button
    const vibeBtn = document.getElementById('vibeGeneratorBtn');
    if (vibeBtn) {
      vibeBtn.addEventListener('click', generateVibeSuggestion);
    }
  }

  // Fun Vibe Generator for Gen Z aesthetic cafe picker
  function generateVibeSuggestion() {
    const available = menuItems.filter(i => i.is_available !== false);
    if (available.length === 0) {
      MondoCart.showToast("✨ No dishes added yet. Add your custom dishes in the Staff Portal!");
      return;
    }
    const randomPick = available[Math.floor(Math.random() * available.length)];
    
    openCustomizationModal(randomPick.id);
    MondoCart.showToast(`✨ The universe picked <strong>${randomPick.name}</strong> for your vibe today!`);
  }

  function resetFilters() {
    activeCategory = 'all';
    searchQuery = '';
    const searchInput = document.getElementById('menuSearchInput');
    if (searchInput) searchInput.value = '';
    loadCategoryPills();
    renderMenu();
  }

  // Expose App API
  window.MondoApp = {
    init: initApp,
    reloadMenu: loadMenu,
    handleQuickAdd,
    openCustomizationModal,
    closeCustomizationModal,
    openCheckoutModal,
    closeCheckoutModal,
    resetFilters,
    generateVibeSuggestion
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
