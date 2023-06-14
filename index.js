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

// verify is user is login and user have the access token!
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
    // all db collections
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
    // all db collections

    // jwt sign for give users verification token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // verify is user admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // verify is user instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // get user is role
    app.get("/users/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

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
      res.send(role);
    });

    //   instructors api
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      if ((popular = "1")) {
        const result = await usersCollection.find(query).limit(6).toArray();
        return res.send(result);
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //  get all approved classes also you can get all classes by this api
    app.get("/classes", async (req, res) => {
      const status = req.query.role;
      let query = {};
      if (status === "approved") {
        query = { status: "approved" };
      }
      // for get popular 6 classes
      if (req.query.popular === "1") {
        const result = await classesCollection
          .find({ totalStudent: { $exists: true } })
          .sort({ totalStudent: -1 })
          .limit(6)
          .toArray();
        return res.status(200).send(result);
      }
      const result = await classesCollection.find(query).toArray();
      res.status(200).send(result);
    });

    //  get classes by instructor email api
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        let query = { instructorEmail: email };
        const result = await classesCollection.find(query).toArray();
        res.status(200).send(result);
      }
    );

    //only instructor can post a class using this api
    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const doc = req.body;
      console.log(doc);
      const result = await classesCollection.insertOne(doc);
      res.status(200).send(result);
    });
    //only admin can update class data
    app.put("/classes/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // this part is used for update or add feedback in particular class
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
        // and this part is used for update the status of this class
        const updateDoc = {
          $set: {
            status: body.newStatus,
          },
        };
        const result = await classesCollection.updateOne(query, updateDoc);
        res.status(200).send(result);
      }
    });
    // this api is used for add new user registration
    app.post("/users", async (req, res) => {
      const doc = req.body;

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

    // update user by id
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

    // add class to selected collection
    app.post("/selected", verifyJWT, async (req, res) => {
      const updatedDoc = req.body;
      const result = await selectedCollection.insertOne(updatedDoc);
      console.log(result);
      res.status(200).send(result);
    });

    // delete from selection
    app.delete("/selected/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      console.log(result);
      res.status(200).send(result);
    });

    // get selected classes by email
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

    // this api is post all payments records
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const insertResult = await paymentCollection.insertOne(payment);

      //  this part is for delete the selected class
      const query = {
        _id: { $in: payment.selectedItemIds.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedCollection.deleteMany(query);
      // this part is for update the availableSeats and total enrolled Student
      const filter = {
        _id: { $in: payment.classIds.map((id) => new ObjectId(id)) },
      };
      const updatedDoc = {
        $inc: {
          availableSeats: -1,
          totalStudent: +1,
        },
      };
      const updateResult = await classesCollection.updateMany(
        filter,
        updatedDoc,
        { upsert: 1 }
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
