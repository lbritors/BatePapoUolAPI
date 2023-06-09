import express, { text } from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import 'dayjs/locale/pt-br.js';
import { stripHtml } from "string-strip-html";
import {strict as assert} from "assert" 



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
        lastStatus: Joi.date().default(Date.now)
    })
    const participant = {
        name: name,
        lastStatus: Date.now()
    };
    
    const result = schema.validate(participant, {abortEarly: false});
    if(result.error !== undefined) {
        return res.status(422).send(result.error.message)
    }
    

    const entering = { 
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss') }
        console.log(result);

    try{
        const nameExists = await db.collection("participants").findOne({name: name});
        if(nameExists) {
            return res.sendStatus(409);
        }
        await  db.collection("participants").insertOne(participant);
        await db.collection("messages").insertOne(entering);
        return res.sendStatus(201);
    

    }catch(err) {
        
        res.status(500).send(err.message);

    }   

});

app.get("/participants", async(req, res) => {
   
    try{
        const user = await db.collection("participants").find().toArray();
        res.send(user)

    }catch(err) {
        res.status(500).send(err.message);
    }
});

app.post("/messages",async(req, res) => {
    const {to, text, type} = req.body;
    
    const {user} = req.headers;
    console.log(user);
    const schema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.any().valid('message', 'private_message').required(),
        time: Joi.allow()
    });
   
    const message = {
        from:  user,
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
        const usuario = await db.collection("participants").find({name:user}).toArray();
        console.log(usuario)
        if(usuario.length === 0) {
            return res.sendStatus(422);
        }
        await db.collection("messages").insertOne(message);
        res.status(201).send(message);
    }catch(err){
        console.log(err.message);
        res.sendStatus(500);
    }

  

});

app.get("/messages", async(req, res) => {
    const {user} = req.headers;
    const limit = req.query.limit;
    const num = Number(limit);
    console.log(limit);
    console.log(user);

    try{
        const mensagensFiltro = await db.collection("messages").find({$or: [{to: "Todos"}, {to: user}, {from: user}]}).toArray();
        if(!limit) {
            return res.send(mensagensFiltro);
        }
        else if(isNaN(num) || num <= 0) {
            return res.sendStatus(422);
        } else {
            const number = Number(limit);
            return res.send(mensagensFiltro.slice(-number));
        }

    }catch(err){
        res.status(500).send(err.message);
    }



});

app.post("/status", async(req, res) => {
    const {user} = req.headers;

    if(!user) {
        return res.sendStatus(404);
    }
    try{
        const participant = await db.collection("participants").findOneAndUpdate({name: user}, {$set: {"lastStatus": Date.now()}});
        if(participant.value === null) {
            return res.sendStatus(404);
        }   
        res.sendStatus(200);

    }catch(err) {
        console.log(err.message);
        res.sendStatus(500);

    }

})

app.delete("/messages/:id", async(req, res) => {
    const {user} = req.headers;
    const{ id } = req.params;

    try{
        
        const message = await db.collection("messages").find({_id: new ObjectId(id)}).toArray();
        
        if(message.length === 0) {
            return res.sendStatus(404);
        } 
        if(message[0].from !== user) {
            return res.sendStatus(401);
        }
        
        const deleting = await db.collection("messages").findOneAndDelete({_id: new ObjectId(id)});
        if(deleting.deletedCount !== 0) {
            return res.sendStatus(200);
        }
    
    }catch(err) {
        res.status(500).send(err.message);
    }

})

app.put("/messages/:id", async(req, res) => {
    const {to, text, type} = req.body;
    const {user} = req.headers;
    const {id} =req.params;

    const schema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.any().valid('message', 'private_message').required(),
    });
    const message = {
        from:  user,
        to: to,
        text: text,
        type: type
    }

    const result = schema.validate(message);
    if(result.error !== undefined) {
        return res.status(422).send(result.error.message);
    }
    
    try{
        const usuario = await db.collection("participants").find({name:user}).toArray();
        const match = await db.collection("messages").find({_id: new ObjectId(id)}).toArray();
        if(usuario.length === 0) {
            return res.sendStatus(422);
        }
        if(match.length === 0) {
            return res.sendStatus(404);
        }
        if(match[0].from !== user) {
            return res.sendStatus(401);
        }

        await db.collection("messages").updateOne({_id:new ObjectId(id)}, {$set: message});
        res.send("Updated");

    }catch(err) {
        res.status(500).send(err.message);
    }

});

setInterval(async() => {
    const hora = Date.now();
    const loggedOut =  await db.collection("participants").find({lastStatus: {$lt: hora - 10000}});
    loggedOut.forEach(part => {
        db.collection("messages").insertOne({ 
            from: part.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        db.collection("participants").findOneAndDelete({name: part.name});
    })
    

},15000);
  
app.listen(5000, () => console.log("Listening Port 5000"));