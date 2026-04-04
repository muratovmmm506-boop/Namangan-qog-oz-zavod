const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

// Backup fayl yo'li
const BACKUP_FILE = path.join(__dirname, 'orders_backup.json');

// Ma'lumotlarni faylga saqlash (MongoDB ishlamasa ham saqlanib qolishi uchun)
async function syncToBackup(orders) {
    try {
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(orders, null, 2));
    } catch (err) {
        console.error('Backup xatosi:', err);
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Front-end ni ulash

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://muratovmuhammadsodiq506_db_user:zgiFgGwDCoFE1Phq@cluster0.rixnwlz.mongodb.net/?appName=Cluster0";

mongoose.set('bufferCommands', false); // DB ulanmasa ham kutib o'tirmaslik uchun

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB ga muvaffaqiyatli ulandi!'))
    .catch(err => console.error('❌ MongoDB ga ulanishda xato:', err.message));

// --- Schemas & Models ---

// Orders Schema (Includes Chat Messages)
const replySchema = new mongoose.Schema({
    text: String,
    time: String,
    date: String
});

const orderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    date: { type: String, required: true },
    message: { type: String, default: "" },
    status: { type: String, default: "Kutilmoqda" },
    replies: [replySchema]
});
const Order = mongoose.model('Order', orderSchema);

// Notifications Schema
const notificationSchema = new mongoose.Schema({
    title: String,
    body: String,
    time: String,
    unread: { type: Boolean, default: true }
});
const Notification = mongoose.model('Notification', notificationSchema);

// Products Schema
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    stock: Number,
    image: String
});
const Product = mongoose.model('Product', productSchema);

// --- Routes ---

// Orders API
app.get('/api/orders', async (req, res) => {
    try {
        let orders = await Order.find().sort({ _id: -1 });
        
        // Agar DB bo'sh bo'lsa yoki ulanishda xato bo'lsa backup'dan olish
        if (orders.length === 0 && fs.existsSync(BACKUP_FILE)) {
            orders = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        } else if (orders.length > 0) {
            syncToBackup(orders); // DB dagi ma'lumotni backup'ga yangilash
        }
        
        res.json(orders);
    } catch (err) {
        if (fs.existsSync(BACKUP_FILE)) {
            const orders = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
            return res.json(orders);
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        // --- Telegram ga yuborish (DB ga saqlashdan oldin) ---
        const botToken = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
        const chatId = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE';

        if (botToken !== 'YOUR_BOT_TOKEN_HERE' && chatId !== 'YOUR_CHAT_ID_HERE') {
            const cleanPhone = req.body.phone ? req.body.phone.replace(/\D/g, '') : '';
            const formattedPhone = cleanPhone.startsWith('998') ? '+' + cleanPhone : '+998' + cleanPhone;
            const telegramUrl = `https://t.me/${formattedPhone}`;
            const callUrl = `tel:${formattedPhone}`;

            const telegramMsg = `🚀 <b>Yangi xabar/buyurtma!</b>\n\n👤 <b>Ism:</b> ${req.body.name}\n📞 <b>Tel:</b> ${req.body.phone}\n📍 <b>Manzil:</b> ${req.body.address || 'Kiritilmagan'}\n📝 <b>Xabar:</b> ${req.body.message || 'Yo`q'}\n📅 <b>Sana:</b> ${req.body.date}`;

            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: telegramMsg,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '💬 Telegram orqali yozish', url: telegramUrl }
                            ],
                            [
                                { text: "📞 Qo'ng'iroq qilish", url: callUrl }
                            ]
                        ]
                    }
                })
            }).catch(err => console.error('Telegram Error:', err));
        }

        // --- MongoDB ga saqlash ---
        let finalOrder = req.body;
        try {
            const newOrder = new Order({ ...req.body, _id: new mongoose.Types.ObjectId() });
            finalOrder = await newOrder.save();
        } catch (dbErr) {
            console.error('❌ MongoDB ga saqlashda xato:', dbErr.message);
        }

        // --- Backup yangilash ---
        let currentOrders = [];
        if (fs.existsSync(BACKUP_FILE)) {
            currentOrders = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        }
        currentOrders.unshift(finalOrder);
        syncToBackup(currentOrders);

        res.status(201).json(finalOrder);
    } catch (err) {
        console.error('❌ API Error:', err.message);
        res.status(500).json({ error: "Ichki server xatoligi yuz berdi" });
    }
});

app.put('/api/orders/:id/reply', async (req, res) => {
    try {
        let order = null;
        try {
            order = await Order.findById(req.params.id);
            if (order) {
                order.replies.push(req.body);
                await order.save();
            }
        } catch (e) {}

        // Backup update
        if (fs.existsSync(BACKUP_FILE)) {
            let orders = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
            const idx = orders.findIndex(o => String(o._id || o.id) === String(req.params.id));
            if (idx !== -1) {
                if (!orders[idx].replies) orders[idx].replies = [];
                orders[idx].replies.push(req.body);
                syncToBackup(orders);
                if (!order) order = orders[idx];
            }
        }

        if (!order) return res.status(404).json({ message: 'Order topilmadi' });
        
        // --- Telegram ga admin javobini yuborish (log sifatida) ---
        const botToken = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
        const chatId = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE';
        if (botToken !== 'YOUR_BOT_TOKEN_HERE') {
            const telegramMsg = `✅ <b>Admin javob berdi!</b>\n\n👤 <b>Mijoz:</b> ${order.name}\n📝 <b>Javob:</b> ${req.body.text}`;
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: telegramMsg, parse_mode: 'HTML' })
            }).catch(e => console.log(e));
        }

        res.json(order);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/orders/:id/reply', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: 'Order topilmadi' });

        order.replies = order.replies.filter(r => r.text !== text);
        await order.save();

        res.json({ message: 'Javob o\'chirildi', order });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: 'Buyurtma o\'chirildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Notifications API
app.get('/api/notifications', async (req, res) => {
    try {
        const notifs = await Notification.find().sort({ _id: -1 });
        res.json(notifs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Cloudflare R2 / S3 Configuration ---
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
        bucket: process.env.R2_BUCKET_NAME || 'my-bucket',
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            const fileName = Date.now().toString() + '-' + file.originalname;
            cb(null, fileName);
        }
    })
});

// --- Routes ---

// Image Upload API
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Fayl yuklanmadi' });
    }
    
    // Cloudflare R2 Public URL ni qaytarish
    const publicUrl = process.env.R2_PUBLIC_URL 
        ? `${process.env.R2_PUBLIC_URL}/${req.file.key}` 
        : `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${req.file.key}`;
        
    res.json({ 
        url: publicUrl,
        key: req.file.key
    });
});

// Products API
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ _id: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        let imageUrl = req.body.image; // Agar link sifatida berilgan bo'lsa
        
        if (req.file) {
            imageUrl = process.env.R2_PUBLIC_URL 
                ? `${process.env.R2_PUBLIC_URL}/${req.file.key}` 
                : `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${req.file.key}`;
        }

        const newProduct = new Product({
            name: req.body.name,
            price: req.body.price,
            category: req.body.category,
            stock: req.body.stock,
            image: imageUrl
        });

        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    try {
        let updateData = { ...req.body };
        
        if (req.file) {
            updateData.image = process.env.R2_PUBLIC_URL 
                ? `${process.env.R2_PUBLIC_URL}/${req.file.key}` 
                : `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${req.file.key}`;
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Mahsulot o\'chirildi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
