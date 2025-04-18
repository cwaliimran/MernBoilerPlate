const express = require('express');
const {
  createReview,
  getReviewsByType,
  updateReviewById,
  deleteReviewById,
  getReviewById,
} = require('../controllers/reviewController');
const auth = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(auth);

// Create a review (for listing or user)
router.post('/', createReview);

// Get all reviews for a specific listing or user
router.get('/:reviewType/:entityId', getReviewsByType);
router.get('/:reviewId', getReviewById);

// Update a review by ID
router.put('/:reviewId', updateReviewById);

// Delete a review by ID
router.delete('/:reviewId', deleteReviewById);

module.exports = router;
