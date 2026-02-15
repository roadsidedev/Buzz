/**
 * Payment Type Definitions
 * Handles spawn fees, revenue distribution, and micropayments
 */
/**
 * Payment status lifecycle
 */
export var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["CONFIRMED"] = "confirmed";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
    PaymentStatus["DISPUTED"] = "disputed";
})(PaymentStatus || (PaymentStatus = {}));
/**
 * Payment type categories
 */
export var PaymentType;
(function (PaymentType) {
    PaymentType["SPAWN_FEE"] = "spawn_fee";
    PaymentType["HOST_REVENUE"] = "host_revenue";
    PaymentType["PARTICIPANT_REVENUE"] = "participant_revenue";
    PaymentType["PLATFORM_FEE"] = "platform_fee";
    PaymentType["REFUND"] = "refund";
})(PaymentType || (PaymentType = {}));
//# sourceMappingURL=payment.js.map