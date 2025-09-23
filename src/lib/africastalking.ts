import AfricasTalking from 'africastalking';

const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY as string,
  username: process.env.AT_USERNAME as string,
});

export const sms = africastalking.SMS;
