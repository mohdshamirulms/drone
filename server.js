const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/uas_projects';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

// Define Project Schema
const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    client: String,
    location: String,
    startDate: String,
    endDate: String,
    description: String,
    flights: [mongoose.Schema.Types.Mixed],
    crew: [mongoose.Schema.Types.Mixed]
}, { strict: false });

const Project = mongoose.model('Project', ProjectSchema);

// API Routes

// GET all projects
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await Project.find();
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST (Create/Update)
app.post('/api/projects', async (req, res) => {
    try {
        const projectData = req.body;

        // Try to update existing, or create new
        const result = await Project.findOneAndUpdate(
            { id: projectData.id },
            projectData,
            { upsert: true, new: true }
        );

        res.json({ success: true, project: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE project
app.delete('/api/projects/:id', async (req, res) => {
    try {
        await Project.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
