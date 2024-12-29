import express, { Request, Response } from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript with Express!');
});

app.post('/data', (req: Request, res: Response) => {
  const { name, age } = req.body;
  res.json({ message: `Hello ${name}, you are ${age} years old.` });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
