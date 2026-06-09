import express from "express";
import SearchLog from "../models/SearchLog.js";
import { SecurityLog } from "../models/SecurityLog.js";

const router = express.Router();

router.get("/daily-searches", async (req, res) => {
  try {
    const data = await SearchLog.aggregate([
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          "_id.date": 1
        }
      }
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.get("/security-logs", async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.delete("/security-logs", async (req, res) => {
  try {
    await SecurityLog.deleteMany({});
    res.json({ message: "Security logs cleared successfully." });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

export default router;