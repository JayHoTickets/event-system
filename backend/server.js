
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedData = require('./config/seeder');

const app = express();
const port = process.env.PORT || 5000;

// Connect Database
connectDB().then(() => {
    // Run seeder to ensure default admin/organizer exist
    seedData();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/venues', require('./routes/venueRoutes'));
app.use('/api/theaters', require('./routes/theaterRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/service-charges', require('./routes/serviceChargeRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

// Specific seat route mapping
app.post('/api/seats/hold', require('./controllers/eventController').holdSeat);

app.listen(port, () => {
    console.log(`EventHorizon Server running on http://localhost:${port}`);
});
