const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

// --- PostgreSQL Connection (Sequelize) ---
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:qVQhwvwYuUQPDGhfPMhSLrYuCeoCTeab@postgres.railway.internal:5432/railway";

const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: DATABASE_URL.includes('railway.internal') ? false : {
            require: true,
            rejectUnauthorized: false
        }
    }
});

// --- Models ---
const Product = sequelize.define('Product', {
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL(10, 2),
    category: DataTypes.STRING,
    stock: DataTypes.INTEGER,
    image: DataTypes.TEXT
});

const Notification = sequelize.define('Notification', {
    title: DataTypes.STRING,
    body: DataTypes.TEXT,
    time: DataTypes.STRING,
    unread: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Order = sequelize.define('Order', {
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    address: DataTypes.STRING,
    date: { type: DataTypes.STRING, allowNull: false },
    message: DataTypes.TEXT,
    status: { type: DataTypes.STRING, defaultValue: "Kutilmoqda" }
});

const Reply = sequelize.define('Reply', {
    text: DataTypes.TEXT,
    time: DataTypes.STRING,
    date: DataTypes.STRING
});

// Associations
Order.hasMany(Reply, { as: 'replies', onDelete: 'CASCADE' });
Reply.belongsTo(Order);

// Sync Database
sequelize.sync()
    .then(() => console.log('✅ PostgreSQL (Sequelize) ulandi!'))
    .catch(err => console.error('❌ PostgreSQL ulanishda xato:', err));

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// --- R2 / S3 Configuration ---
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.R2_BUCKET_NAME || 'test',
        metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
        key: (req, file, cb) => cb(null, Date.now().toString() + '-' + file.originalname)
    })
});

// Helper for R2 Public URL
function getR2PublicUrl(key) {
    if (!key) return null;
    if (process.env.R2_PUBLIC_URL) {
        return `${process.env.R2_PUBLIC_URL}/${key}`;
    }
    return `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;
}

// --- Routes ---

// Orders API
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [{ model: Reply, as: 'replies' }],
            order: [['id', 'DESC']]
        });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = await Order.create(req.body);
        
        // Telegram Notification
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (botToken && chatId) {
            const msg = `🚀 <b>Yangi buyurtma!</b>\n\n👤 <b>Ism:</b> ${req.body.name}\n📞 <b>Tel:</b> ${req.body.phone}\n📝 <b>Xabar:</b> ${req.body.message}`;
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
            }).catch(e => console.error('Telegram error:', e));
        }

        res.status(201).json(newOrder);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/orders/:id/reply', async (req, res) => {
    try {
        const reply = await Reply.create({ ...req.body, OrderId: req.params.id });
        const updatedOrder = await Order.findByPk(req.params.id, { include: ['replies'] });
        res.json(updatedOrder);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Order o\'chirildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Products API
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['id', 'DESC']] });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        let imageUrl = req.body.image;
        if (req.file) {
            imageUrl = getR2PublicUrl(req.file.key);
        }
        const product = await Product.create({ ...req.body, image: imageUrl });
        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        let updateData = { ...req.body };
        if (req.file) {
            updateData.image = getR2PublicUrl(req.file.key);
        }
        await Product.update(updateData, { where: { id: req.params.id } });
        const updated = await Product.findByPk(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Mahsulot o\'chirildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
    try {
        const notifs = await Notification.findAll({ order: [['id', 'DESC']] });
        res.json(notifs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
