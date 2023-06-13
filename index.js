const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized response" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized response" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const selectedCollection = client
      .db("acting-fable")
      .collection("selectedCollection");
    const feedbackCollection = client
      .db("acting-fable")
      .collection("feedbackCollection");
    const paymentCollection = client
      .db("acting-fable")
      .collection("paymentCollection");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // get user is role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;

      // if (req.decoded.email !== email) {
      //   res.send({ admin: false });
      // }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let role = "student";
      if (user?.role === "admin") {
        role = { role: "admin" };
      }
      if (user?.role === "instructor") {
        role = { role: "instructor" };
      }
      if (user?.role === "student") {
        role = { role: "student" };
      }
      console.log(role);
      res.send(role);
    });

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
      let query = {};
      if (status === "approved") {
        query = { status: "approved" };
      }
      const result = await classesCollection.find(query).toArray();
      res.status(200).send(result);
    });

    app.post("/classes", verifyJWT, async (req, res) => {
      const doc = req.body;
      console.log(doc);
      const result = await classesCollection.insertOne(doc);
      res.status(200).send(result);
    });
    app.put("/classes/:id", async (req, res) => {
      console.log("hitted");
      const body = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(req.query.feedback);
      if (req.query.feedback) {
        const updateDoc = {
          $set: {
            feedback: body.feedback,
          },
        };
        const result = await classesCollection.updateOne(query, updateDoc, {
          upsert: true,
        });
        res.status(200).send(result);
      } else {
        const updateDoc = {
          $set: {
            status: body.newStatus,
          },
        };
        const result = await classesCollection.updateOne(query, updateDoc);
        res.status(200).send(result);
      }
    });
    // post user api
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
    // get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.status(200).send(result);
    });
    // update user by uid
    app.put("/users/:id", async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: body.role,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, {
        upsert: true,
      });
      res.status(200).send(result);
    });
    // app.get("/users", async (req, res) => {
    //   const email = req.query.email;
    //   const photo = req.query.photo;
    //   console.log({ email, photo });
    //   let filter;
    //   if (!email) {
    //     filter = { photo: photo };
    //   } else {
    //     filter = { email: email };
    //   }
    //   const result = await usersCollection.findOne(filter);
    //   res.status(200).send(result);
    // });
    // post selected classes
    app.post("/selected", async (req, res) => {
      const updatedDoc = req.body;
      const result = await selectedCollection.insertOne(updatedDoc);
      console.log(result);
      res.status(200).send(result);
    });
    // delete from selection
    app.delete("/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      console.log(result);
      res.status(200).send(result);
    });
    // get selected classes by student id
    app.get("/selected/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await selectedCollection.find(query).toArray();
      console.log(result);
      res.status(200).send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.selectedItemIds.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedCollection.deleteMany(query);

      const filter = {
        _id: { $in: payment.classIds.map((id) => new ObjectId(id)) },
      };
      const updatedDoc = {
        $inc: {
          availableSeats: -1,
        },
      };
      const updateResult = await classesCollection.updateMany(
        filter,
        updatedDoc
      );

      res.send({ insertResult, deleteResult, updateResult });
    });

    // get payments by email
    app.get("/payments/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const isPayments = req.query.isPayments;
      const query = { email: email };
      const payments = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      if (isPayments) {
        return res.status(200).send(payments);
      }
      const classIds = payments.map((classes) => classes.classIds);
      const mergedIds = classIds.flat();
      console.log(mergedIds);

      const filter = {
        _id: {
          $in: mergedIds.map((id) => new ObjectId(id)),
        },
      };

      const result = await classesCollection.find(filter).toArray();
      console.log(result);
      res.status(200).send(result);
    });
    // feedback
    app.post("/feedback", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await feedbackCollection.updateOne(req.body);
      console.log(result);
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
