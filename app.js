const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const ping = require("ping");
const net = require("net");

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());

// Secret key for JWT
const jwtSecret = "LOOP-TECHNOLOGY";

// MongoDB connection
mongoose.connect(
  "mongodb+srv://nguyentranhuudangblog:Uit1657421717;@cluster-test.vjuid.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-test",
  {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  }
);

const orderSchema = new mongoose.Schema({
  orderID: String,
  displayID: String,
  driver: {
    ID: Number,
    name: String,
    avatar: String,
  },
  eater: {
    ID: Number,
    name: String,
  },
  itemInfo: {
    count: Number,
    items: [
      {
        itemID: String,
        name: String,
        quantity: Number,
        weight: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  times: {
    createdAt: Date,
    deliveredAt: Date,
    completedAt: Date,
    expiredAt: Date,
    acceptedAt: Date,
    cancelledAt: Date,
    readyAt: Date,
    displayedAt: Date,
    driverArriveRestoAt: Date,
    preparationCompletedAt: Date,
  },
  state: String,
  deliveryTaskpoolStatus: String,
  preparationTaskpoolStatus: String,
  scheduleOrderInfo: {
    isScheduledOrder: Boolean,
    expectedDeliveryTime: Date,
    pickupTime: Date,
  },
  geAllocationStatus: Number,
  busyModeOrderPickupTime: Date,
  orderFlags: Number,
  orderStatsFlags: Number,
  dineInInfo: mongoose.Schema.Types.Mixed,
  labels: {
    acceptedViaCall: Boolean,
    isRead: Boolean,
    isOrderEdited: Boolean,
    acceptedViaAA: Boolean,
    hasPromo: Boolean,
    isTakeawayOrder: Boolean,
    isDeliverByMex: Boolean,
    isBusyModeOrder: Boolean,
    printCount: Number,
    isGiftOrder: Boolean,
  },
  chatroomInfo: {
    roomID: String,
    status: Number,
  },
  mcorInfo: {
    supportMcor: Boolean,
    isEditable: Boolean,
    correctedOrderReadyAt: Date,
    estimatedOrderReadyAt: Date,
    driverCloseToPickingUp: Boolean,
    maxOrderReadyAt: Date,
  },
  orderValue: String,
  preparationTaskID: String,
  flags: {
    isGrabInitiatedSplitOrder: Boolean,
  },
  orderContentMessage: String,
  orderContentMessageWithFormat: String,
  mexOPT: {
    submittedOPTFromMex: Number,
    sourceOPT: Number,
    isPreparationTaskDelayed: Boolean,
    isReadyButtonAbused: Boolean,
    actualOPT: mongoose.Schema.Types.Mixed,
  },
  replacementInfo: mongoose.Schema.Types.Mixed,
});
const Order = mongoose.model("Order", orderSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  grabFoodToken: String,
  grabFoodTokenExpiration: Date,
  shopeeFoodToken: String,
  shopeeFoodTokenExpiration: Date,
  printers: [
    {
      name: String,
      ip: String,
    },
  ],
  expoPushToken: String,
});

const User = mongoose.model("User", userSchema);

// Middleware to check authorization
const checkAuth = (req, res, next) => {
  if (
    req.path === "/auth/login" ||
    req.path === "/auth/login-grabfood" ||
    req.path === "/order-history" ||
    req.path === "/orders" ||
    req.path.startsWith("/order-details/") ||
    req.path === "/scan-printers" ||
    req.path === "/api/token-notification" ||
    req.path === "/api/token-notification-grabfood" ||
    req.path === "/check-orders"
  ) {
    return next();
  }

  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

//app.use(checkAuth);
app.use(cors());

// Hàm kiểm tra cổng của máy in
const checkPrinterPort = (ip, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000); // Timeout sau 2 giây

    socket
      .connect(port, ip, () => {
        socket.destroy();
        resolve(true); // Máy in đang mở cổng
      })
      .on("error", () => {
        socket.destroy();
        resolve(false); // Không kết nối được
      })
      .on("timeout", () => {
        socket.destroy();
        resolve(false); // Timeout
      });
  });
};

