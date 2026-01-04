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

    // Helper to apply discountType/value
    function applyValue(amountBase) {
        if (coupon.discountType === 'PERCENTAGE') return amountBase * ((coupon.value || 0) / 100);
        if (coupon.discountType === 'FIXED') return Math.min(amountBase, coupon.value || 0);
        // If coupon has ruleParams with discountType override
        if (coupon.ruleParams && coupon.ruleParams.discountType) {
            if (coupon.ruleParams.discountType === 'PERCENTAGE') return amountBase * ((coupon.ruleParams.value || 0) / 100);
            if (coupon.ruleParams.discountType === 'FIXED') return Math.min(amountBase, coupon.ruleParams.value || 0);
        }
        return 0;
    }

    let discount = 0;
    let usedInc = 0;

    switch (coupon.ruleType) {
        case 'THRESHOLD': {
            const minAmount = (coupon.ruleParams && coupon.ruleParams.minAmount) || 0;
            if (subtotal >= minAmount) {
                // apply percent or fixed over subtotal
                if (coupon.ruleParams && coupon.ruleParams.discountType) {
                    if (coupon.ruleParams.discountType === 'PERCENTAGE') {
                        discount = subtotal * ((coupon.ruleParams.value || 0) / 100);
                    } else {
                        discount = Math.min(subtotal, coupon.ruleParams.value || 0);
                    }
                } else {
                    discount = applyValue(subtotal);
                }
                usedInc = 1;
            }
            break;
        }
        case 'EARLY_BIRD': {
            // Applies to first N tickets defined by maxQuantityEligible
            const maxQty = (coupon.ruleParams && coupon.ruleParams.maxQuantityEligible) || 0;
            const alreadyUsed = coupon.usedCount || 0;
            const remainingEligible = Math.max(0, maxQty - alreadyUsed);
            if (remainingEligible <= 0) break;
            const applyCount = Math.min(remainingEligible, seatsCount);
            if (applyCount <= 0) break;

            // Choose seats to apply discount to (use the lowest priced seats? we will apply to the first seats provided)
            const sortedSeats = seats.slice();
            // If seats have price, sort descending to maximize benefit for customer? Typical is apply to cheapest; to be fair apply to cheapest seats
            sortedSeats.sort((a,b)=> (a.price||0)-(b.price||0));
            const seatsToApply = sortedSeats.slice(0, applyCount);
            const amountBase = seatsToApply.reduce((acc, s) => acc + (s.price || 0), 0);
            if (coupon.ruleParams && coupon.ruleParams.discountType === 'PERCENTAGE') {
                discount = amountBase * ((coupon.ruleParams.value || 0) / 100);
            } else if (coupon.ruleParams && coupon.ruleParams.discountType === 'FIXED') {
                // fixed value per ticket or total? support valuePerTicket flag
                if (coupon.ruleParams.valuePerTicket) {
                    discount = Math.min(amountBase, (coupon.ruleParams.value || 0) * applyCount);
                } else {
                    discount = Math.min(amountBase, coupon.ruleParams.value || 0);
                }
            } else {
                // fallback to coupon.discountType/value as percentage over amountBase
                discount = applyValue(amountBase);
            }
            usedInc = applyCount;
            break;
        }
        case 'SEAT_COUNT': {
            const minSeats = (coupon.ruleParams && coupon.ruleParams.minSeats) || 0;
            if (seatsCount >= minSeats) {
                if (coupon.ruleParams && coupon.ruleParams.discountType === 'PERCENTAGE') {
                    discount = subtotal * ((coupon.ruleParams.value || 0) / 100);
                } else if (coupon.ruleParams && coupon.ruleParams.discountType === 'FIXED') {
                    discount = Math.min(subtotal, coupon.ruleParams.value || 0);
                } else {
                    discount = applyValue(subtotal);
                }
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
        // If discount corresponds to per-ticket fixed value and we reduced usedInc, we should adjust discount proportionally
        if (usedInc > 0 && coupon.ruleType === 'EARLY_BIRD' && coupon.ruleParams && coupon.ruleParams.valuePerTicket && coupon.ruleParams.discountType === 'FIXED') {
            discount = Math.min(discount, (coupon.ruleParams.value || 0) * usedInc);
        }
    }

    // Ensure discount does not exceed subtotal
    discount = Math.max(0, Math.min(discount, subtotal));

    return { discount, usedCountIncrement: usedInc };
}

module.exports = {
    computeCouponDiscount
};
