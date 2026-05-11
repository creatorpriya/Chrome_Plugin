const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { MongoClient } = require("mongodb");
const fs = require("fs");
const config = require("./config");

/* ================================
   AWS S3 CONFIG (FROM CONFIG FILE)
================================ */
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const bucketName = config.aws.bucketName;

/* ================================
   MONGODB CONFIG (FIXED)
================================ */
const mongoUri = config.mongodb.uri;
const DB_NAME = config.mongodb.dbName;

/* ================================
   LOCAL DEBUG DIR (optional)
================================ */
const outputDir = "./s3_downloads";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/* ================================
   MONGODB CONNECTION
================================ */
async function connectToMongoDB() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log("✅ Connected to MongoDB");
  return client;
}

/* ================================
   RENAME FILE IN S3
================================ */
async function renameFileInS3(oldKey, status) {
  const newKey = oldKey.replace(/\.json(\..+)?$/, `.json.${status}`);

  try {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodeURIComponent(`${bucketName}/${oldKey}`),
        Key: newKey,
      })
    );

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldKey,
      })
    );

    console.log(`🔄 Renamed ${oldKey} → ${newKey}`);
  } catch (error) {
    console.error(`❌ Error renaming ${oldKey}:`, error);
  }
}

/* ================================
   COLLECTION RESOLVER
================================ */
function getCollectionName(fileName, jsonData) {
  const lowerFile = fileName.toLowerCase();
  const source = jsonData?.source?.toLowerCase() || "";

  // ✅ LinkedIn (robust)
  if (lowerFile.includes("linkedin") || source.includes("linkedin")) {
    if (jsonData?.profile_type === "linkedin_person") return "linkedin_person";
    if (jsonData?.profile_type === "linkedin_company") return "linkedin_company";

    return "linkedin_raw"; // ✅ fallback
  }

  if (lowerFile.endsWith("_lusha.json")) return "lusha";
  if (lowerFile.endsWith("_bbb.json")) return "bbb";
  if (lowerFile.endsWith("_builtwith.json")) return "builtwith";
  if (lowerFile.endsWith("_tracxn.json")) return "tracxn";
  if (lowerFile.endsWith("_crft.json")) return "crft";
  if (lowerFile.endsWith("_stackcrawler.json")) return "stackcrawler";
  if (lowerFile.endsWith("_fulio.json")) return "fulio";

  return null;
}

/* ================================
   LIST + PROCESS FILES
================================ */
async function listAndProcessFiles(client) {
  try {
    const { Contents } = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName })
    );

    if (!Contents || Contents.length === 0) {
      console.log("📂 No files found in S3 bucket");
      return;
    }

    for (const file of Contents) {
      const fileKey = file.Key;

      if (
        fileKey.endsWith(".json.processed") ||
        fileKey.endsWith(".json.skipped")
      ) {
        console.log(`⏩ Skipping ${fileKey}`);
        continue;
      }

      console.log(`🔍 Processing ${fileKey}`);
      await processFile(client, fileKey);
    }
  } catch (error) {
    console.error("❌ Error listing S3 files:", error);
  }
}

/* ================================
   PROCESS SINGLE FILE
================================ */
async function processFile(client, fileKey) {
  try {
    const { Body } = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      })
    );

    const chunks = [];
    for await (const chunk of Body) chunks.push(chunk);
    const fileContent = Buffer.concat(chunks).toString("utf-8");

    let jsonData;
    try {
      jsonData = JSON.parse(fileContent);
    } catch {
      console.error(`❌ Invalid JSON: ${fileKey}`);
      await renameFileInS3(fileKey, "skipped");
      return;
    }

/* ================================
   DOMAIN VALIDATION
================================ */

const domain = jsonData?.company_domain || "N/A"; // ✅ ADD THIS

const isLinkedIn =
  fileKey.toLowerCase().includes("linkedin") ||
  jsonData?.source?.toLowerCase().includes("linkedin");

    if (!isLinkedIn) {
      if (!domain || domain === "N/A" || domain === "unknown_company_domain") {
        console.warn(`⚠️ Invalid domain, skipping ${fileKey}`);
        await renameFileInS3(fileKey, "skipped");
        return;
      }
    }

    /* ================================
       COLLECTION SELECTION
    ================================ */
    const collectionName = getCollectionName(fileKey, jsonData);
    if (!collectionName) {
      console.warn(`⚠️ No collection matched for ${fileKey}`);
      await renameFileInS3(fileKey, "skipped");
      return;
    }

    const db = client.db(DB_NAME);
    const collection = db.collection(collectionName);

    /* ================================
       UPSERT INTO MONGODB
    ================================ */
    await collection.updateOne(
      { fileName: fileKey },
      {
        $set: {
          fileName: fileKey,
          source: jsonData.source || "unknown",
          profile_type: jsonData.profile_type || null,
          domain,
          content: jsonData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`✅ Stored in MongoDB → ${collectionName}`);
    await renameFileInS3(fileKey, "processed");
  } catch (error) {
    console.error(`❌ Error processing ${fileKey}:`, error);
  }
}

/* ================================
   MAIN LOOP (3 HOURS)
================================ */
async function main() {
  while (true) {
    console.log("🚀 S3 → MongoDB job started");
    const client = await connectToMongoDB();
    await listAndProcessFiles(client);
    await client.close();
    console.log("⏳ Sleeping for 3 hours...");
    await new Promise((r) => setTimeout(r, 3 * 60 * 60 * 1000));
  }
}

main().catch(console.error);