// Hàm scan mạng cục bộ để tìm máy in
const scanNetwork = async (baseIP) => {
  const printerPorts = [9100, 515, 631]; // Các cổng phổ biến cho máy in (RAW, LPD, IPP)
  const devices = [];
  const promises = [];

  console.log("Scanning network...");

  for (let i = 1; i <= 255; i++) {
    const ip = `${baseIP}${i}`;
    console.log(`Scanning IP ${ip}...`);
    printerPorts.forEach((port) => {
      promises.push(scanIP(ip, port));
    });
  }

  const results = await Promise.all(promises);

  results.forEach((result) => {
    if (result) {
      devices.push(result);
    }
  });

  return devices;
};

const scanIP = async (ip, printerPort) => {
  try {
    const res = await ping.promise.probe(ip);
    console.log(`IP ${ip} is alive:`, res);
    if (res.alive) {
      const isPrinter = await checkPrinterPort(ip, printerPort);
      if (isPrinter) {
        return { ip, name: `Printer at ${ip}` };
      }
    }
  } catch (error) {
    console.error(`Error scanning IP ${ip}:`, error);
  }
  return null;
};

// API scan máy in
app.get("/scan-printers", async (req, res) => {
  try {
    //console.log("Query:", req);
    const baseIP = req.query.baseIP || "192.168.1.";
    const printers = await scanNetwork(baseIP);
    console.log(printers);
    res.json(printers);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi scan máy in", error });
  }
});

