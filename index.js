require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { errorHandler } = require('./auth');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { bootstrapAdmin } = require('./controllers/userController');
const { migrate } = require('./services/migrate');

const app = express();

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8000').split(',').map(s => s.trim());
app.use(cors({ origin: origins, credentials: true, optionsSuccessStatus: 200 }));
app.use(express.json({ limit: '200kb' }));

app.get('/health', (req, res) => res.send({ ok: true }));
app.use('/users', userRoutes);
app.use('/', reportRoutes);
app.use((req, res) => res.status(404).send({ error: 'Not found.' }));
app.use(errorHandler);

if (require.main === module) {
	if (!process.env.JWT_SECRET_KEY) {
		console.error('JWT_SECRET_KEY is missing. Copy server/.env.example to server/.env and fill it in.');
		process.exit(1);
	}
	mongoose.connect(process.env.MONGODB_STRING)
		.then(async () => {
			console.log('Now connected to MongoDB.');
			await migrate();
			await bootstrapAdmin();
			app.listen(process.env.PORT || 4000, () => console.log(`API is now online on port ${process.env.PORT || 4000}`));
		})
		.catch(err => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
}

module.exports = { app };
