const express = require('express');
const {
getAccountById,createAccount,accountOnBoardingUrl,
attachUserPaymentMethods,
detachUserPaymentMethods,
getUserPaymentMethods,
resendOnbaordAccountMail
} = require('../controllers/accountController');
const auth = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/onboard/:id', accountOnBoardingUrl);
router.use(auth);
router.get('/', createAccount);
router.post('/resend', resendOnbaordAccountMail);
router.get('/user', getAccountById);
router.get('/methods', getUserPaymentMethods);
router.post('/methods', attachUserPaymentMethods);
router.put('/methods', detachUserPaymentMethods);

module.exports = router;