// Route to save Expo push notification token to user's profile
app.post("/api/token-notification", async (req, res) => {
  const { token, username } = req.body;

  try {
    console.log("Token notification request:", req.body);
    const user = await User.findOne({ username });
    if (user) {
      user.expoPushToken = token;
      await user.save();

      res.json({
        message: "Expo push token saved successfully",
        expoPushToken: user.expoPushToken,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error saving Expo push token", error: error.message });
  }
});

// Routes
app.post("/auth/login", async (req, res) => {
  console.log("Login request:", req.body);
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (user) {
      const token = jwt.sign({ username: user.username }, jwtSecret, {
        expiresIn: "24h",
      });
      const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Save token and expiration to user profile
      user.token = token;
      user.tokenExpiration = tokenExpiration;
      await user.save();

      res.json({ message: "Login successful", token, tokenExpiration, user });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

app.post("/auth/login-grabfood", async (req, res) => {
  const { grabFoodToken, grabFoodTokenExpiration, username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user) {
      // Save GrabFood token and expiration to user profile
      user.grabFoodToken = grabFoodToken;
      user.grabFoodTokenExpiration = grabFoodTokenExpiration;
      await user.save();

      res.json({
        message: "GrabFood login successful",
        grabFoodToken,
        grabFoodTokenExpiration,
        user,
      });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error logging in to GrabFood", error: error.message });
  }
});

app.post("/auth/login-shopeefood", async (req, res) => {
  console.log("ShopeeFood login route hit:", req.body);
  const { shopeeFoodToken, shopeeFoodTokenExpiration, username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user) {
      // Save ShopeeFood token and expiration to user profile
      user.shopeeFoodToken = shopeeFoodToken;
      user.shopeeFoodTokenExpiration = shopeeFoodTokenExpiration;
      await user.save();

      res.json({
        message: "ShopeeFood login successful",
        shopeeFoodToken,
        shopeeFoodTokenExpiration,
        user,
      });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error logging in to ShopeeFood",
      error: error.message,
    });
  }
});

app.post("/save-printer", async (req, res) => {
  const { name, ip, username } = req.body;

  console.log("Save printer request:", req.body);

  try {
    const user = await User.findOne({ username });
    if (user) {
      user.printers.push({ name, ip });
      await user.save();

      res.json({
        message: "Printer saved successfully",
        printers: user.printers,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error saving printer", error: error.message });
  }
});

// Routes
app.get("/orders", async (req, res) => {
  const { autoAcceptGroup, pageType, timestamp, grabFoodToken } = req.query;
  const url = `https://api.grab.com/food/merchant/v3/orders-pagination?autoAcceptGroup=${autoAcceptGroup}&pageType=${pageType}&timestamp=${timestamp}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: grabFoodToken,
      },
    });

    // Save orders to MongoDB
    const orders = response.data.orders;
    for (const orderData of orders) {
      const existingOrder = await Order.findOne({ orderID: orderData.orderID });
      if (!existingOrder) {
        const order = new Order({
          ...orderData,
          isNew: true,
          lastStatus: orderData.state,
        });
        await order.save();
      } else {
        existingOrder.isNew = false;
        existingOrder.lastStatus = orderData.state;
        await existingOrder.save();
      }
    }

    res.json(response.data);
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({
      message: "Error fetching orders",
      error: error.message,
    });
  }
});

// Route to check for new and updated orders
app.get("/check-orders", async (req, res) => {
  const grabFoodToken = req.headers["authorization"];
  const url = `https://api.grab.com/food/merchant/v3/orders-pagination?autoAcceptGroup=all&pageType=all`;

  //console.log("Checking for new and updated orders...", req.headers);
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: grabFoodToken,
      },
    });

    const orders = response.data.orders;
    const newOrders = [];
    const updatedOrders = [];

    console.log("Orders:", response);

    for (const orderData of orders) {
      const existingOrder = await Order.findOne({ orderID: orderData.orderID });
      if (!existingOrder) {
        newOrders.push(orderData);
      } else if (existingOrder.lastStatus !== orderData.state) {
        updatedOrders.push(orderData);
      }
    }

    res.json({ newOrders, updatedOrders });
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({
      message: "Error checking orders",
      error: error.message,
    });
  }
});

app.get("/scheduled-orders", (req, res) => {
  res.json({
    message: "Scheduled orders",
    headers: req.headers,
  });
});

app.get("/order-history", async (req, res) => {
  const { startTime, endTime, pageIndex, pageSize, grabFoodToken } = req.query;

  //const url = `https://api.grab.com/food/merchant/v1/reports/daily-pagination?startTime=${startTime}&endTime=${endTime}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
  const url = `https://api.grab.com/food/merchant/v1/reports/daily-pagination?startTime=${startTime}&endTime=${endTime}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
  //const url =
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: grabFoodToken,
      },
    });

    const statements = response.data.statements;
    const detailedOrders = await Promise.all(
      statements.map(async (statement) => {
        const order = await Order.findOne({ orderID: statement.ID });
        return {
          ...statement,
          orderDetails: order,
        };
      })
    );

    res.json({
      ...response.data,
      statements: detailedOrders,
    });
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({
      message: "Error fetching order history",
      error: error.message,
    });
  }
});

// Route to get order details and save to DB
app.get("/order-details/:orderID", async (req, res) => {
  const { orderID, merchantId } = req.params;
  const grabFoodToken = req.headers["authorization"];

  console.log("Order ID:", orderID, "GrabFood token:", grabFoodToken);
  const url = `https://api.grab.com/food/merchant/v3/orders/${orderID}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: grabFoodToken,
        accept: "application/json",
        "accept-language": "en",
        dnt: "1",
        merchantid: "5-CZDKKFMGBCCELE",
        origin: "https://merchant.grab.com",
        priority: "u=1, i",
        referer: "https://merchant.grab.com/",
        requestsource: "troyPortal",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "sec-gpc": "1",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const orderData = response.data.order;
    const order = new Order(orderData);
    //await order.save();

    res.json({ message: "Order details saved successfully", orderData });
  } catch (error) {
    console.log("Error fetching order details:", error.message);
    res.status(error.response ? error.response.status : 500).json({
      message: "Error fetching order details",
      error: error.message,
    });
  }
});

// Route to add a new order
app.post("/add-order", async (req, res) => {
  const newOrder = {
    orderID: "99407613-C65ALZJXRKTDJA",
    displayID: "GF-889",
    driver: {
      ID: 0,
      name: "",
      avatar: "",
    },
    eater: {
      ID: 99407613,
      name: "Nguyễn Đăng",
    },
    itemInfo: {
      count: 1,
      items: [
        {
          itemID: "5-CZDKKFMGBCCELE-CZDKKFMZWCEYSA",
          name: "Cà phê sữa - chai 330ml",
          quantity: 1,
          weight: null,
        },
      ],
    },
    times: {
      createdAt: "2025-01-05T05:45:24Z",
      deliveredAt: "2025-01-05T06:11:58Z",
      completedAt: null,
      expiredAt: "2025-01-05T05:50:24Z",
      acceptedAt: "2025-01-05T05:45:24Z",
      cancelledAt: null,
      readyAt: null,
      displayedAt: "2025-01-05T05:45:24Z",
      driverArriveRestoAt: null,
      preparationCompletedAt: null,
    },
    state: "ORDER_IN_PREPARE",
    deliveryTaskpoolStatus: "",
    preparationTaskpoolStatus: "ACCEPTED",
    scheduleOrderInfo: {
      isScheduledOrder: false,
      expectedDeliveryTime: null,
      pickupTime: null,
    },
    geAllocationStatus: 0,
    busyModeOrderPickupTime: "2025-01-05T05:45:15.053776927Z",
    orderFlags: 4035792614123896836,
    orderStatsFlags: 32,
    dineInInfo: null,
    labels: {
      acceptedViaCall: false,
      isRead: false,
      isOrderEdited: false,
      acceptedViaAA: true,
      hasPromo: false,
      isTakeawayOrder: false,
      isDeliverByMex: false,
      isBusyModeOrder: false,
      printCount: 0,
      isGiftOrder: false,
    },
    chatroomInfo: {
      roomID: "",
      status: 0,
    },
    mcorInfo: {
      supportMcor: false,
      isEditable: false,
      correctedOrderReadyAt: null,
      estimatedOrderReadyAt: "2025-01-05T05:52:07Z",
      driverCloseToPickingUp: false,
      maxOrderReadyAt: "2025-01-05T06:30:24Z",
    },
    orderValue: "75.000",
    preparationTaskID: "99407613-C65ALZJXRKTDJA-PREP-C65ALZJYRXADJA",
    flags: {
      isGrabInitiatedSplitOrder: false,
    },
    orderContentMessage: "Driver should arrive in 25-30 mins",
    orderContentMessageWithFormat:
      '<span style="font-color: FF3D3D3D;font-size: 14sp">Driver should arrive in 25-30 mins</span>',
    mexOPT: {
      submittedOPTFromMex: 403,
      sourceOPT: 0,
      isPreparationTaskDelayed: false,
      isReadyButtonAbused: false,
      actualOPT: null,
    },
    replacementInfo: null,
  };

  try {
    const order = new Order(newOrder);
    console.log("Order:", order);
    await order.save();
    res.status(201).json({ message: "Order added successfully", order });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding order", error: error.message });
  }
});

app.get("/menu", (req, res) => {
  res.json({
    message: "Get menu",
    headers: req.headers,
  });
});

app.get("/open-status", (req, res) => {
  res.json({
    message: "Get open status",
    headers: req.headers,
  });
});

app.get("/open-time", (req, res) => {
  const { isActive, merchantID, name, page, pageSize } = req.query;
  res.json({
    message: "Get open time",
    headers: req.headers,
    query: { isActive, merchantID, name, page, pageSize },
  });
});

app.post("/login", (req, res) => {
  res.json({
    message: "Login",
    headers: req.headers,
    body: req.body,
  });
});

app.post("/logout-step-1", (req, res) => {
  res.json({
    message: "Logout step 1",
    headers: req.headers,
    body: req.body,
  });
});

app.delete("/logout-step-2", (req, res) => {
  res.json({
    message: "Logout step 2",
    headers: req.headers,
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
