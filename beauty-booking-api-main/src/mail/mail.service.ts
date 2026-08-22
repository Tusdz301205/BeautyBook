import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('EMAIL_USER and EMAIL_PASS are required in production');
      }
      this.transporter = null;
      return;
    }
    this.transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  }

  async sendMail(to: string, subject: string, html: string) {
    // Nếu không cấu hình credentials thật, chỉ in ra console
    if (!this.transporter) {
      // Never log HTML: verification/reset links contain bearer-equivalent tokens.
      this.logger.warn(`[EMAIL DISABLED] Message not delivered to ${to}; subject=${subject}`);
      return;
    }
    
    try {
      await this.transporter.sendMail({
        from: `"GlowBook" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Error sending email to ${to}:`, error.stack);
    }
  }

  async sendBookingConfirmation(email: string, bookingId: string, details: any) {
    const subject = `GlowBook - Xác nhận lịch hẹn #${bookingId}`;
    const html = `
      <h3>Xin chào ${details.customerName},</h3>
      <p>Lịch hẹn <b>#${bookingId}</b> của bạn đã được xác nhận thành công.</p>
      <ul>
        <li><b>Thời gian:</b> ${details.time}</li>
        <li><b>Cơ sở:</b> ${details.salonName}</li>
        <li><b>Dịch vụ:</b> ${details.serviceName}</li>
      </ul>
      <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
    `;
    return this.sendMail(email, subject, html);
  }

  async sendBookingCancellation(email: string, bookingId: string, details: any, reason: string) {
    const subject = `GlowBook - Huỷ lịch hẹn #${bookingId}`;
    const html = `
      <h3>Xin chào ${details.customerName},</h3>
      <p>Lịch hẹn <b>#${bookingId}</b> của bạn đã bị huỷ.</p>
      <p><b>Lý do:</b> ${reason || 'Không có lý do'}</p>
      <p>Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.</p>
    `;
    return this.sendMail(email, subject, html);
  }
}
