import User from '../models/User.js';
import Venue from '../models/Venue.js';
import ServiceCharge from '../models/ServiceCharge.js';

const seedData = async () => {
    try {
        // Seed Users
        const adminExists = await User.findOne({ email: 'admin@jayhoticket.com' });
        if (!adminExists) {
            await User.create({
                name: 'System Admin',
                email: 'jayho@jay-ho.com',
                password: 'Jay-Ho!123', // In prod, use bcrypt
                role: 'ADMIN'
            });
            console.log('Admin user created');
        }

        const orgExists = await User.findOne({ email: 'organizer@demo.com' });
        if (!orgExists) {
            await User.create({
                id: 'o1',
                name: 'Raj',
                email: 'raj@jayhoshow.com',
                password: 'Jay-Ho!123',
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
                { name: 'Grand Central Hall', address: '123 Broadway', city: 'New York', state: 'NY', zipCode: '10001', country: 'USA', deleted: false },
                { name: 'Sunset Stadium', address: '456 Coast Blvd', city: 'Los Angeles', state: 'CA', zipCode: '90001', country: 'USA', deleted: false }
            ]);
            console.log('Venues seeded');
        }

        // Seed Service Charges
        const chargeCount = await ServiceCharge.countDocuments();
        if (chargeCount === 0) {
            await ServiceCharge.insertMany([
                { name: 'Booking Fee', type: 'FIXED', value: 2.00, level: 'DEFAULT', active: true, paymentModes: ['ONLINE','CASH'] },
                { name: 'Platform Tax', type: 'PERCENTAGE', value: 2.5, level: 'DEFAULT', active: true, paymentModes: ['ONLINE','CASH'] }
            ]);
            console.log('Service charges seeded');
        }

    } catch (error) {
        console.error('Seeding error:', error);
    }
};

export default seedData;
