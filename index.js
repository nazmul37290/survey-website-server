const express = require("express");
const app = express();
const port = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("survey is ongoing");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
