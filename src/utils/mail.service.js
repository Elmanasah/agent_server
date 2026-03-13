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

  static getHtmlTemplate(title, content, actionCode = null, actionColor = '#00a8e8') {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7fa;
            margin: 0;
            padding: 0;
            direction: rtl;
            text-align: right;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          }
          .header {
            background: linear-gradient(135deg, ${actionColor}, #0077a3);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .content {
            padding: 40px 30px;
            color: #334155;
            font-size: 16px;
            line-height: 1.8;
          }
          .content h2 {
            color: #1e293b;
            font-size: 22px;
            margin-bottom: 20px;
            font-weight: 700;
          }
          .code-box {
            background-color: #f8fafc;
            border: 2px dashed ${actionColor};
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 36px;
            font-weight: 900;
            color: ${actionColor};
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            display: block;
          }
          .code-label {
            display: block;
            font-size: 14px;
            color: #64748b;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 20px;
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
            <h1>المنصة التعليمية</h1>
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
                صلاحية الكود 5 دقائق فقط. لو مكنتش أنت اللي طلبت، تجاهل الرسالة دي بأمان.
              </p>
            ` : ''}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} المنصة التعليمية. جميع الحقوق محفوظة.</p>
            <p>هذه رسالة آلية، برجاء عدم الرد عليها.</p>
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
         <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
         <p>استخدم الكود التالي لإكمال العملية:</p>`,
        otp,
        '#FF9800' // Orange for security actions
      );

      const info = await transporter.sendMail({
        from: `"فريق المنصة" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 كود تغيير كلمة المرور',
        text: `الكود الخاص بك هو: ${otp}`,
        html: html,
      });

      return info;
    } catch (error) {
      console.error('Error sending email: ', error);
      throw new Error('Failed to send OTP email');
    }
  }

  static async verifyParent(email, otp) {
    try {
      const html = this.getHtmlTemplate(
        'ربط حساب ولي الأمر',
        `<p>السيد ولي الأمر،</p>
         <p>يرغب ابنك/ابنتك في ربط حسابهم بحسابك لمتابعة مستواهم الدراسي.</p>
         <p>من فضلك أعطهم هذا الكود للموافقة:</p>`,
        otp,
        '#4CAF50' // Green for approval
      );

      const info = await transporter.sendMail({
        from: `"فريق المنصة" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '👨‍👩‍👧‍👦 كود ربط ولي الأمر',
        text: `كود ولي الأمر: ${otp}`,
        html: html,
      });

      return info;
    } catch (error) {
      console.error('Error sending email: ', error);
      throw new Error('Failed to send OTP email');
    }
  }

  static async sendVerificationOTP(email, otp) {
    try {
      const html = this.getHtmlTemplate(
        'تأكيد البريد الإلكتروني',
        `<p>مرحباً بك معنا! 👋</p>
         <p>نحن سعداء بانضمامك إلينا. لتفعيل حسابك والبدء في رحلة التعلم، يرجى استخدام الكود التالي:</p>`,
        otp,
        '#00a8e8' // Brand Blue
      );

      const info = await transporter.sendMail({
        from: `"فريق المنصة" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✨ تأكيد حسابك الجديد',
        text: `كود التفعيل: ${otp}`,
        html: html,
      });
      return info;
    } catch (error) {
      console.error('Error sending verification email: ', error);
      throw new Error('Failed to send verification email');
    }
  }

  static async sendWithdrawalStatus(email, status, amount, note) {
    try {
      const isApproved = status === 'approved';
      const statusText = isApproved ? 'تمت الموافقة بنجاح' : 'تم رفض الطلب';
      const color = isApproved ? '#4CAF50' : '#F44336';
      
      const content = `
        <p>بخصوص طلب سحب المبلغ: <strong>${amount} جنيه</strong></p>
        <p>نود إبلاغك أنه <span style="color:${color}; font-weight:bold;">${statusText}</span>.</p>
        ${note ? `<div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-top:15px;"><strong>ملاحظة:</strong> ${note}</div>` : ''}
      `;

      const html = this.getHtmlTemplate(
        'تحديث حالة طلب السحب',
        content,
        null,
        color
      );

      await transporter.sendMail({
        from: `"فريق المنصة" <${process.env.EMAIL_USER}>`,  
        to: email,
        subject: isApproved ? '💰 تم قبول سحب الرصيد' : '❌ تحديث بخصوص طلب السحب',
        html: html,
      });
    } catch (error) {
      console.error('Error sending withdrawal email: ', error);
    }
  }

  static async sendChildPurchaseNotification(email, childName, itemName, price) {
    try {
      const content = `
        <p>قام ابنك <strong class="highlight">${childName}</strong> بشراء محتوى تعليمي جديد:</p>
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:15px; margin:20px 0;">
          <h3 style="margin:0 0 10px 0; color:#0369a1;">${itemName}</h3>
          <p style="margin:0; font-size:18px;">القيمة: <strong>${price} جنيه</strong></p>
        </div>
        <p>تم خصم المبلغ من المحفظة بنجاح.</p>
      `;

      const html = this.getHtmlTemplate(
        'إشعار شراء جديد',
        content,
        null,
        '#2196F3'
      );

      await transporter.sendMail({
        from: `"فريق المنصة" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '📚 عملية شراء جديدة',
        html: html,
      });
    } catch (error) {
      console.error('Error sending parent notification: ', error);
    }
  }

  static async sendNewExamNotification(emails, examTitle, type) {
    if (!emails || emails.length === 0) return;

    try {
      const content = `
        <p>استعد للتحدي! 💪</p>
        <p>تم إضافة <strong>${type}</strong> جديد على المنصة:</p>
        <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:10px; padding:20px; text-align:center; transform:rotate(-1deg); margin:20px 0; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
          <h2 style="margin:0; color:#ea580c; font-size:24px;">${examTitle}</h2>
        </div>
        <p>ادخل دلوقتي واختبر مستواك!</p>
        <div style="text-align:center; margin-top:25px;">
          <a href="${process.env.CLIENT_URL || '#'}" style="background:#ea580c; color:white; text-decoration:none; padding:12px 25px; border-radius:30px; font-weight:bold; display:inline-block; box-shadow:0 4px 10px rgba(234, 88, 12, 0.3);">الذهاب للمنصة</a>
        </div>
      `;

      const html = this.getHtmlTemplate(
        'تنبيه امتحان جديد',
        content,
        null,
        '#ea580c'
      );

      await transporter.sendMail({
        from: `"تنبيهات الامتحانات" <${process.env.EMAIL_USER}>`,
        bcc: emails,
        subject: `📝 امتحان جديد: ${examTitle}`,
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
        <p>تم شحن محفظتك بنجاح! 🎉</p>
        
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
          <p style="margin:0; text-transform:uppercase; font-size:12px; color:#15803d; letter-spacing:1px;">قيمة الشحن</p>
          <h2 style="margin:5px 0 15px 0; color:#166534; font-size:32px;">${amount} EGP</h2>
          
          <div style="border-top:1px dashed #bbf7d0; padding-top:15px; display:flex; justify-content:space-between; font-size:14px; color:#166534;">
            <span>رصيدك الحالي:</span>
            <strong>${balance} EGP</strong>
          </div>
        </div>

        <p style="font-size:12px; color:#64748b; text-align:center;">رقم العملية: #${transactionId}</p>
      `;

      const html = this.getHtmlTemplate(
        'إيصال شحن رصيد',
        content,
        null,
        '#22c55e' // Green
      );

      await transporter.sendMail({
        from: `"المنصة التعليمية" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '✅ تم شحن رصيدك بنجاح',
        html: html,
      });
    } catch (error) {
      console.error('Error sending recharge receipt: ', error);
      // Don't throw error to avoid failing the transaction response
    }
  }

  static async sendTeacherAssignmentNotification(email, studentName, courseName, teacherName) {
    try {
      const content = `
        <p>مرحباً <strong>${studentName}</strong>،</p>
        <p>لقد قام الأستاذ <strong class="highlight">${teacherName}</strong> بفتح كورس جديد لك! 🎓</p>
        
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
          <h3 style="margin:0 0 10px 0; color:#0369a1;">${courseName}</h3>
        </div>
        
        <p>يمكنك الآن الدخول للكورس والبدء في الدراسة مباشرة!</p>
        <div style="text-align:center; margin-top:25px;">
          <a href="${process.env.CLIENT_URL || '#'}/my-courses" style="background:#0369a1; color:white; text-decoration:none; padding:12px 25px; border-radius:30px; font-weight:bold; display:inline-block; box-shadow:0 4px 10px rgba(3, 105, 161, 0.3);">الذهاب للكورسات</a>
        </div>
      `;

      const html = this.getHtmlTemplate(
        'تم فتح كورس جديد لك',
        content,
        null,
        '#0369a1'
      );

      await transporter.sendMail({
        from: `"المنصة التعليمية" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎁 كورس جديد',
        html: html,
      });
    } catch (error) {
      console.error('Error sending teacher assignment notification: ', error);
      // Don't throw error to avoid failing the assignment
    }
  }
}

export default MailService;
