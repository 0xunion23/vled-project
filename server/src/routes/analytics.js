import express from "express";
import SearchLog from "../models/SearchLog.js";

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

export default router;