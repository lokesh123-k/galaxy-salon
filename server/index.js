require('dotenv').config({ path: __dirname + '/.env' });

// Debug: Log environment variables (remove in production)
console.log('[DEBUG] MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'NOT SET');
console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
console.log('[DEBUG] VERCEL:', process.env.VERCEL);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Swagger API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  swaggerOptions: {
    url: '/api-docs/swagger.json',
  },
}));

// API Documentation JSON endpoint
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Routes
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

// Health Check
app.get('/api/health', async (req, res) => {
  // Check if MONGODB_URI is configured
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({ 
      status: 'error', 
      error: 'MONGODB_URI not configured',
      timestamp: new Date().toISOString() 
    });
  }
  
  try {
    // Try to connect to DB if not connected
    if (connectDB && typeof connectDB === 'function') {
      await connectDB();
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'degraded', error: error.message, timestamp: new Date().toISOString() });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Check if running on Vercel (serverless) or local/railway
// Use multiple detection methods
const isVercel = process.env.VERCEL === '1' || 
                  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
                  process.env.VERCEL_ENV !== undefined;

// Also check if we should use serverless mode based on environment
// If NODE_ENV is production and no local port is specified, assume serverless
const isServerlessMode = isVercel || (process.env.NODE_ENV === 'production' && !process.env.LOCAL_DEV);

if (!isServerlessMode) {
  // Connect Database (for local/railway deployment)
  try {
    connectDB();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
  
  // Start Cron Jobs (only for non-serverless)
  try {
    const cronJobs = require('./services/cronJobs');
    cronJobs.start();
  } catch (err) {
    console.log('[CRON] Cron jobs disabled in this environment');
  }
  
  app.listen(PORT, () => {
    console.log(`Galaxy Salon API running on port ${PORT}`);
  });
} else {
  console.log('[SERVERLESS] Running in serverless mode - skipping server listen and cron jobs');
}

module.exports = app;

// Vercel serverless handler
export default async function handler(req, res) {
  console.log('[Vercel] Request received:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,X-Requested-With,Content-Type');
    return res.status(200).json({});
  }

  // Check if environment is configured
  if (!process.env.MONGODB_URI) {
    console.error('[Vercel] MONGODB_URI not configured');
    return res.status(500).json({ error: 'Server misconfiguration: MONGODB_URI not set' });
  }

  // Connect to database lazily for serverless
  try {
    await connectDB();
  } catch (err) {
    console.error('[Vercel] Database connection error:', err.message);
  }
  
  // Let Express handle the request
  return app(req, res);
};
