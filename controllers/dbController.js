// controllers/bulkInsertController.js
const { bulkInsert, deleteCollection } = require("../helperUtils/dbUtils");
const { sendResponse } = require("../helperUtils/responseUtil");

// Controller function to handle bulk insertion
const bulkInsertHandler = async (req, res) => {
  const { values, collectionName } = req.body;

  if (!values || !Array.isArray(values) || values.length === 0) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Values array is required and must not be empty",
      translateMessage: false,
    });
  }

  if (!collectionName) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Collection name is required",
      translateMessage: false,
    });
  }

  try {
    const result = await bulkInsert(values, collectionName);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: `Inserted ${result.length} documents into ${collectionName} collection`,
      data: result,
    });
  } catch (error) {
    console.error(error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error during bulk insertion",
      error,
    });
  }
};

// Controller function to handle collection deletion
const deleteCollectionHandler = async (req, res) => {
  const { collectionName } = req.body;

  if (!collectionName) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "Collection name is required",
      translateMessage: false,
    });
  }

  try {
    const result = await deleteCollection(collectionName);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: `Deleted all documents from ${collectionName} collection`,
      data: result,
    });
  } catch (error) {
    console.error(error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "Error during collection deletion",
      error,
    });
  }
};

module.exports = {
  deleteCollectionHandler,
  bulkInsertHandler,
};
