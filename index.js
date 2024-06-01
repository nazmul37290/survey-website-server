const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 4000;
const { MongoClient, ServerApiVersion } = require("mongodb");

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("survey is ongoing");
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.0kf8y7n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("surveyStream").collection("users");

    // users related apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users", async (req, res) => {
      const { name, email } = req.body;
      console.log("email and name from put method", name, email);
      const filter = { email: email };
      const isUser = await usersCollection.findOne(filter);
      console.log("user detaiils from db", isUser);
      const options = { upsert: true };
      let updateUser;

      if (isUser) {
        updateUser = {
          $set: {
            name: name,
            email: email,
            role: isUser.role,
          },
        };
      } else {
        updateUser = {
          $set: {
            name: name,
            email: email,
            role: "user",
          },
        };
      }

      const result = await usersCollection.updateOne(
        filter,
        updateUser,
        options
      );
      console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
