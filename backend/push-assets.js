const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

const filesToUpload = [
    { localPath: '../image/3.jpg', key: 'assets/image3.jpg' },
    { localPath: '../image/123.jpg', key: 'assets/image123.jpg' },
    { localPath: '../image/145.jpg', key: 'assets/image145.jpg' },
    { localPath: '../image/2.jpg', key: 'assets/image2.jpg' },
    { localPath: '../davtar.png', key: 'assets/davtar.png' },
    { localPath: '../Icon Image/orange-q.svg', key: 'assets/orange-q.svg' }
];

async function uploadFile(file) {
    const filePath = path.join(__dirname, file.localPath);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Fayl topilmadi: ${filePath}`);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const contentType = file.localPath.endsWith('.svg') ? 'image/svg+xml' : (file.localPath.endsWith('.png') ? 'image/png' : 'image/jpeg');

    try {
        await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.key,
            Body: fileBuffer,
            ContentType: contentType,
        }));
        console.log(`✅ Yuklandi: ${file.key}`);
    } catch (err) {
        console.error(`❌ Xatolik (${file.key}):`, err.message);
    }
}

async function main() {
    console.log('🚀 R2-ga yuklash boshlandi...');
    for (const file of filesToUpload) {
        await uploadFile(file);
    }
    console.log('🏁 Tugadi!');
}

main();
