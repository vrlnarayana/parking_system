import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.mongodb_uri;
const DB_NAME = "parking_db";

let db: any;
let client: MongoClient | null = null;

async function connectDB() {
  if (db) return db;
  
  if (!MONGO_URI) {
    console.error("MONGODB_URI is not defined in environment variables");
    throw new Error("MONGODB_URI is missing");
  }

  try {
    if (!client) {
      client = new MongoClient(MONGO_URI);
      await client.connect();
    }
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB successfully");
    
    // Seed Slots if empty
    const slotsCollection = db.collection("slots");
    const count = await slotsCollection.countDocuments();
    if (count === 0) {
      const slots = Array.from({ length: 10 }, (_, i) => ({
        slot_no: `A${i + 1}`,
        status: "Available"
      }));
      await slotsCollection.insertMany(slots);
      console.log("Seeded 10 slots");
    }
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

const app = express();
app.use(express.json());

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error: any) {
    console.error("DB Middleware Error:", error.message);
    res.status(500).json({ error: "Database connection failed: " + error.message });
  }
});

// API Routes
app.get("/api/slots", async (req, res) => {
  try {
    const slotsCollection = db.collection("slots");
    const reservationsCollection = db.collection("reservations");
    
    const slots = await slotsCollection.find().sort({ slot_no: 1 }).toArray();
    
    // Fetch active reservations to attach to slots
    const activeReservations = await reservationsCollection.find({ status: "Active" }).toArray();
    
    const slotsWithReservations = slots.map((slot: any) => {
      const reservation = activeReservations.find((r: any) => r.slot_no === slot.slot_no);
      return {
        ...slot,
        reservation: reservation || null
      };
    });
    
    res.json(slotsWithReservations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

app.get("/api/admin/reservations", async (req, res) => {
  try {
    const reservations = await db.collection("reservations")
      .find({ status: "Active" })
      .sort({ start_time: -1 })
      .toArray();
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

app.get("/api/admin/history", async (req, res) => {
  try {
    const history = await db.collection("reservations")
      .find({ status: "Completed" })
      .sort({ end_time: -1 })
      .limit(20)
      .toArray();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.post("/api/reserve", async (req, res) => {
  const { id } = req.body;
  
  try {
    const slotsCollection = db.collection("slots");
    const reservationsCollection = db.collection("reservations");

    // Check if slot is available
    const slot = await slotsCollection.findOne({ _id: new ObjectId(id), status: "Available" });
    if (!slot) {
      return res.status(400).json({ error: "Slot is not available" });
    }

    // Update slot status
    await slotsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Occupied" } }
    );
    
    // Create reservation
    const reservation = {
      slot_no: slot.slot_no,
      start_time: new Date(),
      status: "Active",
      user_id: "placeholder_user_id"
    };
    await reservationsCollection.insertOne(reservation);

    res.json({ success: true });
  } catch (error) {
    console.error("Reservation error:", error);
    res.status(500).json({ error: "Reservation failed" });
  }
});

app.post("/api/release", async (req, res) => {
  const { id } = req.body;

  try {
    const slotsCollection = db.collection("slots");
    const reservationsCollection = db.collection("reservations");

    // Find the slot first to get slot_no
    const slot = await slotsCollection.findOne({ _id: new ObjectId(id) });
    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    // Update slot status
    await slotsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Available" } }
    );
    
    // Mark reservation as completed
    await reservationsCollection.updateMany(
      { slot_no: slot.slot_no, status: "Active" },
      { $set: { status: "Completed", end_time: new Date() } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Release error:", error);
    res.status(500).json({ error: "Release failed" });
  }
});

app.post("/api/admin/reset", async (req, res) => {
  try {
    const slotsCollection = db.collection("slots");
    const reservationsCollection = db.collection("reservations");
    
    await slotsCollection.deleteMany({});
    await reservationsCollection.deleteMany({});
    
    const slots = Array.from({ length: 10 }, (_, i) => ({
      slot_no: `A${i + 1}`,
      status: "Available"
    }));
    await slotsCollection.insertMany(slots);
    
    res.json({ success: true, message: "System reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Reset failed" });
  }
});

export default app;
