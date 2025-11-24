const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at ' + DB_PATH);
        initDB();
    }
});

function initDB() {
    db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    client TEXT,
    location TEXT,
    startDate TEXT,
    endDate TEXT,
    description TEXT,
    flights TEXT, -- Stored as JSON string
    crew TEXT     -- Stored as JSON string
  )`, (err) => {
        if (err) console.error('Error creating table:', err.message);
    });
}

// Helper to wrap db.all in Promise
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Helper to wrap db.run in Promise
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// API Routes

// GET all projects
app.get('/api/projects', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM projects");
        // Parse JSON strings back to objects
        const projects = rows.map(p => ({
            ...p,
            flights: p.flights ? JSON.parse(p.flights) : [],
            crew: p.crew ? JSON.parse(p.crew) : []
        }));
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST (Create/Update)
app.post('/api/projects', async (req, res) => {
    try {
        const p = req.body;
        const flightsJson = JSON.stringify(p.flights || []);
        const crewJson = JSON.stringify(p.crew || []);

        // Check if exists
        const existing = await dbAll("SELECT id FROM projects WHERE id = ?", [p.id]);

        if (existing.length > 0) {
            // Update
            await dbRun(
                `UPDATE projects SET name=?, client=?, location=?, startDate=?, endDate=?, description=?, flights=?, crew=? WHERE id=?`,
                [p.name, p.client, p.location, p.startDate, p.endDate, p.description, flightsJson, crewJson, p.id]
            );
            res.json({ success: true, message: 'Updated' });
        } else {
            // Create
            await dbRun(
                `INSERT INTO projects (id, name, client, location, startDate, endDate, description, flights, crew) VALUES (?,?,?,?,?,?,?,?,?)`,
                [p.id, p.name, p.client, p.location, p.startDate, p.endDate, p.description, flightsJson, crewJson]
            );
            res.json({ success: true, message: 'Created' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE project
app.delete('/api/projects/:id', async (req, res) => {
    try {
        await dbRun("DELETE FROM projects WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
