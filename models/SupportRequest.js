// models/SupportRequest.js
const mongoose = require('mongoose');
const validator = require('validator');

const supportRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (value) {
        return validator.isEmail(value);
      },
      message: 'Invalid email format.',
    },
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'responded', 'resolved', 'closed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

const SupportRequest = mongoose.model('SupportRequest', supportRequestSchema);

module.exports = SupportRequest;
