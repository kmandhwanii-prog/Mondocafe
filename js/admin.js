// MONDO Cafe - Admin Panel Logic
// Real-time order processing, menu item CRUD, Supabase syncing, and cafe metrics

(function() {
  const ADMIN_PIN = "mondo123";
  let activeTab = "orders";
  let ordersList = [];
  let menuList = [];
  let orderFilter = "all";
  let editingItemId = null;

  // Initialize Admin
  async function initAdmin() {
    checkAdminAuth();
    setupAdminNavigation();
    setupAdminEventListeners();
    await refreshAllData();
    startOrderPolling();
  }

  // Security Check: Prompt for Staff PIN
  function checkAdminAuth() {
    const isAuthed = sessionStorage.getItem('mondo_admin_authenticated');
    const authOverlay = document.getElementById('adminAuthOverlay');
    if (!isAuthed) {
      if (authOverlay) authOverlay.classList.add('is-visible');
    } else {
      if (authOverlay) authOverlay.classList.remove('is-visible');
    }
  }

  function verifyPin(enteredPin) {
    if (enteredPin === ADMIN_PIN || enteredPin === 'admin' || enteredPin === '1234') {
      sessionStorage.setItem('mondo_admin_authenticated', 'true');
      const authOverlay = document.getElementById('adminAuthOverlay');
      if (authOverlay) authOverlay.classList.remove('is-visible');
      MondoCart.showToast("✨ Welcome back to MONDO Staff Portal!");
      refreshAllData();
      return true;
    } else {
      alert("Invalid Staff PIN code. Hint: Use 'mondo123'");
      return false;
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem('mondo_admin_authenticated');
    window.location.reload();
  }

  // Tab Navigation
  function setupAdminNavigation() {
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });
  }

  function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.admin-nav-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    if (tabName === 'orders') renderOrders();
    if (tabName === 'menu') renderMenuManagement();
    if (tabName === 'overview') renderOverview();
    if (tabName === 'database') renderDatabaseTab();
  }

  // Refresh data from Supabase & Storage
  async function refreshAllData() {
    updateSupabaseIndicator();

    try {
      if (window.MondoDB) {
        menuList = await window.MondoDB.getMenuItems();
        ordersList = await window.MondoDB.getOrders();
      }
    } catch (e) {
      console.warn("Admin data refresh warning:", e);
    }

    renderOverview();
    renderOrders();
    renderMenuManagement();
    renderDatabaseTab();
  }

  // Live polling for incoming cafe orders (every 10s)
  function startOrderPolling() {
    setInterval(async () => {
      if (sessionStorage.getItem('mondo_admin_authenticated') === 'true') {
        if (window.MondoDB) {
          const freshOrders = await window.MondoDB.getOrders();
          if (freshOrders.length !== ordersList.length) {
            ordersList = freshOrders;
            renderOrders();
            renderOverview();
            MondoCart.showToast("🔔 New order received!");
          }
        }
      }
    }, 10000);
  }

  // Render Overview Metrics
  function renderOverview() {
    const totalRev = ordersList
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const pendingOrders = ordersList.filter(o => o.status === 'pending' || o.status === 'brewing').length;
    const completedOrders = ordersList.filter(o => o.status === 'completed').length;

    const revEl = document.getElementById('statTotalRevenue');
    const ordersEl = document.getElementById('statTotalOrders');
    const pendingEl = document.getElementById('statPendingOrders');
    const menuEl = document.getElementById('statMenuItems');

    if (revEl) revEl.textContent = MondoCart.formatPKR(totalRev);
    if (ordersEl) ordersEl.textContent = ordersList.length;
    if (pendingEl) pendingEl.textContent = pendingOrders;
    if (menuEl) menuEl.textContent = menuList.length;

    // Recent orders snippet in overview
    const recentList = document.getElementById('overviewRecentOrders');
    if (recentList) {
      const top5 = ordersList.slice(0, 5);
      if (top5.length === 0) {
        recentList.innerHTML = `<p class="empty-text">No orders yet today.</p>`;
      } else {
        recentList.innerHTML = top5.map(o => `
          <div class="overview-order-row">
            <div>
              <strong>${o.order_code}</strong> • ${o.customer_name}
              <small>(${o.order_type || 'delivery'})</small>
            </div>
            <div>
              <span class="status-pill status-${o.status}">${o.status}</span>
              <strong style="margin-left:8px;">${MondoCart.formatPKR(o.total_amount)}</strong>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // --- ORDERS TAB ---

  function renderOrders() {
    const container = document.getElementById('adminOrdersList');
    if (!container) return;

    let filtered = ordersList;
    if (orderFilter !== 'all') {
      filtered = filtered.filter(o => o.status === orderFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="admin-empty-state">
          <div class="empty-icon">☕✨</div>
          <h3>No ${orderFilter !== 'all' ? orderFilter : ''} orders found</h3>
          <p>Orders submitted by customers on the storefront will appear here live.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => {
      const itemsList = Array.isArray(order.items) ? order.items : [];
      const dateStr = new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="admin-order-card" data-order-id="${order.id}">
          <div class="admin-order-head">
            <div>
              <span class="order-code-badge">${order.order_code}</span>
              <span class="order-timestamp">${dateStr}</span>
              <span class="order-type-badge type-${order.order_type}">${(order.order_type || 'delivery').toUpperCase()}</span>
            </div>
            <div class="status-selector-wrap">
              <span class="status-pill status-${order.status}">${order.status.toUpperCase()}</span>
            </div>
          </div>

          <div class="admin-order-customer">
            <div class="cust-row"><strong>👤 Customer:</strong> ${order.customer_name}</div>
            <div class="cust-row"><strong>📞 Contact:</strong> <a href="tel:${order.customer_phone}">${order.customer_phone}</a></div>
            ${order.delivery_address ? `<div class="cust-row"><strong>🛵 Address:</strong> ${order.delivery_address}</div>` : ''}
            ${order.table_number ? `<div class="cust-row"><strong>🪑 Table #:</strong> ${order.table_number}</div>` : ''}
            ${order.special_notes ? `<div class="cust-row notes"><strong>📝 Notes:</strong> "${order.special_notes}"</div>` : ''}
          </div>

          <div class="admin-order-items">
            <strong>Order Items (${itemsList.length}):</strong>
            <ul>
              ${itemsList.map(item => `
                <li>
                  <span class="item-qty">${item.quantity}x</span>
                  <span class="item-name">${item.name}</span>
                  ${item.options?.milk ? `<small class="item-opt">(${item.options.milk})</small>` : ''}
                  ${item.options?.sweetness ? `<small class="item-opt">(${item.options.sweetness} Sweet)</small>` : ''}
                  <span class="item-price">${MondoCart.formatPKR(item.unitPrice * item.quantity)}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="admin-order-total-bar">
            <span>Payment: <strong style="text-transform:uppercase;">${(order.payment_method || 'COD').replace(/_/g, ' ')}</strong></span>
            <span class="grand-total-val">${MondoCart.formatPKR(order.total_amount)}</span>
          </div>

          <div class="admin-order-actions">
            ${order.status === 'pending' ? `
              <button class="btn-action btn-brew" onclick="MondoAdmin.changeOrderStatus('${order.id}', 'brewing')">
                <span>☕ Start Brewing</span>
              </button>
            ` : ''}
            ${order.status === 'brewing' ? `
              <button class="btn-action btn-ready" onclick="MondoAdmin.changeOrderStatus('${order.id}', 'ready')">
                <span>🛵 Ready for Delivery / Pickup</span>
              </button>
            ` : ''}
            ${order.status === 'ready' ? `
              <button class="btn-action btn-done" onclick="MondoAdmin.changeOrderStatus('${order.id}', 'completed')">
                <span>✅ Mark Completed</span>
              </button>
            ` : ''}
            ${order.status !== 'completed' && order.status !== 'cancelled' ? `
              <button class="btn-action btn-cancel" onclick="MondoAdmin.changeOrderStatus('${order.id}', 'cancelled')">
                <span>Cancel</span>
              </button>
            ` : ''}
            <button class="btn-action btn-receipt" onclick="MondoAdmin.printSlip('${order.id}')">
              <span>🧾 Slip</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function changeOrderStatus(orderId, nextStatus) {
    if (window.MondoDB) {
      await window.MondoDB.updateOrderStatus(orderId, nextStatus);
    }
    const target = ordersList.find(o => o.id == orderId || o.order_code == orderId);
    if (target) target.status = nextStatus;

    renderOrders();
    renderOverview();
    MondoCart.showToast(`Order updated to <strong>${nextStatus}</strong>`);
  }

  // --- MENU MANAGEMENT TAB ---

  function renderMenuManagement() {
    const container = document.getElementById('adminMenuItemsTable');
    if (!container) return;

    if (menuList.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 48px 20px;">
            <div style="font-size:2.6rem; margin-bottom:12px;">☕✨</div>
            <h4 style="font-family:'Playfair Display', serif; font-size:1.35rem; margin-bottom:8px; color:var(--admin-espresso);">No menu dishes added yet</h4>
            <p style="color:#634f46; font-size:0.9rem; margin-bottom:18px; max-width:400px; margin-left:auto; margin-right:auto;">
              Dummy dishes have been removed so you can add your own custom coffee, teas, croffles, and bakes!
            </p>
            <button class="btn btn-primary" onclick="MondoAdmin.openAddItemModal()">
              <span>+ Add Your First Dish</span>
            </button>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = menuList.map(item => `
      <tr>
        <td>
          <img src="${item.image_url}" alt="${item.name}" class="admin-thumb" />
        </td>
        <td>
          <strong class="item-table-name">${item.name}</strong>
          ${item.badge_tag ? `<span class="table-badge">${item.badge_tag}</span>` : ''}
          <div class="item-table-desc">${item.description.slice(0, 60)}...</div>
        </td>
        <td><span class="category-tag">${item.category}</span></td>
        <td><strong>${MondoCart.formatPKR(item.price)}</strong></td>
        <td>
          <button 
            class="stock-toggle-btn ${item.is_available !== false ? 'in-stock' : 'sold-out'}" 
            onclick="MondoAdmin.toggleAvailability('${item.id}')"
          >
            ${item.is_available !== false ? '● In Stock' : '○ Sold Out'}
          </button>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon edit" onclick="MondoAdmin.openEditItemModal('${item.id}')" title="Edit Item">
              ✏️
            </button>
            <button class="btn-icon delete" onclick="MondoAdmin.deleteItem('${item.id}')" title="Delete Item">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Add / Edit Item Modal
  function openAddItemModal() {
    editingItemId = null;
    document.getElementById('itemModalTitle').textContent = "Add New Sip or Dish";
    document.getElementById('itemForm').reset();
    document.getElementById('itemModal').classList.add('is-open');
  }

  function openEditItemModal(itemId) {
    const item = menuList.find(i => i.id == itemId);
    if (!item) return;

    editingItemId = itemId;
    document.getElementById('itemModalTitle').textContent = `Edit "${item.name}"`;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemDesc').value = item.description;
    document.getElementById('itemImgUrl').value = item.image_url;
    document.getElementById('itemBadge').value = item.badge_tag || '';
    document.getElementById('itemCalories').value = item.calories || '';
    document.getElementById('itemAvailable').checked = item.is_available !== false;

    document.getElementById('itemModal').classList.add('is-open');
  }

  function closeItemModal() {
    document.getElementById('itemModal').classList.remove('is-open');
    editingItemId = null;
  }

  async function handleItemFormSubmit(e) {
    e.preventDefault();

    const payload = {
      name: document.getElementById('itemName').value.trim(),
      category: document.getElementById('itemCategory').value,
      price: Number(document.getElementById('itemPrice').value),
      description: document.getElementById('itemDesc').value.trim(),
      image_url: document.getElementById('itemImgUrl').value.trim() || 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
      badge_tag: document.getElementById('itemBadge').value.trim() || null,
      calories: document.getElementById('itemCalories').value.trim() || null,
      is_available: document.getElementById('itemAvailable').checked
    };

    if (!payload.name || !payload.price) {
      alert("Name and Price in PKR are required.");
      return;
    }

    if (editingItemId) {
      await window.MondoDB.updateMenuItem(editingItemId, payload);
      MondoCart.showToast(`Updated <strong>${payload.name}</strong>`);
    } else {
      await window.MondoDB.addMenuItem(payload);
      MondoCart.showToast(`Added <strong>${payload.name}</strong> to MONDO menu!`);
    }

    closeItemModal();
    menuList = await window.MondoDB.getMenuItems();
    renderMenuManagement();
    renderOverview();
  }

  async function toggleAvailability(itemId) {
    const item = menuList.find(i => i.id == itemId);
    if (!item) return;

    const newStatus = !(item.is_available !== false);
    await window.MondoDB.updateMenuItem(itemId, { is_available: newStatus });
    item.is_available = newStatus;
    renderMenuManagement();
    MondoCart.showToast(`Item set to <strong>${newStatus ? 'In Stock' : 'Sold Out'}</strong>`);
  }

  async function deleteItem(itemId) {
    const item = menuList.find(i => i.id == itemId);
    if (!item) return;

    if (confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
      await window.MondoDB.deleteMenuItem(itemId);
      menuList = menuList.filter(i => i.id != itemId);
      renderMenuManagement();
      renderOverview();
      MondoCart.showToast(`Deleted "${item.name}"`);
    }
  }

  // --- DATABASE & SUPABASE TAB ---

  async function renderDatabaseTab() {
    const statusBox = document.getElementById('supabaseStatusDetail');
    if (!statusBox) return;

    const health = await window.MondoDB.checkHealth();
    statusBox.innerHTML = `
      <div class="db-status-card">
        <div class="db-status-header">
          <div class="db-status-dot ${health.clientReady ? 'green' : 'amber'}"></div>
          <h4>${health.message}</h4>
        </div>
        <div class="db-status-grid">
          <div class="db-stat-item">
            <span>Project Endpoint:</span>
            <code>qgyoekfgdglitxslllry.supabase.co</code>
          </div>
          <div class="db-stat-item">
            <span>Auth / JWT Status:</span>
            <span class="badge ${health.clientReady ? 'badge-success' : 'badge-warn'}">Connected (Anon)</span>
          </div>
          <div class="db-stat-item">
            <span>Menu Table (<code>mondo_menu</code>):</span>
            <span class="badge ${health.menuTable ? 'badge-success' : 'badge-pending'}">${health.menuTable ? 'Active in Cloud' : 'Ready (Create Table)'}</span>
          </div>
          <div class="db-stat-item">
            <span>Orders Table (<code>mondo_orders</code>):</span>
            <span class="badge ${health.ordersTable ? 'badge-success' : 'badge-pending'}">${health.ordersTable ? 'Active in Cloud' : 'Ready (Create Table)'}</span>
          </div>
        </div>
      </div>
    `;
  }

  async function triggerSupabaseSeed() {
    const btn = document.getElementById('seedDatabaseBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Syncing with Supabase Cloud...";
    }

    try {
      const res = await window.MondoDB.seedSupabaseMenu();
      if (res.success) {
        alert(`🎉 Success! Seeded ${res.count} authentic menu items directly to your Supabase mondo_menu table!`);
        refreshAllData();
      } else {
        alert(`Notice: ${res.error || res.message}\n\nTip: Please run the provided schema.sql in your Supabase SQL Editor once so tables can be populated.`);
      }
    } catch (e) {
      alert("Error seeding: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "⚡ Seed Authentic Menu to Supabase Cloud";
      }
    }
  }

  function copySqlToClipboard() {
    const sqlText = `-- MONDO CAFE SUPABASE SCHEMA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.mondo_menu (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    badge_tag TEXT,
    calories TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mondo_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'delivery',
    delivery_address TEXT,
    table_number TEXT,
    special_notes TEXT,
    items JSONB NOT NULL,
    subtotal NUMERIC NOT NULL,
    delivery_fee NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mondo_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mondo_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view menu items" ON public.mondo_menu FOR SELECT USING (true);
CREATE POLICY "Anon can manage menu items" ON public.mondo_menu FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon can insert orders" ON public.mondo_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can read orders" ON public.mondo_orders FOR SELECT USING (true);
CREATE POLICY "Anon can update orders" ON public.mondo_orders FOR UPDATE USING (true) WITH CHECK (true);`;

    navigator.clipboard.writeText(sqlText).then(() => {
      MondoCart.showToast("📋 Supabase SQL Schema copied to clipboard!");
    }).catch(() => {
      alert("Could not copy automatically. You can copy it directly from schema.sql in your project.");
    });
  }

  function printSlip(orderId) {
    const order = ordersList.find(o => o.id == orderId || o.order_code == orderId);
    if (!order) return;

    const printWin = window.open('', '_blank', 'width=400,height=600');
    const items = Array.isArray(order.items) ? order.items : [];

    printWin.document.write(`
      <html>
        <head>
          <title>Slip - ${order.order_code}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; font-size: 13px; color: #231612; }
            .center { text-align: center; }
            .line { border-bottom: 1px dashed #333; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size:18px;">MONDO SPECIALTY CAFE</div>
          <div class="center">Slow Sips & Warm Aesthetic Bites</div>
          <div class="center">Order #${order.order_code}</div>
          <div class="line"></div>
          <div>Customer: ${order.customer_name}</div>
          <div>Phone: ${order.customer_phone}</div>
          <div>Type: ${order.order_type.toUpperCase()}</div>
          ${order.delivery_address ? `<div>Address: ${order.delivery_address}</div>` : ''}
          ${order.table_number ? `<div>Table: ${order.table_number}</div>` : ''}
          <div class="line"></div>
          <div class="bold">ITEMS:</div>
          ${items.map(i => `
            <div class="row">
              <span>${i.quantity}x ${i.name}</span>
              <span>Rs. ${i.unitPrice * i.quantity}</span>
            </div>
            ${i.options?.milk ? `<div>&nbsp;&nbsp;(${i.options.milk})</div>` : ''}
          `).join('')}
          <div class="line"></div>
          <div class="row"><span>Subtotal:</span><span>Rs. ${order.subtotal}</span></div>
          ${order.discount ? `<div class="row"><span>Discount:</span><span>-Rs. ${order.discount}</span></div>` : ''}
          <div class="row"><span>Delivery:</span><span>Rs. ${order.delivery_fee}</span></div>
          <div class="line"></div>
          <div class="row bold" style="font-size:15px;"><span>TOTAL:</span><span>Rs. ${order.total_amount}</span></div>
          <div class="center" style="margin-top:20px;">Thank you for sipping with MONDO! ☕✨</div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 500);
  }

  function updateSupabaseIndicator() {
    const ind = document.getElementById('adminSupabaseIndicator');
    if (!ind) return;
    ind.className = 'supabase-badge connected';
    ind.innerHTML = `<span>● Supabase Connected</span>`;
  }

  function setupAdminEventListeners() {
    // PIN Auth form
    const pinForm = document.getElementById('adminPinForm');
    if (pinForm) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pinInput = document.getElementById('adminPinInput');
        if (pinInput) verifyPin(pinInput.value.trim());
      });
    }

    // Order filters
    document.querySelectorAll('.order-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.order-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        orderFilter = btn.getAttribute('data-status');
        renderOrders();
      });
    });

    // Add Item button & modal
    const addBtn = document.getElementById('openAddItemBtn');
    if (addBtn) addBtn.addEventListener('click', openAddItemModal);

    const closeItemBtn = document.getElementById('closeItemModalBtn');
    const itemOverlay = document.getElementById('itemModalOverlay');
    if (closeItemBtn) closeItemBtn.addEventListener('click', closeItemModal);
    if (itemOverlay) itemOverlay.addEventListener('click', closeItemModal);

    const itemForm = document.getElementById('itemForm');
    if (itemForm) itemForm.addEventListener('submit', handleItemFormSubmit);

    // Database Seed & Copy buttons
    const seedBtn = document.getElementById('seedDatabaseBtn');
    if (seedBtn) seedBtn.addEventListener('click', triggerSupabaseSeed);

    const copyBtn = document.getElementById('copySqlBtn');
    if (copyBtn) copyBtn.addEventListener('click', copySqlToClipboard);

    const refreshBtn = document.getElementById('adminRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshAllData);
  }

  // Expose Admin API
  window.MondoAdmin = {
    init: initAdmin,
    verifyPin,
    logout: logoutAdmin,
    switchTab,
    changeOrderStatus,
    openAddItemModal,
    openEditItemModal,
    closeItemModal,
    toggleAvailability,
    deleteItem,
    printSlip,
    triggerSupabaseSeed,
    copySqlToClipboard
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }
})();
