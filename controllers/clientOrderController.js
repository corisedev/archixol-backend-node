// controllers/clientOrderController.js (Updated to use Order table)
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Customer = require("../models/Customer");
const ClientProfile = require("../models/ClientProfile");
const { encryptData } = require("../utils/encryptResponse");
const sendEmail = require("../utils/email");

// @desc    Place a new order (checkout)
// @route   POST /client/place_order
// @access  Private (Client Only)
exports.placeOrder = async (req, res) => {
  try {
    const clientId = req.user.id;

    const {
      email,
      firstName,
      lastName,
      address,
      apartment,
      city,
      country,
      province,
      postalCode,
      phone,
      shippingMethod,
      discountCode,
      items,
      subtotal,
      shipping,
      tax,
      total,
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !address || !city || !phone) {
      return res.status(400).json({
        error:
          "Required fields missing: email, firstName, lastName, address, city, phone",
      });
    }

    if (!items || !items.length) {
      return res.status(400).json({
        error: "Order must contain at least one item",
      });
    }

    if (!subtotal || !total) {
      return res.status(400).json({
        error: "Subtotal and total are required",
      });
    }

    // Group items by supplier to create separate orders for each supplier
    const supplierGroups = {};
    let totalOrderValue = 0;

    // Validate items and group by supplier
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          error: "Each item must have product_id and valid quantity",
        });
      }

      // Get product details
      const product = await Product.findById(item.product_id);
      if (!product) {
        return res.status(400).json({
          error: `Product not found: ${item.product_id}`,
        });
      }

      if (product.status !== "active") {
        return res.status(400).json({
          error: `Product is not available: ${product.title}`,
        });
      }

      // Check stock if tracking is enabled
      if (product.track_quantity && product.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for product: ${product.title}`,
        });
      }

      const supplierId = product.supplier_id.toString();

      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = {
          supplier_id: supplierId,
          items: [],
          subtotal: 0,
        };
      }

      const itemTotal = product.price * item.quantity;
      totalOrderValue += itemTotal;

      // Convert to Order model format
      supplierGroups[supplierId].items.push({
        product_id: product._id,
        id: product._id, // For compatibility with existing Order model
        title: product.title,
        category: product.category,
        description: product.description,
        price: product.price,
        compare_at_price: product.compare_at_price,
        cost_per_item: product.cost_per_item,
        margin: product.margin,
        profit: product.profit,
        quantity: product.quantity,
        weight: product.weight,
        physical_product: product.physical_product,
        continue_out_of_stock: product.continue_out_of_stock,
        tax: product.tax,
        track_quantity: product.track_quantity,
        variant_option: product.variant_option,
        units: product.units,
        media: product.media,
        qty: item.quantity, // Ordered quantity
      });

      supplierGroups[supplierId].subtotal += itemTotal;
    }

    // // Validate total matches calculated value
    // if (Math.abs(totalOrderValue - subtotal) > 0.01) {
    //   return res.status(400).json({
    //     error: "Subtotal does not match calculated total",
    //   });
    // }

    const createdOrders = [];

    // Create separate orders for each supplier
    for (const [supplierId, orderData] of Object.entries(supplierGroups)) {
      // Calculate proportional shipping and tax for this supplier
      const proportionalShipping =
        (orderData.subtotal / subtotal) * (shipping || 0);
      const proportionalTax = (orderData.subtotal / subtotal) * (tax || 0);
      const orderTotal =
        orderData.subtotal + proportionalShipping + proportionalTax;

      // Create or update customer record for this supplier
      const customer = await createOrUpdateCustomer(clientId, supplierId, {
        email,
        firstName,
        lastName,
        phone,
        address: `${address}${apartment ? `, ${apartment}` : ""}, ${city}, ${
          province ? province + ", " : ""
        }${country} ${postalCode}`,
        orderTotal,
      });

      // Create the order using the existing Order model
      const order = await Order.create({
        supplier_id: supplierId,
        customer_id: customer._id, // Use the customer ID
        products: orderData.items,
        calculations: {
          subtotal: orderData.subtotal,
          discountPercentage: 0,
          taxPercentage:
            proportionalTax > 0
              ? (proportionalTax / orderData.subtotal) * 100
              : 0,
          totalDiscount: 0,
          totalTax: proportionalTax,
          total: orderTotal,
          shippingAddress: `${address}${
            apartment ? `, ${apartment}` : ""
          }, ${city}, ${
            province ? province + ", " : ""
          }${country} ${postalCode}`,
        },
        notes: discountCode ? `Discount code applied: ${discountCode}` : "",
        market_price: "USD", // Default currency
        tags: ["client_order"], // Tag to identify client orders
        channel: "Online Store", // Different from supplier's "Offline Store"
        payment_due_later: shippingMethod === "cash_on_delivery",
        shipping_address: `${address}${
          apartment ? `, ${apartment}` : ""
        }, ${city}, ${province ? province + ", " : ""}${country} ${postalCode}`,
        bill_paid: 0, // Initially not paid
        // Store customer details in notes for easy access
        notes: JSON.stringify({
          customer_details: {
            email,
            firstName,
            lastName,
            phone,
            address,
            apartment,
            city,
            country,
            province,
            postalCode,
            shippingMethod,
            discountCode,
          },
          discount_code: discountCode,
        }),
      });

      // Update product quantities if tracking is enabled
      for (const item of orderData.items) {
        const product = await Product.findById(item.product_id);
        if (product && product.track_quantity) {
          product.quantity = Math.max(0, product.quantity - item.qty);
          await product.save();
        }
      }

      createdOrders.push({
        order_id: order._id,
        order_no: order.order_no,
        supplier_id: supplierId,
        total: orderTotal,
      });
    }

    // Send confirmation email to client
    try {
      await sendOrderConfirmationEmail({
        email,
        firstName,
        lastName,
        orders: createdOrders,
        total: total,
      });
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
      // Don't fail the order placement if email fails
    }

    const responseData = {
      message: "Order placed successfully",
      orders: createdOrders,
      total_orders: createdOrders.length,
      grand_total: total,
    };

    const encryptedData = encryptData(responseData);
    res.status(201).json({ data: encryptedData });
  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get order details
// @route   POST /client/get_order_details
// @access  Private (Client Only)
exports.getOrderDetails = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Find the order
    const order = await Order.findById(order_id)
      .populate("supplier_id", "username email")
      .populate(
        "customer_id",
        "first_name last_name email phone_number default_address"
      );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify this order belongs to a customer created by this client
    const customer = await Customer.findById(order.customer_id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Check if this customer was created by this client
    // We'll use email matching as the verification method
    const clientProfile = await ClientProfile.findOne({ user_id: clientId });
    const user = await User.findById(clientId);
    const clientEmail = user.email;

    // Parse customer details from notes
    let customerDetails = {};
    try {
      const notesData = JSON.parse(order.notes || "{}");
      customerDetails = notesData.customer_details || {};
    } catch (e) {
      // If notes aren't JSON, treat as string
      customerDetails = {};
    }

    // Verify access - either email matches or customer email matches client email
    if (
      customer.email !== clientEmail &&
      customerDetails.email !== clientEmail
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Format the response to match the expected structure
    const orderDetails = {
      order_id: order._id,
      order_no: order.order_no,
      email: customerDetails.email || customer.email,
      firstName: customerDetails.firstName || customer.first_name,
      lastName: customerDetails.lastName || customer.last_name,
      address: customerDetails.address || customer.default_address,
      apartment: customerDetails.apartment || "",
      city: customerDetails.city || "",
      country: customerDetails.country || "United States",
      province: customerDetails.province || "",
      postalCode: customerDetails.postalCode || "",
      phone: customerDetails.phone || customer.phone_number,
      shippingMethod: customerDetails.shippingMethod || "cash_on_delivery",
      discountCode: customerDetails.discountCode || "",
      items: order.products.map((item) => ({
        product_id: item.product_id || item.id,
        title: item.title,
        price: item.price,
        quantity: item.qty,
        total: item.price * item.qty,
        product_details: {
          title: item.title,
          description: item.description,
          media: item.media,
          category: item.category,
        },
      })),
      subtotal: order.calculations.subtotal,
      shipping: order.calculations.shippingAddress ? 0 : 0, // Shipping calculation
      tax: order.calculations.totalTax,
      total: order.calculations.total,
      status: order.status,
      payment_status: order.payment_status ? "paid" : "pending",
      supplier: {
        id: order.supplier_id._id,
        name: order.supplier_id.username,
        email: order.supplier_id.email,
      },
      placed_at: order.createdAt,
      updated_at: order.updatedAt,
    };

    const responseData = {
      message: "Order details retrieved successfully",
      order: orderDetails,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting order details:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Request order return
// @route   POST /client/request_return
// @access  Private (Client Only)
exports.requestReturn = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { order_id, reason } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Find the order
    const order = await Order.findById(order_id)
      .populate("supplier_id", "username email")
      .populate("customer_id", "first_name last_name email");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify client access
    const user = await User.findById(clientId);
    const customer = await Customer.findById(order.customer_id);

    if (customer.email !== user.email) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if order can be returned
    if (order.status === "cancelled" || order.status === "returned") {
      return res.status(400).json({ error: "Order cannot be returned" });
    }

    // Check if order is delivered
    if (order.status !== "delivered") {
      return res.status(400).json({
        error: "Only delivered orders can be returned",
      });
    }

    // Update order status
    order.status = "returned";
    // Store return information in notes
    let notesData = {};
    try {
      notesData = JSON.parse(order.notes || "{}");
    } catch (e) {
      notesData = { original_notes: order.notes };
    }

    notesData.return_requested_at = new Date();
    notesData.return_reason = reason || "";
    order.notes = JSON.stringify(notesData);

    await order.save();

    // Send return request email
    try {
      await sendReturnRequestEmail({
        order,
        customer,
        reason: reason || "No reason provided",
      });
    } catch (emailError) {
      console.error("Failed to send return request email:", emailError);
    }

    const responseData = {
      message: "Return request submitted successfully",
      order_id: order._id,
      return_status: "requested",
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error requesting return:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Cancel order
// @route   POST /client/cancel_order
// @access  Private (Client Only)
exports.cancelOrder = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { order_id, reason } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Find the order
    const order = await Order.findById(order_id)
      .populate("supplier_id", "username email")
      .populate("customer_id", "first_name last_name email");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify client access
    const user = await User.findById(clientId);
    const customer = await Customer.findById(order.customer_id);

    if (customer.email !== user.email) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if order can be cancelled
    if (
      order.status === "shipped" ||
      order.status === "delivered" ||
      order.status === "cancelled"
    ) {
      return res.status(400).json({
        error: "Order cannot be cancelled at this stage",
      });
    }

    // Update order status
    order.status = "cancelled";

    // Store cancellation information in notes
    let notesData = {};
    try {
      notesData = JSON.parse(order.notes || "{}");
    } catch (e) {
      notesData = { original_notes: order.notes };
    }

    notesData.cancelled_at = new Date();
    notesData.cancellation_reason = reason || "";
    order.notes = JSON.stringify(notesData);

    await order.save();

    // Restore product quantities if tracking is enabled
    for (const item of order.products) {
      const product = await Product.findById(item.product_id || item.id);
      if (product && product.track_quantity) {
        product.quantity += item.qty;
        await product.save();
      }
    }

    // Send cancellation email
    try {
      await sendCancellationEmail({
        order,
        customer,
        reason: reason || "No reason provided",
      });
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    const responseData = {
      message: "Order cancelled successfully",
      order_id: order._id,
      cancelled_at: notesData.cancelled_at,
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error cancelling order:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get client checkout details
// @route   GET /client/checkout_details
// @access  Private (Client Only)
exports.getCheckoutDetails = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Get user details
    const user = await User.findById(clientId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get client profile details
    const clientProfile = await ClientProfile.findOne({ user_id: clientId });

    // Get recent orders to prefill some details (from Customer records)
    const recentCustomers = await Customer.find({
      email: user.email,
    })
      .sort({ updatedAt: -1 })
      .limit(1);

    let prefillData = {};

    // Use profile data if available
    if (clientProfile) {
      prefillData = {
        email: user.email,
        firstName: clientProfile.full_name
          ? clientProfile.full_name.split(" ")[0]
          : "",
        lastName: clientProfile.full_name
          ? clientProfile.full_name.split(" ").slice(1).join(" ")
          : "",
        phone: clientProfile.phone_number || "",
        address: clientProfile.address || "",
        city: clientProfile.city || "",
        company_name: clientProfile.company_name || "",
        business_type: clientProfile.business_type || "",
      };
    }

    // If no profile data, try to use recent customer data
    if (recentCustomers.length > 0) {
      const lastCustomer = recentCustomers[0];
      prefillData = {
        email: lastCustomer.email || user.email,
        firstName: lastCustomer.first_name || prefillData.firstName || "",
        lastName: lastCustomer.last_name || prefillData.lastName || "",
        phone: lastCustomer.phone_number || prefillData.phone || "",
        address: lastCustomer.default_address || prefillData.address || "",
        city: prefillData.city || "",
        country: "United States",
        province: "",
        postalCode: "",
      };
    }

    // Default values if nothing is available
    if (!prefillData.email) {
      prefillData.email = user.email;
    }
    if (!prefillData.country) {
      prefillData.country = "United States";
    }

    const responseData = {
      message: "Checkout details retrieved successfully",
      client_details: {
        user_id: user._id,
        username: user.username,
        user_type: user.user_type,
        ...prefillData,
      },
      saved_addresses: [], // You can implement saved addresses feature later
      available_shipping_methods: [
        {
          id: "cash_on_delivery",
          name: "Cash on Delivery",
          description: "Pay when your order is delivered",
          cost: 0,
        },
      ],
    };

    const encryptedData = encryptData(responseData);
    res.status(200).json({ data: encryptedData });
  } catch (err) {
    console.error("Error getting checkout details:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Helper function to create or update customer record
const createOrUpdateCustomer = async (clientId, supplierId, customerData) => {
  try {
    const { email, firstName, lastName, phone, address, orderTotal } =
      customerData;

    // Check if customer already exists for this supplier
    let customer = await Customer.findOne({
      supplier_id: supplierId,
      email: email,
    });

    if (customer) {
      // Update existing customer
      customer.amount_spent += orderTotal;
      customer.orders_count += 1;
      customer.phone_number = phone;
      customer.default_address = address;
      await customer.save();
    } else {
      // Create new customer
      customer = await Customer.create({
        supplier_id: supplierId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phone,
        default_address: address,
        amount_spent: orderTotal,
        orders_count: 1,
        status: "active",
      });
    }

    return customer;
  } catch (error) {
    console.error("Error creating/updating customer:", error);
    throw error;
  }
};

// Helper function to send order confirmation email
const sendOrderConfirmationEmail = async (orderData) => {
  const { email, firstName, lastName, orders, total } = orderData;

  const emailTemplate = `
    <h2>Order Confirmation</h2>
    <p>Dear ${firstName} ${lastName},</p>
    <p>Thank you for your order! We have received your order and it is being processed.</p>
    
    <h3>Order Summary:</h3>
    <ul>
      ${orders
        .map(
          (order) => `
        <li>Order #${order.order_no} - $${order.total.toFixed(2)}</li>
      `
        )
        .join("")}
    </ul>
    
    <p><strong>Total Amount: $${total.toFixed(2)}</strong></p>
    
    <p>You will receive another email once your order has been shipped.</p>
    
    <p>Thank you for shopping with us!</p>
    <p>The Archixol Team</p>
  `;

  await sendEmail({
    email: email,
    subject: "Order Confirmation - Your order has been received",
    message: emailTemplate,
  });
};

// Helper function to send return request email
const sendReturnRequestEmail = async (returnData) => {
  const { order, customer, reason } = returnData;
  const customerEmail = customer.email;
  const supplierEmail = order.supplier_id?.email;

  if (customerEmail) {
    const customerEmailTemplate = `
      <h2>Return Request Received</h2>
      <p>Dear ${customer.first_name},</p>
      <p>We have received your return request for order #${order.order_no}.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>We will review your request and get back to you within 24-48 hours.</p>
      <p>Thank you for your patience.</p>
      <p>The Archixol Team</p>
    `;

    await sendEmail({
      email: customerEmail,
      subject: `Return Request Received - Order #${order.order_no}`,
      message: customerEmailTemplate,
    });
  }

  if (supplierEmail) {
    const supplierEmailTemplate = `
      <h2>Return Request Notification</h2>
      <p>A return request has been submitted for order #${order.order_no}.</p>
      <p><strong>Customer:</strong> ${customer.first_name} ${
      customer.last_name
    }</p>
      <p><strong>Email:</strong> ${customer.email}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Order Total:</strong> $${order.calculations.total.toFixed(
        2
      )}</p>
      <p>Please review and process this return request.</p>
    `;

    await sendEmail({
      email: supplierEmail,
      subject: `Return Request - Order #${order.order_no}`,
      message: supplierEmailTemplate,
    });
  }
};

