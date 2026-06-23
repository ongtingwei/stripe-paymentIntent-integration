/**
 * Clientside helper functions
 */

$(document).ready(function() {
  const amounts = document.getElementsByClassName("amount");

  // iterate through all "amount" elements and convert from cents to dollars
  for (let i = 0; i < amounts.length; i++) {
    let amount = amounts[i].getAttribute('data-amount') / 100;  
    amounts[i].innerHTML = amount.toFixed(2);
  }

  //Run logic only on checkout page. check if the container if match checkout-container
  const container = document.getElementById("checkout-container");
  if (!container) return;

  const publishableKey = container.getAttribute('data-publishable-key');
  const amount = parseInt(container.getAttribute('data-amount'))

  //Initialize Stripe
  const stripe = Stripe(publishableKey);
  let elements;

  //Create PaymentIntent and mount Payment Element once page is loaded
  fetch('/create-payment-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({amount:amount})
  })
  .then(function(res) { return res.json();})
  .then(function(data){
    if (data.error) {
      document.getElementById('payment-errors').textContent = data.error;
      return;
    }
    elements= stripe.elements({clientSecret: data.clientSecret});
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element')
  });

  //When user clicks submit, call stripe.confirmPayment directly from browser
  const form = document.querySelector('form[name="payment-form"]');
  form.addEventListener('submit', async function(e){
    e.preventDefault();

    const email = document.getElementById('email').value;

    const result = await stripe.confirmPayment({
      elements: elements,
      confirmParams:{
        return_url: window.location.origin + '/success?email=' + encodeURIComponent(email)
      }
    });
    if (result.error) {
      document.getElementById('payment-errors').textContent = result.error.message;
    }
  })
})

