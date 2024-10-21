// models/ContactUs.js
const mongoose = require('mongoose');
const validator = require('validator');

const ContactUsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: "",
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
  phoneNumber: {
    type: String,
    trim: true,
    default: "",
  },
  description: {
    type: String,
    required: true,
    trim: true,
    default: "",
  },
  status: {
    type: String,
    enum: ['pending', 'responded', 'resolved', 'closed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

const ContactUs = mongoose.model('ContactUs', ContactUsSchema);

module.exports = ContactUs;