// Helper function to send cancellation email
const sendCancellationEmail = async (cancellationData) => {
  const { order, customer, reason } = cancellationData;
  const customerEmail = customer.email;
  const supplierEmail = order.supplier_id?.email;

  if (customerEmail) {
    const customerEmailTemplate = `
      <h2>Order Cancellation Confirmation</h2>
      <p>Dear ${customer.first_name},</p>
      <p>Your order #${order.order_no} has been successfully cancelled.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Order Total:</strong> $${order.calculations.total.toFixed(
        2
      )}</p>
      <p>If you paid for this order, your refund will be processed within 3-5 business days.</p>
      <p>Thank you for understanding.</p>
      <p>The Archixol Team</p>
    `;

    await sendEmail({
      email: customerEmail,
      subject: `Order Cancelled - Order #${order.order_no}`,
      message: customerEmailTemplate,
    });
  }

  if (supplierEmail) {
    const supplierEmailTemplate = `
      <h2>Order Cancellation Notification</h2>
      <p>Order #${order.order_no} has been cancelled by the customer.</p>
      <p><strong>Customer:</strong> ${customer.first_name} ${
      customer.last_name
    }</p>
      <p><strong>Email:</strong> ${customer.email}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Order Total:</strong> $${order.calculations.total.toFixed(
        2
      )}</p>
      <p>Please update your inventory accordingly.</p>
    `;

    await sendEmail({
      email: supplierEmail,
      subject: `Order Cancelled - Order #${order.order_no}`,
      message: supplierEmailTemplate,
    });
  }
};
