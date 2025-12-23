const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
let pool;

async function initDatabase() {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password123',
        database: process.env.DB_NAME || 'users_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();
        console.log('✅ Users Service: Database connected');
        connection.release();
    } catch (error) {
        console.error('❌ Users Service: Database connection failed:', error);
        process.exit(1);
    }
}

// Routes
app.get('/health', (req, res) => {
    res.json({ 
        service: 'users-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Register user
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, phone]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.insertId, email },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId: result.insertId,
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile
app.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        const [users] = await pool.query(
            'SELECT id, name, email, phone, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
app.put('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, phone } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        await pool.query(
            'UPDATE users SET name = ?, phone = ? WHERE id = ?',
            [name, phone, userId]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users (admin only)
app.get('/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

        const [users] = await pool.query(
            'SELECT id, name, email, phone, created_at FROM users'
        );

        res.json({ users });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Validate token (for other services)
app.post('/validate-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ valid: false, error: 'Token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        res.json({ valid: true, user: decoded });
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Users Service running on port ${PORT}`);
        console.log(`📡 Endpoints:`);
        console.log(`   POST   http://localhost:${PORT}/register`);
        console.log(`   POST   http://localhost:${PORT}/login`);
        console.log(`   GET    http://localhost:${PORT}/profile/:id`);
        console.log(`   GET    http://localhost:${PORT}/health`);
    });
}

startServer().catch(console.error);