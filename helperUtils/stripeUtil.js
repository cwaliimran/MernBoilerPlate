const Account = require("../models/Account");

// helper for stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_LIVE);

async function stripeCustomerByEmail({ name, email }) {
  try {
    if (!email) return null;
    let customer = null;
    const customers = await stripe.customers.list({ email: email });
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        name: name || "",
        email: email,
      });
    }
    return customer;
  } catch (error) {
    throw new Error(`Error in stripe customer: ${error.message}`);
  }
}
async function getPaymentMethods({ email }) {
  try {
    if (!email) return null;
    let customer = await stripeCustomerByEmail({ email });
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      // type:'card'
    });
    return paymentMethods.data;
  } catch (error) {
    throw new Error(`Error in getting payment Methods: ${error.message}`);
  }
}
const createStripeAccount = async (country, email, name) => {
  try {
    const account = await stripe.accounts.create({
      type: "standard", // Standard account type
      country: country || "US",
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return { account };
  } catch (err) {
    throw new Error(err.message);
  }
};
async function accountLink(id, _id) {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: id,
      refresh_url: `https://myborrowapp.com/api/accounts/onboard/${id}`,
      return_url: `https://myborrowapp.com/`,
      type: "account_onboarding",
    });
    return accountLink;
  } catch (error) {
    throw error;
  }
}
async function enableTransfer(accountId) {
  try {
    const customer = await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
    });
    return customer;
  } catch (error) {
    // console.error('Error creating customer:', error);
    throw error;
  }
}
async function checkAccountCapabilties(accountId) {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (
      account?.payouts_enabled === true ||
      account?.capabilities?.card_payments === "active" ||
      account?.capabilities?.transfers === "active"
    ) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error creating customer:", error);
    // throw error;
  }
}
async function createPaymentIntent({
  amount,
  email,
  destinationAccountId,
  payment_method,
  currency,
  capture_method,
}) {
  try {
    if (!payment_method || !payment_method.startsWith("pm_")) {
     throw new Error("Invalid payment method ID");
    }
    const convertedAmount = Math.round(amount * 100);
    const fee_amount = Math.round(convertedAmount * 0.1);
    const customer = await stripeCustomerByEmail({ email });
    await attachPaymentMethodToCustomer({
      customerId: customer.id,
      paymentMethodId: payment_method,
    });

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: convertedAmount, // Use the converted amount
      currency: currency || "USD",
      customer: customer.id,
      payment_method,
      off_session: true,
      confirm: true,
      payment_method_types: ["card", "link"],
      capture_method: capture_method || "automatic",
      application_fee_amount: fee_amount, // Use calculated fee amount
      transfer_data: {
        destination: destinationAccountId,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Error creating payment intent:", error);
    throw new Error(error.message);
  }
}
async function attachPaymentMethodToCustomer({ customerId, paymentMethodId,name, email }) {
  try {
    if (!paymentMethodId || !paymentMethodId.startsWith("pm_")) {
      throw new Error("Invalid payment method ID");
    }
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
      
    });
    if (name || email) {
      await stripe.paymentMethods.update(paymentMethodId, {
        billing_details: {
          name: name || null,
          email: email || null,
        },
      });
    }
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      // type:'card'
    });
    return paymentMethods.data;
  } catch (error) {
    console.log('Error in attachPaymentMethodToCustomer:', error.message);
    throw new Error(error.message);
  }
}
async function detachPaymentMethodToCustomer({ customer, paymentMethodId }) {
  try {
    if (!paymentMethodId || !paymentMethodId.startsWith("pm_")) {
      throw new Error("Invalid payment method ID");
    }

    // Unset default payment method if it matches the one being detached
    if (customer.invoice_settings.default_payment_method === paymentMethodId) {
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: null,
        },
      });
    }

    // Detach the payment method
    const detachedMethod = await stripe.paymentMethods.detach(paymentMethodId);

    console.log("Detached payment method:", detachedMethod.id);

    // Retrieve remaining payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      // type: "card",
    });

    return paymentMethods.data; // Return remaining payment methods
  } catch (error) {
    console.error("Error detaching payment method:", error.message);
    throw new Error(error.message); // Rethrow the error for higher-level handling
  }
}

const manualPayment = async ({ paymentMethodId, user, amount, currency }) => {
  try {
    const { name, email } = user;
    const customer = await stripeCustomerByEmail({ name, email });
    await attachPaymentMethodToCustomer({
      customerId: customer.id,
      paymentMethodId,
    });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency || "USD",
      customer: customer.id,
      confirm: true,
      payment_method: paymentMethodId,
      return_url: process.env.RETURNURL,
    });
    if (paymentIntent.status === "succeeded") {
      return paymentIntent;
    } else {
      throw new Error("Payment failed");
    }
  } catch (error) {
    throw error;
  }
};
const refundPayment = async ({ paymentIntentId, amount }) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
      // reverse_transfer:true
    });
    return refund;
  } catch (error) {
    console.log("Error in refund", error.message);
    throw error;
  }
};
const transferToConnectedAccount = async ({
  amount,
  currency,
  destinationAccountId,
  description,
}) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: amount,
      currency: currency,
      destination: destinationAccountId,
      description:
        description || "Manual payment transfer to connected account",
    });
    console.log("Transfer successful:", transfer);
    return transfer;
  } catch (error) {
    console.error("Error creating transfer:", error);
    throw error;
  }
};
const setupIntent = async ({ email, name }) => {
  try {
    const customer = await stripeCustomerByEmail({ email, name });
    const intent = await stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      // payment_method_types: ['card'],
    });
    return { customer, intent };
  } catch (error) {
    throw new Error(error.message);
  }
};
const balanceTransaction = async ({ latest_charge }) => {
  try {
    const charge = await stripe.charges.retrieve(latest_charge);
    if (!charge || !charge?.balance_transaction)
      throw new Error("Charge not found");
    const transaction = await stripe.balanceTransactions.retrieve(
      charge?.balance_transaction
    );
    if (!transaction) throw new Error("Transaction not found");
    const fee_amonut = Math.round(
      transaction?.fee / transaction?.exchange_rate / 100
    );
    return { transaction, fee_amonut };
  } catch (error) {
    throw new Error(error.message);
  }
};
const getUserAccount = async ({ userId, id }) => {
  try {
    let account = await Account.findOne({
      ...(id ? { _id: id } : {}),
      user: userId,
    });

    if (!account) {
      return null;
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
    return account;
  } catch (error) {
    throw new Error(error);
  }
};
const capturePayment = async ({ paymentIntentId }) => {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return paymentIntent.status=="succeeded" && paymentIntent;
  } catch (error) {
    console.log("Error in capturePayment", error.message);
    throw new Error(error.message);
  }
};
const cancelPayment = async ({ paymentIntentId }) => {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new Error(error.message);
  }
};
module.exports = {
  getPaymentMethods,
  stripeCustomerByEmail,
  attachPaymentMethodToCustomer,
  manualPayment,
  detachPaymentMethodToCustomer,
  createStripeAccount,
  checkAccountCapabilties,
  accountLink,
  createPaymentIntent,
  enableTransfer,
  refundPayment,
  transferToConnectedAccount,
  setupIntent,
  balanceTransaction,
  getUserAccount,
  capturePayment,
  cancelPayment,
};
