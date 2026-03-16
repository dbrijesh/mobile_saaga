const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext?.authorizer?.claims?.sub;
};

/**
 * Submit support ticket
 */
module.exports.submitTicket = async (event) => {
  try {
    const userId = getUserId(event);
    const { subject, message, category, email } = JSON.parse(event.body);

    if (!subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subject and message are required' }),
      };
    }

    const ticketId = uuidv4();
    const ticket = {
      ticketId,
      userId,
      email,
      subject,
      message,
      category: category || 'general',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In a real application, you'd store this in a support tickets table
    // For now, we'll just return success
    console.log('Support ticket:', ticket);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Support ticket submitted successfully',
        ticketId,
      }),
    };
  } catch (error) {
    console.error('Error submitting support ticket:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not submit support ticket', details: error.message }),
    };
  }
};

/**
 * Get FAQs
 */
module.exports.getFAQs = async (event) => {
  try {
    // Static FAQs for Singapore Indian Grocery Store
    const faqs = [
      {
        id: 1,
        category: 'Orders',
        question: 'How long does delivery take?',
        answer: 'Standard delivery takes 2-3 business days within Singapore. Same-day delivery is available for orders placed before 12 PM.',
      },
      {
        id: 2,
        category: 'Orders',
        question: 'What are the delivery charges?',
        answer: 'Free delivery for orders above SGD 50. For orders below SGD 50, a delivery fee of SGD 5 applies.',
      },
      {
        id: 3,
        category: 'Payment',
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards, debit cards, PayNow, and online banking through our secure payment gateway.',
      },
      {
        id: 4,
        category: 'Payment',
        question: 'Is my payment information secure?',
        answer: 'Yes, we use industry-standard encryption and comply with PCI DSS standards. We never store your complete card details.',
      },
      {
        id: 5,
        category: 'Products',
        question: 'Are your products authentic Indian products?',
        answer: 'Yes, we source directly from trusted suppliers in India and ensure all products are authentic and of the highest quality.',
      },
      {
        id: 6,
        category: 'Products',
        question: 'Do you have fresh vegetables and fruits?',
        answer: 'Yes, we stock fresh Indian vegetables and fruits. Fresh produce is delivered within 24 hours of harvest.',
      },
      {
        id: 7,
        category: 'Returns',
        question: 'What is your return policy?',
        answer: 'We accept returns within 7 days of delivery for unopened items. Fresh produce and perishables cannot be returned unless defective.',
      },
      {
        id: 8,
        category: 'Returns',
        question: 'How do I return a product?',
        answer: 'Contact our support team through the app with your order number and reason for return. We will arrange for pickup.',
      },
      {
        id: 9,
        category: 'Account',
        question: 'How do I update my delivery address?',
        answer: 'Go to Profile > Manage Addresses to add, edit, or delete delivery addresses. You can set a default address for faster checkout.',
      },
      {
        id: 10,
        category: 'Account',
        question: 'Can I cancel my order?',
        answer: 'Yes, you can cancel orders before they are shipped. Go to Orders > View Details and click Cancel Order.',
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        faqs,
        count: faqs.length,
      }),
    };
  } catch (error) {
    console.error('Error getting FAQs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve FAQs', details: error.message }),
    };
  }
};
