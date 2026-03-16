const express = require('express');
const cors = require('cors');
require('dotenv').config();
const admin = require("firebase-admin");
const jwt = require('jsonwebtoken');
console.log(process.env);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// smartDealsDBUser
// FsrV0eyEyjVgv5oD

// Middleware
app.use(cors());
app.use(express.json());

const verifyFirebaseAuthToken = async (req, res, next) => {
    const authorization = req.headers.authorization;

    if(!authorization) {
        return res.status(401).send({message: "Unathorzed access 1!"});
    }

    const token = authorization.split(' ')[1];
    console.log("Raw token is: ", token)

    try {
        const decoded = await admin.auth().verifyIdToken(token);

        console.log("Decoded inside VFAT: ", decoded);

        req.token_email = decoded.email;

        next();
    } catch(error) {
        console.log("Unathorized access 2!");

        return res.status(401).send({message: "Unathorized Acces 2!"});
    }
}

// const verifyFirebaseToken = async (req, res, next) => {

//     if(!req.headers.authorization) {
//         return res.status(401).send({message: "Unathorized Access 1"});
//     }

//     const token = req.headers.authorization.split(' ')[1];

//     if(!token) {
//         return res.status(401).send({message: "Unauthorzed Access2"});
//     }

//     try {
//         const tokenInfo = await admin.auth().verifyIdToken(token);
//         console.log("Token info after verification: ", tokenInfo);
//         req.tokenEmail = tokenInfo.email;

//         next();
//     } catch (error) {
//         console.log("Invalid token: ", error);
//         return res.status(401).send({ message: "Unauthorzed Access" });
//     }

//     console.log("In the verify middleware, token: ", token);

//     // next();
// }

const verifyJWTToken = (req, res, next) => {
    console.log("In 'verifyJWTToken': ", req.headers);

    const authorization = req.headers.authorization;

    if(!authorization) {
        console.log("Unathorized 1");
        return res.status(401).send({message: "Unauthorized 1"});
    }

    const token = authorization.split(' ')[1];

    if(!token) {
        console.log("Unathorized 2");
        return res.status(401).send({ message: "Unauthorized 2" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) {
            console.log("Unathorized 3: ", err);
            return res.status(401).send({ message: "Unauthorized 3" });
        }

        console.log("After decoded: ", decoded);
        next();
    })
}

const logger = (req, res, next) => {
    console.log("Logging Information...");
    next();
}


// const uri = "mongodb+srv://smartDealsDBUser:FsrV0eyEyjVgv5oD@smartdealsdb.0btaloc.mongodb.net/?appName=SmartDealsDB";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@smartdealsdb.0btaloc.mongodb.net/?appName=SmartDealsDB`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db('smart_deals_db');
        const productsCollection = database.collection('products');
        const bidsCollection = database.collection('bids');
        const usersCollection = database.collection('users');

        // JWT-related APIs
        app.post('/get-token', (req, res) => {
            const loggedUserEmail = req.body;
            const token = jwt.sign(loggedUserEmail, process.env.JWT_SECRET, {expiresIn: '1h'});

            res.send({ token: token });
        })

        // API Endpoints for Products
        app.get('/products', async (req, res) => {
            const sortFields = { price_min: -1 };
            const limit = 5;
            const projectFields = { image: 1, status: 1, title: 1, price_min: 1, price_max: 1 };
            const cursor = productsCollection.find().sort(sortFields).skip(2).limit(limit).project(projectFields);
            const products = await cursor.toArray();

            res.send(products);
        })

        app.get('/products/my-bade-products', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.send("No email is provided!");
            }

            let query = { buyer_email: email };
            const cursor = bidsCollection.find(query);
            const bids = await cursor.toArray();

            const productIds = bids.map(bid => new ObjectId(bid.product));
            query = { _id: { $in: productIds } };
            const badeProducts = await productsCollection.find(query).project({ _id: 1, image: 1, title: 1, price_max: 1 }).toArray();

            res.send(badeProducts);
        })

        app.get('/recent-products', async (req, res) => {
            const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6);
            const recentProducts = await cursor.toArray();

            res.send(recentProducts);
        })

        app.get('/products/my-bids', verifyFirebaseAuthToken, async (req, res) => {
            // console.log("Headers:  ", req.headers);
            const email = req.query.email;
            let query = {};

            if (email) {
                query.buyer_email = email;

                if(email !== req.token_email) {
                    return res.status(403).send({message: "Forbidden access!"});
                }
            } else {
                return res.send("No email is provided for checking the bids.");
            }

            const cursor = bidsCollection.find(query);
            const bids = await cursor.toArray();

            res.send(bids);
        })

        // app.get('/products/my-bids', logger, verifyFirebaseToken, async (req, res) => {
        //     // console.log("Headers:  ", req.headers);
        //     const email = req.query.email;
        //     const tokenEmail = req.tokenEmail;
        //     let query = {};

        //     if (email) {
        //         if(tokenEmail !== email) {
        //             console.log("Forbidden!");
        //             return res.status(403).send({message: "Forbidden!"});
        //         }

        //         query = { buyer_email: email };
        //     } else {
        //         return res.send("No email is provided for checking the bids.");
        //     }

        //     const cursor = bidsCollection.find(query);
        //     const bids = await cursor.toArray();

        //     res.send(bids);
        // })

        app.delete('/products/my-bids/:bidId', async (req, res) => {
            const bidId = req.params.bidId;
            const query = { _id: new ObjectId(bidId) };
            const result = await bidsCollection.deleteOne(query);

            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                res.status(404).send({ error: "Invalid Product ID" });
            }

            const query = { _id: new ObjectId(id) };
            const product = await productsCollection.findOne(query);

            res.send(product);
        })

        app.post('/products', verifyFirebaseAuthToken, async (req, res) => {
            console.log("Headers in the Post Product: ", req.headers);
            
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    productName: updatedProduct.productName,
                    price: updatedProduct.price,
                }
            }
            const result = await productsCollection.updateOne(filter, updateDoc, options);

            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productsCollection.deleteOne(query);

            res.send(result);
            console.log(result);
        })

        // API Endpoints for Bids
        app.post('/bids', async (req, res) => {
            const bid = req.body;
            const result = await bidsCollection.insertOne(bid);

            res.send(result);

        })

        app.get('/products/:productId/bids', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId };
            const cursor = bidsCollection.find(query).sort({ bid_Price: -1 });
            const result = await cursor.toArray();

            res.send(result);
        })

        // API Endpoints for Sign In with Google
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                res.send({ message: "User already exists" });
            } else {
                const result = await usersCollection.insertOne(user);
                res.send("User information saved to the database successfully");
            }
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (err) {
        console.error("An error occurred while connecting to MongoDB:", err);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});