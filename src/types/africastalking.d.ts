declare module "africastalking" {
  interface Credentials {
    apiKey: string;
    username: string;
  }

  interface SMS {
    send(options: { to: string[]; message: string; from?: string }): Promise<any>;
  }

  interface AfricasTalking {
    SMS: SMS;
    VOICE: any;
    AIRTIME: any;
    PAYMENTS: any;
  }

  export default function AfricasTalking(credentials: Credentials): AfricasTalking;
}
