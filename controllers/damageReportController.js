const ListingDamageReport = require("../models/DamageReport");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const Booking = require("../models/Booking");

// Create a new listing damage report
const createListingDamageReport = async (req, res) => {
  const { _id: reportedBy } = req.user;
  const { booking, description } = req.body;

  const validationOptions = {
    rawData: ["booking", "description"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    // Verify if booking exists
    const bookingData = await Booking.findById(booking);
    if (!bookingData) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "booking_not",
      });
    }
    // Check if renter id is equal to reportedBy id
    if (bookingData.renter.toString() !== reportedBy.toString()) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "reported_by",
      });
    }

    const newReport = new ListingDamageReport({
      booking,
      description,
      reportedBy,
      status: "pending", // Set default status to pending
    });

    await newReport.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "listing_damage",
      data: newReport,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get listing damage reports with filtering by user ID and status
const getListingDamageReports = async (req, res) => {
  const { _id: reportedBy } = req.user;
  try {
    const { page, limit } = parsePaginationParams(req);
    const { status } = req.query;

    // Validate query parameters
    const validationOptions = {
      queryParams: ["status"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return; // Invalid query parameters
    }

    const query = {};
    query.reportedBy = reportedBy;
    query.status = status;

    let [reports, totalRecords] = await Promise.all([
      ListingDamageReport.find(query)
        .populate({
          path: "booking",
        })
        .populate("reportedBy", "name profileIcon")
        .populate("resolvedBy", "name profileIcon")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ListingDamageReport.countDocuments(query),
    ]);
    const meta = generateMeta(page, limit, totalRecords);

    // reports[0].toObject()
    // reports = reports.map((report) => {
    //   if (report.booking) {
    //     let booking = new Booking(report.booking);
    //     console.log(booking);
    //     report.booking = booking.toJSON();
    //   }
    //   return {
    //     ...report,
    //   };
    // });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_damage_1",
      data: reports,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};
// Get listing damage reports with filtering by user ID and status
const getAllListingDamageReports = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const { reportedBy, status } = req.query;

    // Validate query parameters
    const validationOptions = {
      queryParams: [],
    };

    if (reportedBy) validationOptions.queryParams.push("reportedBy");
    if (status) validationOptions.queryParams.push("status");

    if (!validateParams(req, res, validationOptions)) {
      return; // Invalid query parameters
    }

    const query = {};
    if (reportedBy) {
      query.reportedBy = reportedBy;
    }
    if (status) {
      query.status = status;
    }

    const [reports, totalRecords] = await Promise.all([
      ListingDamageReport.find(query)
        .populate("booking")
        .populate("reportedBy", "name profileIcon")
        .populate("resolvedBy", "name profileIcon")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ListingDamageReport.countDocuments(query),
    ]);

    const meta = generateMeta(page, limit, totalRecords);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_damage_1",
      data: reports,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Get listing damage report details by ID
const getListingDamageReportDetails = async (req, res) => {
  const { id } = req.params;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const report = await ListingDamageReport.findById(id)
      .populate("booking")
      .populate("reportedBy", "name profileIcon")
      .populate("resolvedBy", "name profileIcon");

    if (!report) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_damage_2",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_damage_3",
      data: report,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Update listing damage report (Admin)
const updateListingDamageReport = async (req, res) => {
  const { id } = req.params;
  const { _id: resolvedBy } = req.user;
  const { status, completedNote } = req.body;

  const validationOptions = {
    pathParams: ["id"],
    rawData: ["status", "completedNote"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const report = await ListingDamageReport.findById(id);

    if (!report) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_damage_2",
      });
    }

    report.status = status || report.status;
    report.completedNote = completedNote || report.completedNote;
    report.resolvedBy = resolvedBy || report.resolvedBy;

    await report.save();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_damage_4",
      data: report,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

// Delete listing damage report (Admin)
const deleteListingDamageReport = async (req, res) => {
  const { id } = req.params;

  const validationOptions = {
    pathParams: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const report = await ListingDamageReport.findById(id);

    if (!report) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "listing_damage_2",
      });
    }

    await report.deleteOne();
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "listing_damage_5",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

module.exports = {
  createListingDamageReport,
  getListingDamageReports,
  updateListingDamageReport,
  deleteListingDamageReport,
  getAllListingDamageReports,
  getListingDamageReportDetails,
};
