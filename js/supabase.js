// MONDO Cafe - Supabase Integration Module
// Handles real-time database operations, cloud sync, orders, menu CRUD and resilient fallback

(function() {
  const SUPABASE_URL = "https://qgyoekfgdglitxslllry.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFneW9la2ZnZGdsaXR4c2xsbHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODMxMzYsImV4cCI6MjEwNjE1OTEzNn0.jTJTINc1saXf2_jHet3fF0IsN1diGz254QnR-wqg97M";

  let client = null;
  let isSupabaseAvailable = false;
  let menuTableExists = false;
  let ordersTableExists = false;

  // Initialize Supabase Client
  function initSupabase() {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: false
          }
        });
        isSupabaseAvailable = true;
        console.log("🌸 [MONDO] Supabase client initialized successfully.");
      } catch (err) {
        console.warn("⚠️ [MONDO] Error initializing Supabase client:", err);
        isSupabaseAvailable = false;
      }
    } else {
      console.warn("⚠️ [MONDO] Supabase library not loaded yet.");
      isSupabaseAvailable = false;
    }
  }

  // Check health and existing tables
  async function checkHealth() {
    if (!client) initSupabase();
    const status = {
      clientReady: !!client,
      menuTable: false,
      ordersTable: false,
      message: "Checking..."
    };

    if (!client) {
      status.message = "Supabase SDK not loaded";
      return status;
    }

    try {
      // Test menu table
      const { data: menuData, error: menuErr } = await client
        .from('mondo_menu')
        .select('id')
        .limit(1);

      if (!menuErr) {
        menuTableExists = true;
        status.menuTable = true;
      } else {
        menuTableExists = false;
      }

      // Test orders table
      const { data: orderData, error: orderErr } = await client
        .from('mondo_orders')
        .select('id')
        .limit(1);

      if (!orderErr) {
        ordersTableExists = true;
        status.ordersTable = true;
      } else {
        ordersTableExists = false;
      }

      if (status.menuTable && status.ordersTable) {
        status.message = "Supabase Cloud Active & Live";
      } else if (!status.menuTable && !status.ordersTable) {
        status.message = "Supabase Connected • Schema Ready to Execute";
      } else {
        status.message = "Supabase Partially Configured";
      }
    } catch (err) {
      console.warn("Health check exception:", err);
      status.message = "Connection issue: " + err.message;
    }

    return status;
  }

  // --- MENU OPERATIONS ---

  // Fetch all menu items
  async function getMenuItems() {
    if (!client) initSupabase();

    if (client) {
      try {
        const { data, error } = await client
          .from('mondo_menu')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          menuTableExists = true;
          // Sync to localStorage as backup
          localStorage.setItem('mondo_cached_menu', JSON.stringify(data));
          return data;
        } else if (error) {
          console.warn("mondo_menu table query returned:", error.message);
        }
      } catch (err) {
        console.warn("Failed to fetch from Supabase:", err);
      }
    }

    // Ensure cache is reset for clean slate
    if (!localStorage.getItem('mondo_clean_start_v2')) {
      localStorage.removeItem('mondo_cached_menu');
      localStorage.setItem('mondo_clean_start_v2', 'true');
    }

    // Fallback: check localStorage, otherwise use window.DEFAULT_MENU
    const cached = localStorage.getItem('mondo_cached_menu');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }

    // Initialize cache with empty list
    localStorage.setItem('mondo_cached_menu', JSON.stringify([]));
    return [];
  }

  // Add a new item to menu
  async function addMenuItem(item) {
    if (!client) initSupabase();

    // Prepare payload
    const newItem = {
      name: item.name,
      category: item.category,
      price: Number(item.price),
      description: item.description || "",
      image_url: item.image_url || "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
      badge_tag: item.badge_tag || null,
      calories: item.calories || null,
      is_available: item.is_available !== false
    };

    let savedItem = null;

    if (client && menuTableExists) {
      try {
        const { data, error } = await client
          .from('mondo_menu')
          .insert([newItem])
          .select()
          .single();

        if (!error && data) {
          savedItem = data;
        } else {
          console.warn("Supabase insert error:", error);
        }
      } catch (e) {
        console.warn("Exception inserting to Supabase:", e);
      }
    }

    // Always update local cache for instant UI feedback
    if (!savedItem) {
      savedItem = {
        id: "local-" + Date.now(),
        ...newItem,
        created_at: new Date().toISOString()
      };
    }

    const currentMenu = await getMenuItems();
    const updated = [...currentMenu, savedItem];
    localStorage.setItem('mondo_cached_menu', JSON.stringify(updated));

    return savedItem;
  }

  // Update an existing menu item
  async function updateMenuItem(id, updates) {
    if (!client) initSupabase();

    if (client && menuTableExists) {
      try {
        const { data, error } = await client
          .from('mondo_menu')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) console.warn("Supabase update error:", error);
      } catch (e) {
        console.warn("Exception updating Supabase item:", e);
      }
    }

    // Update local cache
    const currentMenu = await getMenuItems();
    const updated = currentMenu.map(item => item.id == id ? { ...item, ...updates } : item);
    localStorage.setItem('mondo_cached_menu', JSON.stringify(updated));

    return updated.find(item => item.id == id);
  }

  // Delete a menu item
  async function deleteMenuItem(id) {
    if (!client) initSupabase();

    if (client && menuTableExists) {
      try {
        const { error } = await client
          .from('mondo_menu')
          .delete()
          .eq('id', id);

        if (error) console.warn("Supabase delete error:", error);
      } catch (e) {
        console.warn("Exception deleting Supabase item:", e);
      }
    }

    const currentMenu = await getMenuItems();
    const updated = currentMenu.filter(item => item.id != id);
    localStorage.setItem('mondo_cached_menu', JSON.stringify(updated));

    return true;
  }

  // Seed authentic menu to Supabase
  async function seedSupabaseMenu() {
    if (!client) initSupabase();
    if (!client) return { success: false, message: "Supabase client not initialized" };

    const itemsToSeed = (window.DEFAULT_MENU || []).map(item => ({
      name: item.name,
      category: item.category,
      price: Number(item.price),
      description: item.description,
      image_url: item.image_url,
      badge_tag: item.badge_tag || null,
      calories: item.calories || null,
      is_available: true
    }));

    if (itemsToSeed.length === 0) {
      return { success: false, message: "Default dummy dishes are removed. Use the '+ Add New Dish or Drink' button in Menu Manager to add your own dishes!" };
    }

    try {
      const { data, error } = await client
        .from('mondo_menu')
        .insert(itemsToSeed)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      menuTableExists = true;
      if (data && data.length > 0) {
        localStorage.setItem('mondo_cached_menu', JSON.stringify(data));
      }
      return { success: true, count: data ? data.length : 0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- ORDER OPERATIONS ---

  // Create a new order
  async function createOrder(orderPayload) {
    if (!client) initSupabase();

    const orderCode = "MND-" + Math.floor(100000 + Math.random() * 900000);

    const record = {
      order_code: orderCode,
      customer_name: orderPayload.name,
      customer_phone: orderPayload.phone,
      order_type: orderPayload.orderType || 'delivery',
      delivery_address: orderPayload.address || null,
      table_number: orderPayload.tableNumber || null,
      special_notes: orderPayload.notes || null,
      items: orderPayload.items || [],
      subtotal: Number(orderPayload.subtotal || 0),
      delivery_fee: Number(orderPayload.deliveryFee || 0),
      discount: Number(orderPayload.discount || 0),
      total_amount: Number(orderPayload.total || 0),
      payment_method: orderPayload.paymentMethod || 'cash_on_delivery',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    let savedOrder = null;

    if (client && ordersTableExists) {
      try {
        const { data, error } = await client
          .from('mondo_orders')
          .insert([record])
          .select()
          .single();

        if (!error && data) {
          savedOrder = data;
        } else {
          console.warn("Supabase order insert error:", error);
        }
      } catch (e) {
        console.warn("Exception saving order to Supabase:", e);
      }
    }

    if (!savedOrder) {
      savedOrder = {
        id: "order-" + Date.now(),
        ...record
      };
    }

    // Save to local orders list
    const existingOrders = getLocalOrders();
    const updatedOrders = [savedOrder, ...existingOrders];
    localStorage.setItem('mondo_cached_orders', JSON.stringify(updatedOrders));

    return savedOrder;
  }

  // Fetch orders (for Admin Panel)
  async function getOrders() {
    if (!client) initSupabase();

    if (client) {
      try {
        const { data, error } = await client
          .from('mondo_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          ordersTableExists = true;
          // Merge with any local orders
          const local = getLocalOrders();
          const merged = [...data];
          for (const loc of local) {
            if (!merged.find(m => m.order_code === loc.order_code)) {
              merged.push(loc);
            }
          }
          localStorage.setItem('mondo_cached_orders', JSON.stringify(merged));
          return merged;
        }
      } catch (e) {
        console.warn("Orders fetch exception:", e);
      }
    }

    return getLocalOrders();
  }

  function getLocalOrders() {
    const raw = localStorage.getItem('mondo_cached_orders');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  // Update order status (Pending -> Brewing -> Ready -> Completed)
  async function updateOrderStatus(orderId, newStatus) {
    if (!client) initSupabase();

    if (client && ordersTableExists) {
      try {
        const { data, error } = await client
          .from('mondo_orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (error) console.warn("Supabase order status update error:", error);
      } catch (e) {
        console.warn("Exception updating order in Supabase:", e);
      }
    }

    // Update local cache
    const currentOrders = getLocalOrders();
    const updated = currentOrders.map(o => (o.id == orderId || o.order_code == orderId) ? { ...o, status: newStatus } : o);
    localStorage.setItem('mondo_cached_orders', JSON.stringify(updated));

    return true;
  }

  // Expose global database interface
  window.MondoDB = {
    init: initSupabase,
    checkHealth: checkHealth,
    getMenuItems: getMenuItems,
    addMenuItem: addMenuItem,
    updateMenuItem: updateMenuItem,
    deleteMenuItem: deleteMenuItem,
    seedSupabaseMenu: seedSupabaseMenu,
    createOrder: createOrder,
    getOrders: getOrders,
    updateOrderStatus: updateOrderStatus,
    isAvailable: () => isSupabaseAvailable,
    hasMenuTable: () => menuTableExists,
    hasOrdersTable: () => ordersTableExists,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
  };

  // Attempt auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSupabase();
      checkHealth();
    });
  } else {
    initSupabase();
    checkHealth();
  }
})();
