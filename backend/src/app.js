require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV !== 'production') allowedOrigins.push('http://localhost:5173');

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '32kb' }), require('./controllers/PaymentController').webhook);
app.use(express.json({ limit: '32kb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests', data: null })
}));

for (const path of ['login', 'register', 'forgot-password', 'reset-password']) {
  app.use(`/api/auth/${path}`, rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests', data: null })
  }));
}

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Public Transport Ticketing API is running', data: null });
});

app.get('/health', (req, res) => {
  const readyState = mongoose.connection.readyState;
  res.status(readyState === 1 ? 200 : 503).json({
    success: readyState === 1,
    message: readyState === 1 ? 'Service is healthy' : 'Database is unavailable',
    data: { database: readyState === 1 ? 'connected' : 'disconnected' }
  });
});

app.use('/api/auth', require('./routes/AuthRoutes'));
app.use('/api/routes', require('./routes/RouteRoutes'));
app.use('/api/trips', require('./routes/TripRoutes'));
app.use('/api/tickets', require('./routes/TicketRoutes'));
app.use('/api/payments', require('./routes/PaymentRoutes'));
app.use('/api/admin', require('./routes/AdminRoutes'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', data: null });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    require('./services/paymentService').startExpiryJob();
    require('./services/tripReminderService').startReminderJob();
    require('./services/tripReminderService').startReminderJob();
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    process.once('SIGTERM', () => {
      server.close(async () => {
        require('./services/paymentService').stopExpiryJob();
        require('./services/tripReminderService').stopReminderJob();
        require('./services/tripReminderService').stopReminderJob();
        await mongoose.disconnect();
        process.exit(0);
      });
    });
  });
}

module.exports = app;
