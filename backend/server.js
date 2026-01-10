
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedData = require('./config/seeder');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Connect Database
connectDB().then(() => {
    // Run seeder to ensure default admin/organizer exist
    seedData();

    // Start periodic cleanup job to free expired seat holds
    try {
        const eventController = require('./controllers/eventController');
        // Run immediately, then every minute
        eventController.cleanupExpiredHolds();
        setInterval(() => {
            eventController.cleanupExpiredHolds();
        }, 60 * 1000);
    } catch (err) {
        console.error('Failed to start cleanup job', err);
    }
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

// Serve frontend static files (if built) and provide SPA fallback for client-side routes
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    // Don't try to serve index.html for API routes
    if (req.path.startsWith('/api')) return res.status(404).end();
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`EventHorizon Server running on http://localhost:${port}`);
});
