const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock token for authorization
const token = "your_token_here";

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

// Middleware to check authorization
app.use((req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader === token) {
    next();
  } else {
    res.sendStatus(403);
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
    await order.save();
    res.status(201).json({ message: "Order added successfully", order });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding order", error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
