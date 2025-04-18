const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../helperUtils/responseUtil");
const {
  createStripeAccount,
  accountLink,
  checkAccountCapabilties,
  stripeCustomerByEmail,
  detachPaymentMethodToCustomer,
  attachPaymentMethodToCustomer,
  getPaymentMethods,
  getUserAccount,
} = require("../helperUtils/stripeUtil"); // Import the helper functions
const Accounts = require("../models/Account");
const { stripeEmailTemplate } = require("../helperUtils/emailTemplates");
const { sendEmailViaBrevo } = require("../helperUtils/emailUtil");
const { User } = require("../models/userModel");

// Create a new Stripe account
const createAccount = async (req, res) => {
  try {
    const selectFields =
      "verificationStatus.documents";
    const user = await User.findById(req.user._id).select(selectFields);
    if (user.verificationStatus.documents === "pending") {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "Please submit your documents",
        data: {
          status: "pending",
        },
      });
    }

    const result = await accountOnBoardMail({
      user: req.user,
      sendOnlyMail: false,
    });

    if (result.user) {
      if (result.user.verificationStatus.documents === "pending") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "Please submit your documents",
          data: {
            status: "pending",
          },
        });
      } else if (result.user.verificationStatus.documents === "submitted") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey:
            "Your documents verification is pending, we will notify you once its status is updated",
          data: {
            status: "submitted",
          },
        });
      } else if (result.user.verificationStatus.documents === "rejected") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey:
            "Your documents have been rejected due to " +
            result.user.documents.rejectionReason,
          data: {
            status: "rejected",
            resaon: result.user.documents.rejectionReason,
          },
        });
      } else if (result.user.verificationStatus.documents === "verified") {
        return sendResponse({
          res,
          statusCode: 200,
          translationKey:
            "Your documents have been verified and your account is active",
          data: {
            status: "verified",
          },
        });
      }
    }

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "account_created",
      data: {
        status: "newAccount",
        onBoardUrl: result.acclink.url,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: error.statusCode || 400,
      translationKey: error.translationKey || "server_error",
      error,
    });
  }
};
const accountOnBoardMail = async ({ user, sendOnlyMail }) => {
  const { _id, email, name } = user;

  let existingAccount = await getUserAccount({ userId: _id });
  if (existingAccount) {
    //account found
    //account found and onboarded on stripe
    if (existingAccount.isActive) {
      //check if user documents are approved
      const selectFields =
        "verificationStatus.documents documents.rejectionReason";
      const user = await User.findById(_id).select(selectFields);
      return { account: existingAccount, user };
    }
    //   throw { statusCode: 400, translationKey: "account_already_exists" };

    //account found but not onboarded on stripe
    //send onboarding link
    let acclink = await accountLink(existingAccount.accountId);
    return { account: existingAccount, acclink };
  }

  //create account on stripe
  const { account } = await createStripeAccount("", email);
  await Accounts.create({ user: _id, accountId: account.id });

  let acclink = await accountLink(account.id);
  return { account, acclink };
};

const accountOnBoardingUrl = async (req, res) => {
  try {
    const { id } = req.params;
    let acclink = await accountLink(id);
    return res.redirect(acclink.url);
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "server_error",
      error,
    });
  }
};
const getAccountById = async (req, res) => {
  try {
    const { id } = req.query;
    const userId = req.user._id;
    let account = await Accounts.findOne({
      ...(id ? { _id: id } : {}),
      user: userId,
    });
    if (!account) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "account_not_found",
      });
    }

    if (process.env.STRIPE_SECRET_KEY_LIVE?.includes("test")) {
      if (!account.isActive) {
        account.isActive = true;
        await account.save();
      }
    } else {
      account.isActive = await checkAccountCapabilties(account.accountId);
      await account.save();
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "account_fetch",
      data: account,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "server_error",
      error,
    });
  }
};
const getUserPaymentMethods = async (req, res) => {
  try {
    const { email } = req.user;
    const methods = email && (await getPaymentMethods({ email }));
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "fetch_success",
      data: methods || [],
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "fetching_failed",
      error,
    });
  }
};
const attachUserPaymentMethods = async (req, res) => {
  try {
    let { name, email } = req.user;
    const { paymentMethodId } = req.body;
    const customer = await stripeCustomerByEmail({ name, email });
    const methods = await attachPaymentMethodToCustomer({
      customerId: customer.id,
      name,
      email,
      paymentMethodId,
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "added_success",
      data: methods || [],
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "adding_failed",
    });
  }
};
const detachUserPaymentMethods = async (req, res) => {
  try {
    let { name, email } = req.user;
    let { paymentMethodId } = req.body;
    const customer = await stripeCustomerByEmail({ name, email });
    const methods = await detachPaymentMethodToCustomer({
      customer: customer,
      paymentMethodId,
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "update_success",
      data: methods || [],
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "update_failed",
      error,
    });
  }
};

const resendOnbaordAccountMail = async (req, res) => {
  try {
    const result = await accountOnBoardMail({
      user: req.user,
      sendOnlyMail: true,
    });
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "stripe_onboard_mail",
      data: result.account,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: error.statusCode || 400,
      translationKey: error.translationKey || "server_error",
      error,
    });
  }
};

module.exports = {
  createAccount,
  getAccountById,
  accountOnBoardingUrl,
  getUserPaymentMethods,
  attachUserPaymentMethods,
  detachUserPaymentMethods,
  accountOnBoardMail,
  resendOnbaordAccountMail,
};
