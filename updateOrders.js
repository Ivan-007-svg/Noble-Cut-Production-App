const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Replace with your actual key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateOrders() {
  const snapshot = await db.collection("orders").get();

  const updates = snapshot.docs.map(async (doc) => {
    const data = doc.data();

    const updateData = {
      orderCode: data.orderCode || doc.id,
      clientName: data.clientName || "Unknown Client",
      orderQuantity: data.orderQuantity || 1,
      fabricArticle: data.fabricArticle || "UNKNOWN",
      orderDate: data.orderDate || "2025-05-28",
      deliveryDate: data.deliveryDate || "2025-06-15",
      status: data.status || "Pending",
      shirtLine: data.shirtLine || "Signature",
    };

    await doc.ref.update(updateData);
    console.log(`✅ Updated ${doc.id}`);
  });

  await Promise.all(updates);
  console.log("🚀 All orders updated successfully.");
}

updateOrders().catch(console.error);
