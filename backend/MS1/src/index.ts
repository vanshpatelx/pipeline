import express, { Express } from 'express';
import { Client as CassandraClient } from 'cassandra-driver';
import Redis from 'ioredis';
import { Client as PgClient } from 'pg';
import amqp from 'amqplib/callback_api';
import { Channel } from 'amqplib';
import dotenv from 'dotenv';

const app: Express = express();
app.use(express.json());

dotenv.config();

const amqpUrl = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`;

// Connect to RabbitMQ
let channel: Channel;
let connection;
amqp.connect(amqpUrl, (err, conn) => {
  if (err) {
    console.error('Error connecting to RabbitMQ:', err);
    return;
  }
  connection = conn;
  connection.createChannel((err, ch) => {
    if (err) {
      console.error('Error creating RabbitMQ channel:', err);
      return;
    }
    channel = ch;
    const exchange = 'userExchange';
    channel.assertExchange(exchange, 'fanout', { durable: false });
    console.log('RabbitMQ Successfully Connected');
  });
});

// Route to add user to DB and Cache with only username
app.post('/addUser', async (req, res) => {
  const { username } = req.body; // Now, only username is passed

  try {
    // Insert into PostgreSQL (only username)
    const pgQuery = 'INSERT INTO Dbusers(user_name) VALUES($1)';
    await pgClient1.query(pgQuery, [username]);
    console.log(`User added to PostgreSQL with username: ${username}`);

    // Insert into Cassandra (only username)
    const cassandraQuery = 'INSERT INTO Dbusers(user_name) VALUES (?)';
    await cassandra.execute(cassandraQuery, [username], { prepare: true });
    console.log(`User added to Cassandra with username: ${username}`);

    // Add to Redis cache (store only username)
    redisClient1.set(`userCacheKey:${username}`, JSON.stringify({ username }));
    console.log(`User added to Redis cache with username: ${username}`);

    // Publish to RabbitMQ exchange (only username)
    channel.publish('userExchange', '', Buffer.from(JSON.stringify({ username })));

    res.status(200).send('User added successfully to DB and Cache with username only.');
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).send('Error adding user to DB or Cache: ' + err);
  }
});

// Route to check user from DB and Cache (fetch user by username)
app.get('/checkUser/:username', async (req, res) => {
  const { username } = req.params; // Extract username from request parameters

  try {
    const results = {}; // Object to store combined results

    // Step 1: Check Redis cache
    const redisPromise = new Promise((resolve) => {
      redisClient1.get(`userCacheKey:${username}`, (err, cacheResult) => {
        if (err) {
          console.error('Error fetching from Redis:', err);
          resolve(null);
        } else if (cacheResult) {
          results.cache = JSON.parse(cacheResult);
          resolve(results.cache);
        } else {
          resolve(null);
        }
      });
    });

    // Step 2: Check PostgreSQL
    const postgresPromise = new Promise(async (resolve) => {
      try {
        const pgQuery = 'SELECT * FROM Dbusers WHERE user_name = $1';
        const pgResult = await pgClient1.query(pgQuery, [username]);
        if (pgResult.rows.length > 0) {
          results.postgresql = pgResult.rows[0];
          // Cache result in Redis for future requests
          redisClient1.set(`userCacheKey:${username}`, JSON.stringify(pgResult.rows[0]));
        }
        resolve(results.postgresql || null);
      } catch (err) {
        console.error('Error querying PostgreSQL:', err);
        resolve(null);
      }
    });

    // Step 3: Check Cassandra
    const cassandraPromise = new Promise((resolve) => {
      cassandra.execute('SELECT * FROM Dbusers WHERE user_name = ?', [username], { prepare: true }, (err, cassandraResult) => {
        if (err) {
          console.error('Error querying Cassandra:', err);
          resolve(null);
        } else if (cassandraResult.rows.length > 0) {
          results.cassandra = cassandraResult.rows[0];
          // Cache result in Redis for future requests
          redisClient1.set(`userCacheKey:${username}`, JSON.stringify(cassandraResult.rows[0]));
        }
        resolve(results.cassandra || null);
      });
    });

    // Wait for all promises to complete
    await Promise.all([redisPromise, postgresPromise, cassandraPromise]);

    // Check if any result was found
    if (Object.keys(results).length > 0) {
      return res.json({ source: 'combined', data: results });
    } else {
      return res.status(404).send('User not found in any database.');
    }
  } catch (err) {
    console.error('Error checking user:', err);
    res.status(500).send('Error checking user: ' + err);
  }
});


// Listen on port 8090
app.listen(8090, () => {
  console.log('TypeScript Service running on port 8090');
});


const cassandra = new CassandraClient({
  contactPoints: [process.env.CASSANDRA_CONTACT_POINTS],
  localDataCenter: process.env.CASSANDRA_LOCAL_DATA_CENTER,
  keyspace: process.env.CASSANDRA_KEYSPACE,
});


async function createKeyspaceIfNeeded() {
  const createKeyspaceQuery = `
    CREATE KEYSPACE IF NOT EXISTS myapp_keyspace
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
  `;
  return new Promise<void>((resolve, reject) => {
    cassandra.execute(createKeyspaceQuery, (err) => {
      if (err) {
        reject('Error creating keyspace in Cassandra: ' + err);
        return;
      }
      console.log('Cassandra keyspace created or already exists.');
      resolve();
    });
  });
}

async function createCassandraTableIfNeeded() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS myapp_keyspace.Dbusers (
      user_name TEXT PRIMARY KEY
    );
  `;
  return new Promise<void>((resolve, reject) => {
    cassandra.execute(createTableQuery, (err) => {
      if (err) {
        reject('Error creating Cassandra table: ' + err);
        return;
      }
      console.log('Cassandra table created or already exists.');
      resolve();
    });
  });
}

async function connectToKeyspace() {
  await createKeyspaceIfNeeded();
  await createCassandraTableIfNeeded();
  cassandra.keyspace = 'myapp_keyspace';
  cassandra.connect((err) => {
    if (err) {
      console.error('Cassandra connection error:', err);
    } else {
      console.log('Connected to Cassandra with keyspace: myapp_keyspace');
    }
  });
}

connectToKeyspace();

// Redis Setup

const redisClient1 = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
});


// Ensure Redis client is connected
redisClient1.on('connect', () => {
  console.log('Connected to Redis');
});

// Check for any connection errors
redisClient1.on('error', (err) => {
  console.error('Error connecting to Redis:', err);
});

const pgClient1 = new PgClient({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASS,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});


async function createPostgresTableIfNeeded() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS Dbusers (
      user_name TEXT PRIMARY KEY
    );
  `;
  try {
    const res = await pgClient1.query(createTableQuery);
    console.log('PostgreSQL table created or already exists.', res);
  } catch (err) {
    console.error('Error creating PostgreSQL table:', err);
  }
}

pgClient1.connect()
  .then(() => {
    console.log('Connected to PostgreSQL Database 1');
    createPostgresTableIfNeeded();
  })
  .catch((err) => console.error('PostgreSQL connection error:', err));
