const app = require("./app");

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Civic map server running at http://${HOST}:${PORT}`);
});
