// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Make sure this path is correct
const authenticate = require("../middleware/authMiddleware");

router.get("/", authenticate, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;
