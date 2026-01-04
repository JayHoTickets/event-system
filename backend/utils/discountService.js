const mongoose = require('mongoose');

/**
 * Compute discount amount for a single coupon given the context.
 * context: { subtotal: Number, seats: Array<{price,...}>, seatsCount: Number, eventId: String }
 * Returns { discount: Number, usedCountIncrement: Number }
 */
function computeCouponDiscount(coupon, context) {
    const now = new Date();
    if (!coupon || !coupon.active || coupon.deleted) return { discount: 0, usedCountIncrement: 0 };
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) return { discount: 0, usedCountIncrement: 0 };
    const subtotal = context.subtotal || 0;
    const seats = context.seats || [];
    const seatsCount = seats.length || context.seatsCount || 0;

    // Respect maxUses
    if (coupon.maxUses && (coupon.usedCount || 0) >= coupon.maxUses) {
        return { discount: 0, usedCountIncrement: 0 };
    }

    // Helper to apply discountType/value (prefer top-level fields, fall back to legacy ruleParams)
    function applyValue(amountBase) {
        const dType = coupon.discountType || (coupon.ruleParams && coupon.ruleParams.discountType);
        const dValue = (typeof coupon.value === 'number' && coupon.value >= 0) ? coupon.value : (coupon.ruleParams && coupon.ruleParams.value);
        if (dType === 'PERCENTAGE') return amountBase * ((dValue || 0) / 100);
        if (dType === 'FIXED') return Math.min(amountBase, dValue || 0);
        return 0;
    }

    let discount = 0;
    let usedInc = 0;

    switch (coupon.ruleType) {
        case 'THRESHOLD': {
            // prefer explicit field, fall back to ruleParams
            const minAmount = (typeof coupon.minAmount === 'number') ? coupon.minAmount : (coupon.ruleParams && coupon.ruleParams.minAmount) || 0;
            if (subtotal >= minAmount) {
                // apply percent or fixed over subtotal
                discount = applyValue(subtotal);
                usedInc = 1;
            }
            break;
        }
        // EARLY_BIRD rule has been removed. Keep THRESHOLD, SEAT_COUNT and CODE.
        case 'SEAT_COUNT': {
            const minSeats = (typeof coupon.minSeats === 'number') ? coupon.minSeats : (coupon.ruleParams && coupon.ruleParams.minSeats) || 0;
            if (seatsCount >= minSeats) {
                discount = applyValue(subtotal);
                usedInc = 1;
            }
            break;
        }
        case 'CODE':
        default: {
            // CODE type: requires explicit code; compute using discountType/value
            // For safety, apply only if coupon.code was provided in context (context.requestedCode)
            if (context.requestedCode && context.requestedCode === coupon.code) {
                discount = applyValue(subtotal);
                usedInc = 1;
            }
            break;
        }
    }

    // Respect coupon.maxUses limit
    if (coupon.maxUses) {
        const remaining = coupon.maxUses - (coupon.usedCount || 0);
        if (remaining <= 0) return { discount: 0, usedCountIncrement: 0 };
        if (usedInc > remaining) usedInc = remaining;
    }

    // Ensure discount does not exceed subtotal
    discount = Math.max(0, Math.min(discount, subtotal));

    return { discount, usedCountIncrement: usedInc };
}

module.exports = {
    computeCouponDiscount
};
