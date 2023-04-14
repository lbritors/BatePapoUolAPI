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



const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
}catch(err) {
 console.log(err.message);
}
const db = mongoClient.db();



app.post("/participants", async(req, res) => {
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

    try{
        await  db.collection("participants").insertOne(participant);
        db.collection("messages").insertOne(entering);
        res.status(201).send(participant).send(entering);
    

    }catch(err) {
        console.log(err.message);
        res.sendStatus(500);

    }   

});

app.post("/messages",async(req, res) => {
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

    try{
        await db.collection("messages").insertOne(message);
        res.status(201).send(message);
    }catch(err){
        console.log(err.message);
        res.sendStatus(500);
    }

  

});

  
app.listen(5000, () => console.log("Listening Port 5000"));