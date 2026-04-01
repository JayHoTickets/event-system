
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'ORGANIZER', 'USER'], default: 'USER' }
    ,
    // Organizer-level complimentary limit (null means no organizer-level limit)
    complimentaryLimit: { type: Number, default: null }
}, {
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            delete ret.password; // Never return password
        }
    },
    toObject: { virtuals: true }
});

export default mongoose.model('User', UserSchema);
