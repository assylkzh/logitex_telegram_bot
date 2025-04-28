const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const dotenv = require('dotenv');

// Загрузка переменных окружения из файла .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Подключение к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Инициализация Telegram бота
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token, { polling: false });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// SQL запрос для создания таблицы контактов, если она не существует
const createTableQuery = `
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  company VARCHAR(100),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Создание таблицы при запуске сервера
pool.query(createTableQuery)
  .then(() => console.log('Таблица контактов создана или уже существует'))
  .catch(err => console.error('Ошибка при создании таблицы:', err));

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint для обработки заявок
app.post('/api/submit-contact', async (req, res) => {
  try {
    const { name, company, phone, email, message } = req.body;

    // Валидация данных
    if (!name || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Имя, телефон и email обязательны для заполнения'
      });
    }

    // Сохранение данных в PostgreSQL
    const insertQuery = `
      INSERT INTO contacts (name, company, phone, email, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;

    const result = await pool.query(insertQuery, [name, company, phone, email, message]);
    const contactId = result.rows[0].id;

    // Формирование сообщения для Telegram
    const telegramMessage =
      `🔔 Новая заявка #${contactId} от ${name}\n\n` +
      `👤 Имя: ${name}\n` +
      `🏢 Компания: ${company || 'Не указана'}\n` +
      `📱 Телефон: ${phone}\n` +
      `📧 Email: ${email}\n` +
      `💬 Сообщение: ${message || 'Не указано'}\n\n` +
      `📅 Дата: ${new Date().toLocaleString('ru-RU')}`;

    // Отправка уведомления в Telegram
    await bot.sendMessage(chatId, telegramMessage);

    res.status(200).json({
      success: true,
      message: 'Заявка успешно отправлена'
    });
  } catch (error) {
    console.error('Ошибка при обработке заявки:', error);
    res.status(500).json({
      success: false,
      message: 'Произошла ошибка при обработке заявки'
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});