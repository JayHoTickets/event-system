
const User = require('../models/User');
const Venue = require('../models/Venue');
const ServiceCharge = require('../models/ServiceCharge');

const seedData = async () => {
    try {
        // Seed Users
        const adminExists = await User.findOne({ email: 'admin@eventhorizon.com' });
        if (!adminExists) {
            await User.create({
                name: 'System Admin',
                email: 'admin@eventhorizon.com',
                password: 'admin123', // In prod, use bcrypt
                role: 'ADMIN'
            });
            console.log('Admin user created');
        }

        const orgExists = await User.findOne({ email: 'organizer@demo.com' });
        if (!orgExists) {
            await User.create({
                id: 'o1',
                name: 'Demo Organizer',
                email: 'organizer@demo.com',
                password: 'org123',
                role: 'ORGANIZER'
            });
            console.log('Organizer user created');
        }

        const userExists = await User.findOne({ email: 'user@demo.com' });
        if (!userExists) {
            await User.create({
                name: 'Demo User',
                email: 'user@demo.com',
                password: 'user123',
                role: 'USER'
            });
            console.log('Regular user created');
        }

        // Seed Venues
        const venueCount = await Venue.countDocuments();
        if (venueCount === 0) {
            await Venue.insertMany([
                { name: 'Grand Central Hall', address: '123 Broadway', city: 'New York',deleted:false},
                { name: 'Sunset Stadium', address: '456 Coast Blvd', city: 'Los Angeles',deleted:false }
            ]);
            console.log('Venues seeded');
        }

        // Seed Service Charges
        const chargeCount = await ServiceCharge.countDocuments();
        if (chargeCount === 0) {
            await ServiceCharge.insertMany([
                { name: 'Booking Fee', type: 'FIXED', value: 2.00, active: true },
                { name: 'Platform Tax', type: 'PERCENTAGE', value: 2.5, active: true }
            ]);
            console.log('Service charges seeded');
        }

    } catch (error) {
        console.error('Seeding error:', error);
    }
};

module.exports = seedData;
