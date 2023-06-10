const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_PASS}@cluster0.vt0qgrn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    const usersCollection = client
      .db("acting-fable")
      .collection("usersCollection");
    const classesCollection = client
      .db("acting-fable")
      .collection("classesCollection");

    //   instructors api
    app.get("/instructors", async (req, res) => {
      console.log("hited");
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //   classes api
    app.get("/classes", async (req, res) => {
      const status = req.query.role;
      let query;
      if (status === "approved") {
        query = { status: "approved" };
      }
      const result = await classesCollection.find(query).toArray();
      res.status(200).send(result);
    });
    app.post("/classes", async (req, res) => {
      const doc = req.body;
      console.log(doc);
      const result = await classesCollection.insertOne(doc);
      res.status(200).send(result);
    });
    // all use api
    app.post("/users", async (req, res) => {
      const doc = req.body;
      //   console.log(doc);
      const allUsers = await usersCollection.find().toArray();
      const isExist = allUsers.find((user) => user.email === doc.email);

      const isEmailExist = allUsers.find(
        (user) => user.name === doc.name && user.photo === doc.photo
      );
      if (isEmailExist) {
        return res.status(200);
      }
      if (isExist && doc.email) {
        return res.status(200);
      }
      const result = await usersCollection.insertOne(doc);
      res.status(200).send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Test Api running");
});

app.listen(port, () => {
  console.log("daylight server run on port=", port);
});
