// communicationRoutes.js
const express = require('express');
const auth = require('../middlewares/authMiddleware');
const {
  sendEmailSgrid,
  sendEmailAws,
  sendSmsViaPinpointAws,
  sendNotificationControllerForTesting,
} = require('../controllers/communicationController');

const router = express.Router();

// Route to send email
router.post('/sendEmailSgrid', auth, sendEmailSgrid);
router.post('/sendEmailAws', auth, sendEmailAws);
router.post('/sendOtpPinpoint', auth, sendSmsViaPinpointAws);

// Route to send notification
router.post('/sendNotification', auth, sendNotificationControllerForTesting);

module.exports = router;
