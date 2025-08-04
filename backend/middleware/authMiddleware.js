const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) return res.status(401).json({ message: 'User not found' });

    console.log('✅ Authenticated user:', req.user.name); // <-- Add this
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message); // <-- And this
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = authenticate;
