const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

async function main() {
    try {
        const data = await s3.send(new ListBucketsCommand({}));
        console.log("Buckets found:", JSON.stringify(data.Buckets, null, 2));
    } catch (err) {
        console.error("Error listing buckets:", err);
    }
}

main();
