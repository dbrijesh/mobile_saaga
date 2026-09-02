const { corsHeaders } = require('../utils/cors');
const Stripe = require('stripe');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { createOrderRecord } = require('../utils/createOrderRecord');
const { sendOrderConfirmationEmail } = require('../utils/email');

const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'ap-southeast-1' });
let stripeInstance = null;

const getStripe = async () => {
  if (stripeInstance) return stripeInstance;
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.STRIPE_SECRET_ARN })
  );
  stripeInstance = Stripe(response.SecretString);
  return stripeInstance;
};

const headers = corsHeaders;
const getUserId = (event) => event.requestContext.authorizer.claims.sub;
const getUserEmail = (event) => event.requestContext.authorizer.claims.email;

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

    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        userEmail,
        orderId: orderId || '',
      },
      automatic_payment_methods: { enabled: true },
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
 * Confirm payment AND create order atomically.
 *
 * Accepts the full order payload so the order is created in one step.
 * Uses paymentIntentId as the orderId — idempotent: retrying the same
 * request returns the already-created order without duplicating it.
 *
 * Body: { paymentIntentId, items, shippingAddress, totalAmount,
 *         notes?, shippingDateId?, couponId?, couponCode?, discountAmount? }
 */
module.exports.confirmPayment = async (event) => {
  try {
    const userId = getUserId(event);
    const userEmail = getUserEmail(event);
    const body = JSON.parse(event.body);

    const {
      paymentIntentId,
      items,
      shippingAddress,
      totalAmount,
      notes,
      shippingDateId,
      couponId,
      couponCode,
      discountAmount,
    } = body;

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'paymentIntentId is required' }),
      };
    }

    if (!items || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'items are required' }),
      };
    }

    if (!shippingAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'shippingAddress is required' }),
      };
    }

    // Verify payment with Stripe
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Payment has not succeeded',
          status: paymentIntent.status,
        }),
      };
    }

    // Create order atomically — idempotent via paymentIntentId as orderId
    const { order, alreadyExisted } = await createOrderRecord(
      paymentIntentId,
      userId,
      { items, shippingAddress, totalAmount, notes, shippingDateId, couponId, couponCode, discountAmount, paymentIntentId, customerEmail: userEmail }
    );

    if (!alreadyExisted) {
      try {
        await sendOrderConfirmationEmail(order, userEmail);
      } catch (err) {
        console.error('Order email error:', err.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: paymentIntent.status,
        order,
        alreadyExisted,
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
