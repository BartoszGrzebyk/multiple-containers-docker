const keys = require('./keys')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { Client } = require('pg');
const pgClient = new Client({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

(async() => {
  try {
    await pgClient.connect()
  }   catch(e) {
    console.log(e)
  }
    
})();

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(error => console.log(error));

const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

const sub = redisClient.duplicate();

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  const parsedIndex = parseInt(index);

  if(isNaN(parsedIndex)) {
    return res.status(422).send('Index is not a number');
  }

  if (parseInt(parsedIndex) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet');
  redisPublisher.publish('insert', index);

  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({working: true})
});

app.listen(5000, err => {
  console.log('Listening')
})