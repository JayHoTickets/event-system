
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import seedData from './config/seeder.js';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import { holdSeat } from './controllers/eventController.js';
import venueRoutes from './routes/venueRoutes.js';
import theaterRoutes from './routes/theaterRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import serviceChargeRoutes from './routes/serviceChargeRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import staffRoutes from './routes/staffRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

// Connect Database
connectDB().then(async () => {
    // Run seeder to ensure default admin/organizer exist
    seedData();

    // Start periodic cleanup job to free expired seat holds
        try {
            const { cleanupExpiredHolds } = await import('./controllers/eventController.js');
            // Run immediately, then every minute
            cleanupExpiredHolds();
            setInterval(() => {
                cleanupExpiredHolds();
            }, 60 * 1000);
        } catch (err) {
            console.error('Failed to start cleanup job', err);
        }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/theaters', theaterRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/service-charges', serviceChargeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/staff', staffRoutes);

// Image proxy to avoid cross-origin issues when generating PDFs

app.get('/image-proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing url');
    try {
        const response = await fetch(url);
        if (!response.ok) return res.status(502).send('Failed to fetch image');
        const contentType = response.headers.get('content-type') || 'image/png';
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', contentType);
        // Allow all origins so the frontend can fetch this image
        res.set('Access-Control-Allow-Origin', '*');
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('Proxy error', err);
        res.status(500).send('Proxy error');
    }
});

// Specific seat route mapping
app.post('/api/seats/hold', holdSeat);

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
