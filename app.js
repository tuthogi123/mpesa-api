const express = require('express');
const app = express();

const axios = require('axios');

const port = 3000;

app.use(express.json());
const { v4: uuidv4 } = require('uuid');

const consumerKey = 'YOUR_CONSUMER_KEY';
const consumerSecret = 'YOUR_CONSUMER_SECRET';
const passkey = 'YOUR_LNM_PASSKEY';
const shortcode = 'YOUR_LNM_SHORTCODE';
const callbackUrl = 'YOUR_CALLBACK_URL';

const generateToken = async () => {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error generating token:', error.response.data);
    throw error;
  }
};

const verifyMpesaCode = async (req, res) => {
  const { mpesaCode } = req.body;

  try {
    const token = await generateToken();

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: shortcode,
        Password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64'),
        Timestamp: timestamp,
        CheckoutRequestID: mpesaCode,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { ResultCode, ResultDesc } = response.data;

    if (ResultCode === '0') {
      // Payment is successful, update your database or perform any necessary actions
      res.status(200).json({ message: 'Payment successful' });
    } else {
      // Payment failed, handle the failure accordingly
      res.status(400).json({ message: 'Payment failed' });
    }
  } catch (error) {
    console.error('Error verifying M-Pesa code:', error.response.data);
    res.status(500).json({ message: 'An error occurred' });
  }
};

const initiateLipaNaMpesaPayment = async (req, res) => {
  const { phoneNumber, amount } = req.body;
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const transactionId = uuidv4().replace(/-/g, '').slice(0, 12);

  try {
    const token = await generateToken();

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortcode,
        Password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64'),
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: transactionId,
        TransactionDesc: 'Shoe Purchase',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { ResponseCode, ResponseDescription, CustomerMessage, CheckoutRequestID } = response.data;

    if (ResponseCode === '0') {
      // Payment request successful, store the CheckoutRequestID and respond to the client
      res.status(200).json({ message: 'Payment request successful', checkoutRequestId: CheckoutRequestID });
    } else {
      // Payment request failed, handle the failure accordingly
      res.status(400).json({ message: ResponseDescription });
    }
  } catch (error) {
    console.error('Error initiating Lipa Na M-Pesa payment:', error.response.data);
    res.status(500).json({ message: 'An error occurred' });
  }
};
app.post('/initiate-payment', async (req, res) => {
    const { phoneNumber, amount } = req.body;
  
    try {
      const checkoutRequestId = await initiateLipaNaMpesaPayment(phoneNumber, amount);
      res.status(200).json({ message: 'Payment request successful', checkoutRequestId });
    } catch (error) {
      res.status(500).json({ message: 'An error occurred' });
    }
  });
app.post('/verify-payment', async (req, res) => {
    const { mpesaCode } = req.body;
  
    try {
      const verificationResult = await verifyMpesaCode(mpesaCode);
      res.status(200).json(verificationResult);
    } catch (error) {
      res.status(500).json({ message: 'An error occurred' });
    }
  });

app.listen(()=>{
    console.log("listening on port 3000")
});
