const mongoose = require("mongoose");

const damageReportSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "completed"],
            default: "pending",
            required: true,
        },
        completedNote: {
            type: String,
            trim: true,
            default: "",
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null, // Will be filled when the issue is resolved
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);

const ListingDamageReport = mongoose.model("DamageReport", damageReportSchema);

module.exports = ListingDamageReport;
