const admin = require("firebase-admin");
const serviceAccount = require("../secretAssets/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mernboilerplate-7c1c9.firebaseio.com",
});

module.exports = admin;
