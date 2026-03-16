const { corsHeaders } = require('../utils/cors');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

const getUserEmail = (event) => {
  return event.requestContext.authorizer.claims.email;
};

/**
 * Create Stripe Payment Intent
 */
module.exports.createPaymentIntent = async (event) => {
  try {
    const userId = getUserId(event);
    const userEmail = getUserEmail(event);
    const { amount, currency = 'sgd', orderId } = JSON.parse(event.body);

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid amount' }),
      };
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        userEmail,
        orderId: orderId || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create payment intent', details: error.message }),
    };
  }
};

/**
 * Confirm payment
 */
module.exports.confirmPayment = async (event) => {
  try {
    const { paymentIntentId } = JSON.parse(event.body);

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'paymentIntentId is required' }),
      };
    }

    // Retrieve payment intent to check status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }),
    };
  } catch (error) {
    console.error('Error confirming payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not confirm payment', details: error.message }),
    };
  }
};
