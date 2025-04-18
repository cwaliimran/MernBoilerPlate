const CreditCard = require("../models/CreditCard");
const { sendResponse, validateParams } = require("../helperUtils/responseUtil");

// Add a new Card
const addCreditCard = async (req, res) => {
  const { _id: userId } = req.user;
  const { name, cardType, cardNumber, cvc, expiry, defaultCard } = req.body;

  const validationOptions = {
    rawData: ["name", "cardType", "cardNumber", "cvc", "expiry", "defaultCard"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    // Check if a card with the same details already exists
    const existingCard = await CreditCard.findOne({ userId, cardNumber });
    if (existingCard) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "card_already",
      });
    }

    // If the card is set as default, update the existing default card for the user
    if (defaultCard) {
      await CreditCard.updateMany({ userId }, { defaultCard: false });
    }

    const newCard = new CreditCard({
      userId,
      name,
      cardType,
      cardNumber,
      cvc,
      expiry,
      defaultCard,
    });

    await newCard.save();
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "card_added",
      data: newCard,
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

// Update Card expiry and default status
const updateCreditCardExpiry = async (req, res) => {
    const { id } = req.params;
    const { expiry, defaultCard } = req.body;

    try {

    const validationOptions = {
      pathParams: ["id"],
      objectIdFields: ["id"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }
        const card = await CreditCard.findById(id);

        if (!card) {
            return sendResponse({
                res,
                statusCode: 404,
                translationKey: "card_not",
            });
        }

        if (expiry) {
            card.expiry = expiry;
        }

        if (defaultCard !== undefined) {
            await CreditCard.updateMany({ userId: card.userId }, { defaultCard: false });
            card.defaultCard = defaultCard;
        }

        await card.save();

        return sendResponse({
            res,
            statusCode: 200,
            translationKey: "card_updated",
            data: card,
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

// Delete a Card
const deleteCreditCard = async (req, res) => {
  const { id } = req.params;


  const validationOptions = {
    pathParams: ["id"],
    objectIdFields: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const card = await CreditCard.findByIdAndDelete(id);

    if (!card) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "card_not",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "card_deleted",
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

// Get all cards by user ID
const getAllCardsByUserId = async (req, res) => {
  const { _id: userId } = req.user;

  try {
    const cards = await CreditCard.find({ userId }).sort({ defaultCard: -1 });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "cards_fetched",
      data: cards,
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

// Get a card by ID
const getCardById = async (req, res) => {
  const { id } = req.params;


  const validationOptions = {
    pathParams: ["id"],
    objectIdFields: ["id"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    const card = await CreditCard.findById(id);

    if (!card) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "card_not",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "card_fetched",
      data: card,
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
  addCreditCard,
  updateCreditCardExpiry,
  deleteCreditCard,
  getAllCardsByUserId,
  getCardById,
};
