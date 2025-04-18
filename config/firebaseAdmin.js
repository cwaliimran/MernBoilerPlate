const admin = require("firebase-admin");
const serviceAccount = require("../secretAssets/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://borrow-app-b39b2.firebaseio.com",
});

module.exports = admin;
