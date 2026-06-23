const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const paymentStatus = {};

var app = express();

// view engine setup (Handlebars)
app.engine('hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs'
}));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }))


app.post('/webhook', express.raw({ type: 'application/json' }),function(request, response) {
  const sig = request.headers['stripe-signature'];
  const body = request.body;

  let event = null;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    // invalid signature
    response.status(400).end();
    return;
  }

  let intent = null;
  switch (event['type']) {
    case 'payment_intent.succeeded':
      intent = event.data.object;
      paymentStatus[intent.id] = true;
      console.log("Succeeded:", intent.id);

      break;
    case 'payment_intent.payment_failed':
      intent = event.data.object;
      const message = intent.last_payment_error && intent.last_payment_error.message;
      console.log('Failed:', intent.id, message);
      break;
  }

  response.sendStatus(200);
});


app.use(express.json({}));

/**
 * Home route
 */
app.get('/', function(req, res) {
  res.render('index');
});

/**
 * Checkout route
 */
app.get('/checkout', function(req, res) {
  // Just hardcoding amounts here to avoid using a database
  const item = req.query.item;
  let title, amount, error;

  switch (item) {
    case '1':
      title = "The Art of Doing Science and Engineering"
      amount = 2300      
      break;
    case '2':
      title = "The Making of Prince of Persia: Journals 1985-1993"
      amount = 2500
      break;     
    case '3':
      title = "Working in Public: The Making and Maintenance of Open Source"
      amount = 2800  
      break;     
    default:
      // Included in layout view, feel free to assign error
      error = "No item selected"      
      break;
  }

  res.render('checkout', {
    title: title,
    amount: amount,
    error: error,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

app.post('/create-payment-intent', async function(req,res){
  const {amount} = req.body;

  const idempotencyKey = uuidv4();
  console.log('Idempotency key:', idempotencyKey);
  
  try{
    const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
      },
    },{
      idempotencyKey: idempotencyKey
    }
    );
    res.json({clientSecret:paymentIntent.client_secret});
  }catch (err){
    res.status(400).json({error : err.message });
  }

}
)

/**
 * Success route
 */
app.get('/success', async function(req, res) {
  const {payment_intent, email} = req.query;
  await new Promise(resolve => setTimeout(resolve, 1000)); // add loading bar to UI for enhancement
    

  if (!paymentStatus[payment_intent]) {
    return res.render('success', {error:'Opps! There is an issue with your payment'});
  }

  try{
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
    res.render('success',{
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      email: email,
    })
  } catch (err){
  res.render('success', {error: err.message});
  }
});

/**
 * Start server
 */
app.listen(3000, () => {
  console.log('Getting served on port 3000');
});
