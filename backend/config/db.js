
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

function maskUri(uri) {
    try {
        return uri.replace(/(mongodb(?:\+srv)?:\/\/)(.*@)?(.+)/, (m, p1, p2, p3) => p1 + (p2 ? '****@' : '') + p3);
    } catch (e) {
        return uri;
    }
}

let memoryServerInstance = null;

const connectDB = async () => {
    try {
        let uri = (process.env.MONGO_URI || '').trim();
        let usedMemory = false;

        if (!uri) {
            // Start an in-memory MongoDB for development when no MONGO_URI is provided
            console.log('No MONGO_URI provided — starting in-memory MongoDB for development...');
            memoryServerInstance = await MongoMemoryServer.create();
            uri = memoryServerInstance.getUri();
            usedMemory = true;
        }

        if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
            console.warn('Warning: MONGO_URI does not start with a mongodb scheme. Attempting to prepend "mongodb://"');
            uri = 'mongodb://' + uri;
        }

        console.log(`Connecting to MongoDB (${usedMemory ? 'in-memory' : 'MONGO_URI'}): ${maskUri(uri)}`);
        const conn = await mongoose.connect(uri, {
            // recommended mongoose options; keep defaults minimal
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
