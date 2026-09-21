require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Public Transport Ticketing API is running' });
});

app.use('/api/auth', require('./routes/AuthRoutes'));
app.use('/api/routes', require('./routes/RouteRoutes'));
app.use('/api/trips', require('./routes/TripRoutes'));
app.use('/api/tickets', require('./routes/TicketRoutes'));
app.use('/api/admin', require('./routes/AdminRoutes'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', data: null });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = app;
