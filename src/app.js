import express, { text } from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import 'dayjs/locale/pt-br.js'



const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
dayjs.locale("pt-br");


const users = [];
const messages = [];

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect().then(() => {db= mongoClient.db()}).catch(err => console.log(err.message));


app.post("/participants", (req, res) => {
    const  {name} = req.body;
    const schema = Joi.object({
        name: Joi.string().required().min(2),
        lastStatus: Joi.allow()
    })
    const participant = {
        name: name,
        lastStatus: Date.now()
    };
    const result = schema.validate(participant);
    const entering = { 
    from: name, 
    to: 'Todos', 
    text: 'entra na sala...',
    type: 'status',
    time: dayjs().format('HH:mm:ss') }
    console.log(entering.time);
      
    if(result.error !== undefined) {
        return res.status(422).send(result.error.message)
    }

    db.collection("participants").insertOne(participant).then((result) => {
        res.status(201).send(result)
        db.collection("messages").insertOne(entering).then((mensagem) => res.status(201).send(mensagem)).catch(err => res.status(500).send(err.message))})
    .catch((err) => res.status(500).send(err.message));
    

});

app.post("/messages", (req, res) => {
    const {to, text, type} = req.body;
    const {user} = req.headers;
    console.log(user);
    const schema = Joi.object({
        from: Joi.required(),
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.any().valid('message', 'private_message').required(),
        time: Joi.allow()
    });
    const message = {
        from: user,
        to: to,
        text: text,
        type: type,
        time: dayjs().format('HH:mm:ss')
    }

    const result = schema.validate(message);
    
    if(result.error !== undefined) {
        return res.status(422).send(result.error.message);
    }

    db.collection("messages").insertOne(message).then((n) => {res.status(201).send(n)}).
    catch((err) => res.status(500).send(err.message));

});

  
app.listen(5000, () => console.log("Listening Port 5000"));