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

const bucketName = process.env.R2_BUCKET_NAME || 'test';

const filesToUpload = [
    '../boshsahifa.png',
    '../davtar.png',
    '../image/workshop.png',
    '../image/production_process.png',
    '../image/warehouse.png',
    '../image/machinery.png',
    '../image/precision_processing.png',
    '../image/quality_control.png',
    '../image/cutting_machine.png',
    '../image/factory_exterior.png',
    '../image/production_line.png'
];

async function uploadFile(filePath) {
    const absolutePath = path.resolve(__dirname, filePath);
    if (!fs.existsSync(absolutePath)) {
        console.warn(`File not found: ${filePath}`);
        return null;
    }

    const fileContent = fs.readFileSync(absolutePath);
    const fileName = path.basename(filePath);
    const key = `media/${fileName}`;

    try {
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: fileContent,
            ContentType: getContentType(fileName)
        }));
        console.log(`Uploaded: ${filePath} -> ${key}`);
        return key;
    } catch (err) {
        console.error(`Error uploading ${filePath}:`, err);
        return null;
    }
}

function getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    return 'application/octet-stream';
}

async function main() {
    console.log(`Starting migration to bucket: ${bucketName}...`);
    for (const file of filesToUpload) {
        await uploadFile(file);
    }
    console.log('Migration complete!');
}

main();
