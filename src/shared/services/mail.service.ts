// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class MailService {
// private transporter: nodemailer.Transporter;

//   constructor(private configService: ConfigService) {
//     this.transporter = nodemailer.createTransport({
//       host: this.configService.get('SMTP_HOST'),
//       port: this.configService.get('SMTP_PORT'),
//       secure: true,
//       auth: {
//         user: this.configService.get('SMTP_USER'),
//         pass: this.configService.get('SMTP_PASS'),
//       },
//     });
//   }

//   async sendPasswordReset(email: string, token: string): Promise<void> {
//     const resetUrl = `${this.configService.get('APP_URL')}/reset-password?token=${token}`;

//     await this.transporter.sendMail({
//       from: this.configService.get('MAIL_FROM'),
//       to: email,
//       subject: 'Réinitialisation de votre mot de passe',
//       html: `
//         <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
//         <p>Cliquez sur le lien suivant pour définir un nouveau mot de passe :</p>
//         <a href="${resetUrl}">Réinitialiser mon mot de passe</a>
//         <p>Ce lien expire dans 1 heure.</p>
//       `,
//     });
//   }
// }

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(private configService: ConfigService) {}

  async sendPasswordReset(email: string, token: string): Promise<void> {
    // Pour les tests, on simule juste l'envoi
    console.log(`Reset password email would be sent to ${email} with token ${token}`);
  }
}