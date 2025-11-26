const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Конфигурация почты
const emailTransporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'kodauyntihikatsii7@gmail.com',
        pass: '6wA-Bzc-fzV-rYS'
    }
});

// Маршруты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API для отправки кодов верификации
app.post('/api/send-verification', async (req, res) => {
    const { email, code } = req.body;
    
    try {
        await emailTransporter.sendMail({
            from: 'OldSchool Board <kodauyntihikatsii7@gmail.com>',
            to: email,
            subject: 'Код подтверждения для OldSchool Board',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f48fb1;">OldSchool Board</h2>
                    <p>Ваш код подтверждения:</p>
                    <div style="background: #f8bbd9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; color: #333; border-radius: 5px; margin: 20px 0;">
                        ${code}
                    </div>
                    <p>Код действителен в течение 10 минут.</p>
                    <p style="color: #666; font-size: 12px;">Если вы не запрашивали этот код, проигнорируйте это письмо.</p>
                </div>
            `
        });
        
        res.json({ success: true, message: 'Код отправлен' });
    } catch (error) {
        console.error('Ошибка отправки email:', error);
        res.status(500).json({ success: false, message: 'Ошибка отправки кода' });
    }
});

// API для уведомлений
app.post('/api/send-notification', async (req, res) => {
    const { email, subject, message } = req.body;
    
    try {
        await emailTransporter.sendMail({
            from: 'OldSchool Board <kodauyntihikatsii7@gmail.com>',
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f48fb1;">OldSchool Board</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
                        ${message}
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">
                        Это автоматическое уведомление, пожалуйста не отвечайте на это письмо.
                    </p>
                </div>
            `
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
