require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// =======================
// 🔐 Security Middleware
// =======================
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// =======================
// 🚫 Rate Limiting
// =======================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use('/api/', limiter);

// =======================
// 📦 Body Parsing
// =======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =======================
// 📊 Logging
// =======================
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// =======================
// 🌐 ROOT ROUTE (IMPORTANT)
// =======================
app.get('/', (req, res) => {
  res.send('🚀 Galaxy Salon API is running...');
});

// =======================
// 📚 Swagger Docs
// =======================
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// =======================
// 🔗 Routes
// =======================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/students', require('./routes/students'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payment', require('./routes/payment'));

// =======================
// ❤️ Health Check
// =======================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// =======================
// ❌ 404 Handler
// =======================
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

// =======================
// ⚠️ Global Error Handler
// =======================
app.use(errorHandler);

// =======================
// 🚀 START SERVER
// =======================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Debug: Check environment variables
    console.log('[DEBUG] MONGODB_URI set:', !!process.env.MONGODB_URI);
    console.log('[DEBUG] RAILWAY:', process.env.RAILWAY ? 'YES' : 'NO');
    
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI is missing");
      process.exit(1);
    }

    await connectDB(); // MUST CONNECT FIRST

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server failed:", error.message);
    process.exit(1);
  }
};

startServer();