const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables early
dotenv.config();

// Import Middlewares
const requestContext = require('./middleware/requestContext');
// const authMiddleware = require('./middlewares/auth');

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const productManagementRoutes = require('./routes/productManagementRoutes');
const msgApiRoutes = require('./routes/msgApiRoutes');
const msgSignatureRoutes = require('./routes/msgSignatureRoutes');
const msgContentsRoutes = require('./routes/msgContentsRoutes');
const serviceSwitchingRoutes = require('./routes/serviceSwitchingRoutes');
const msgLogsRoutes = require('./routes/msgLogsController');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(requestContext);

// app.use(authMiddleware); // Protects routes if needed

// API Routes
app.use('/api/v1', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1/product-management', productManagementRoutes);
app.use('/api/v1/msg-apis', msgApiRoutes);
app.use('/api/v1/msg-signatures', msgSignatureRoutes);
app.use('/api/v1/msg-contents', msgContentsRoutes);
app.use('/api/v1/service-switchings', serviceSwitchingRoutes);
app.use('/api/v1/msg-logs', msgLogsRoutes);

// Global Error Handler (Optional but recommended)
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
