import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

class MailService {

  static getHtmlTemplate(title, content, actionCode = null, actionColor = '#6366F1') {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
            direction: rtl;
            text-align: right;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, ${actionColor}, #4338ca);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -0.02em;
          }
          .content {
            padding: 45px 35px;
            color: #334155;
            font-size: 16px;
            line-height: 1.8;
          }
          .content h2 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 24px;
            font-weight: 800;
            letter-spacing: -0.01em;
          }
          .code-box {
            background-color: #f1f5f9;
            border: 2px solid ${actionColor}20;
            border-radius: 16px;
            padding: 25px;
            text-align: center;
            margin: 35px 0;
          }
          .code {
            font-size: 42px;
            font-weight: 900;
            color: ${actionColor};
            letter-spacing: 12px;
            font-family: 'Courier New', monospace;
            display: block;
          }
          .code-label {
            display: block;
            font-size: 14px;
            color: #64748b;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .footer {
            background-color: #f8fafc;
            padding: 30px;
            text-align: center;
            font-size: 13px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
          }
          .highlight {
            color: ${actionColor};
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>منصة Horus</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            ${content}
            ${actionCode ? `
              <div class="code-box">
                <span class="code-label">رمز التحقق الخاص بك</span>
                <span class="code">${actionCode}</span>
              </div>
              <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
                صلاحية الكود صالحة لمدة 5 دقائق فقط لضمان أمان حسابك.
              </p>
            ` : ''}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} منصة Horus. جميع الحقوق محفوظة.</p>
            <p>هذه رسالة آلية من نظام الذكاء الاصطناعي، برجاء عدم الرد.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async sendOTP(email, otp) {
    try {
      const html = this.getHtmlTemplate(
        'تغيير كلمة المرور',
        `<p>أهلاً بك،</p>
         <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في Horus.</p>
         <p>استخدم الكود التالي لإكمال العملية بأمان:</p>`,
        otp,
        '#F59E0B' // Warning Amber
      );

      const info = await transporter.sendMail({
        from: `"فريق Horus" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 كود استعادة كلمة المرور',
        text: `كود التحقق الخاص بك هو: ${otp}`,
        html: html,
      });

      return info;
    } catch (error) {
      console.error('Error sending OTP email: ', error);
      throw new Error('Failed to send OTP email');
    }
  }

  static async sendVerificationOTP(email, otp) {
    try {
      const html = this.getHtmlTemplate(
        'تأكيد البريد الإلكتروني',
        `<p>مرحباً بك في عالم Horus! 👋</p>
         <p>يسعدنا انضمامك إلينا في رحلتك التعليمية. يرجى استخدام الكود التالي لتفعيل حسابك والبدء فوراً:</p>`,
        otp,
        '#6366F1' // Indigo
      );

      const info = await transporter.sendMail({
        from: `"فريق Horus" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✨ مرحباً بك في Horus - تأكيد الحساب',
        text: `كود التفعيل: ${otp}`,
        html: html,
      });
      return info;
    } catch (error) {
      console.error('Error sending verification email: ', error);
      throw new Error('Failed to send verification email');
    }
  }

  static async sendNewExamNotification(emails, examTitle, type) {
    if (!emails || emails.length === 0) return;

    try {
      const content = `
        <p>حان وقت التحدي! 💪</p>
        <p>تم إضافة <strong>${type}</strong> ذكي جديد على منصة Horus:</p>
        <div style="background:#eef2ff; border:1px solid #e0e7ff; border-radius:16px; padding:25px; text-align:center; margin:25px 0;">
          <h2 style="margin:0; color:#4338ca; font-size:26px;">${examTitle}</h2>
        </div>
        <p>ادخل الآن واختبر مهاراتك مع Horus!</p>
        <div style="text-align:center; margin-top:30px;">
          <a href="${process.env.CLIENT_URL || '#'}" style="background:#6366F1; color:white; text-decoration:none; padding:15px 35px; border-radius:12px; font-weight:bold; display:inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);">ابدأ الاختبار الآن</a>
        </div>
      `;

      const html = this.getHtmlTemplate(
        'تنبيه اختبار جديد',
        content,
        null,
        '#6366F1'
      );

      await transporter.sendMail({
        from: `"تنبيهات Horus" <${process.env.EMAIL_USER}>`,
        bcc: emails,
        subject: `📝 اختبار جديد بانتظارك: ${examTitle}`,
        html: html,
      });
    } catch (error) {
      console.error('Error sending exam notification: ', error);
    }
  }

  static async sendRechargeReceipt(email, name, amount, balance, transactionId) {
    try {
      const content = `
        <p>مرحباً <strong>${name}</strong>،</p>
        <p>تم شحن محفظتك الرقمية بنجاح! 🎉</p>
        
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:16px; padding:25px; margin:25px 0; text-align:center;">
          <p style="margin:0; text-transform:uppercase; font-size:12px; color:#15803d; letter-spacing:2px; font-weight:700;">قيمة الشحن</p>
          <h2 style="margin:10px 0 20px 0; color:#166534; font-size:36px;">${amount} EGP</h2>
          
          <div style="border-top:1px dashed #bbf7d0; padding-top:20px; display:flex; justify-content:space-between; font-size:15px; color:#166534;">
            <span>الرصيد الكلي:</span>
            <strong>${balance} EGP</strong>
          </div>
        </div>

        <p style="font-size:12px; color:#94a3b8; text-align:center;">مرجع العملية: #${transactionId}</p>
      `;

      const html = this.getHtmlTemplate(
        'إيصال شحن رصيد',
        content,
        null,
        '#10B981' // Success Emerald
      );

      await transporter.sendMail({
        from: `"منصة Horus" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✅ تم تأكيد شحن رصيدك',
        html: html,
      });
    } catch (error) {
      console.error('Error sending recharge receipt: ', error);
    }
  }
}

export default MailService;
