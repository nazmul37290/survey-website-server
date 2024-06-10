const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SECRET);
const port = process.env.PORT || 4000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middlewares
app.use(
  cors({
    origin: [
      "https://survey-stream.web.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
  })
);
app.use(express.json());

// custom middlewares

const verifyToken = (req, res, next) => {
  console.log("req intercepted ");
  console.log(req.headers.authorization, "from verfy token");
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const surveysCollection = client.db("surveyStream").collection("surveys");
    const paymentsCollection = client.db("surveyStream").collection("payments");
    const responseCollection = client
      .db("surveyStream")
      .collection("responses");
    const unPublishSurveyCollection = client
      .db("surveyStream")
      .collection("unPublished");
    const reportedSurveysCollection = client
      .db("surveyStream")
      .collection("reportedSurveys");

    // users related apis
    app.get("/users", verifyToken, async (req, res) => {
      console.log(req.headers);
      let query = {};
      console.log(req.query);
      if (req.query.role) {
        query = { role: req.query.role };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

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

    app.patch("/users", verifyToken, async (req, res) => {
      const data = req.body;
      console.log(data, "user");
      const filter = { email: data.email };
      const updateData = {
        $set: {
          role: data.newRole,
        },
      };
      const result = await usersCollection.updateOne(filter, updateData);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });
    // survey related apis

    app.get("/surveys", async (req, res) => {
      const result = await surveysCollection.find().toArray();
      res.send(result);
    });

    app.get("/surveys/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id, "form 153");
      const query = { _id: new ObjectId(id) };
      const result = await surveysCollection.findOne(query);
      res.send(result);
    });
    app.get("/surveys/user/reports", verifyToken, async (req, res) => {
      const email = req.query.email;

      const query = { reportedBy: email };
      const result = await reportedSurveysCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/surveys/user/participated", verifyToken, async (req, res) => {
      const email = req.query.email;

      const query = { "responses.votedUserEmail": email };
      const result = await responseCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/surveys/unpublished/feedbacks", async (req, res) => {
      const result = await unPublishSurveyCollection.find().toArray();
      res.send(result);
    });
    app.post("/surveys", verifyToken, async (req, res) => {
      const data = req.body;
      const time = new Date();
      const timestamp = time.toLocaleDateString("ja-JP");
      const voteCount = 0;
      const status = "publish";
      const survey = { ...data, timestamp, status, voteCount };
      const result = await surveysCollection.insertOne(survey);
      res.send(result);
    });
    app.post("/surveys/report", verifyToken, async (req, res) => {
      const survey = req.body;

      const result = await reportedSurveysCollection.insertOne(survey);
      res.send(result);
    });
    app.get("/surveys/responses/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const filter = { surveyId: id };
      const result = await responseCollection.findOne(filter);
      res.send(result);
    });
    app.put("/surveys/response", verifyToken, async (req, res) => {
      const {
        _id,
        title,
        description,
        category,
        deadline,
        surveyorEmail,
        questions,
        responses,
      } = req.body;
      //   console.log(response);
      const filter = { surveyId: _id };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          title,
          description,
          category,
          deadline,
          surveyorEmail,
          questions,
        },
        $push: {
          responses: responses[0],
        },
      };
      const result = await responseCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.patch("/surveys/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedStatus = req.body;
      console.log(id, updatedStatus);
      const filter = { _id: new ObjectId(id) };
      const newStatus = {
        $set: {
          status: updatedStatus.newStatus,
        },
      };
      const update = await surveysCollection.updateOne(filter, newStatus);
      if (updatedStatus.feedback) {
        const result = await unPublishSurveyCollection.insertOne({
          surveyId: id,
          feedback: updatedStatus.feedback,
        });
        res.send(result);
      }
      //   res.send(update);
    });

    // payment related apis
    app.get("/payments", async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    });
    app.post("/create-payment-intent", async (req, res) => {
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: 2000,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.patch("/payments", async (req, res) => {
      const payment = req.body;
      const filter = { email: payment.email };
      const updateDoc = {
        $set: {
          role: "pro-user",
        },
      };
      const updateRole = await usersCollection.updateOne(filter, updateDoc);
      const addPayment = await paymentsCollection.insertOne(payment);
      res.send(addPayment);
    });

    // authorization related apis

    app.post("/checkRole", async (req, res) => {
      const { email } = req.body;
      const filter = { email: email };
      const result = await usersCollection.findOne(filter);
      console.log(result);
      res.send(result);
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
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
