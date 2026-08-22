import { MailService } from './mail.service';

describe('MailService production safety', () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  };

  afterEach(() => {
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
    if (original.user === undefined) delete process.env.EMAIL_USER;
    else process.env.EMAIL_USER = original.user;
    if (original.pass === undefined) delete process.env.EMAIL_PASS;
    else process.env.EMAIL_PASS = original.pass;
  });

  test('fails closed when production email credentials are missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    expect(() => new MailService()).toThrow(
      'EMAIL_USER and EMAIL_PASS are required in production',
    );
  });
});
