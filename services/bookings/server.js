const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// External service URLs
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://localhost:3001';
const HOTELS_SERVICE_URL = process.env.HOTELS_SERVICE_URL || 'http://localhost:3002';

// Database connection
let pool;

async function initDatabase() {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password123',
        database: process.env.DB_NAME || 'bookings_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();
        console.log('✅ Bookings Service: Database connected');
        connection.release();
    } catch (error) {
        console.error('❌ Bookings Service: Database connection failed:', error);
        process.exit(1);
    }
}

// Helper function to validate token with users service
async function validateToken(token) {
    try {
        const response = await axios.post(`${USERS_SERVICE_URL}/validate-token`, { token });
        return response.data;
    } catch (error) {
        return { valid: false, error: 'Token validation failed' };
    }
}

// Helper function to get hotel details
async function getHotelDetails(hotelId) {
    try {
        const response = await axios.get(`${HOTELS_SERVICE_URL}/${hotelId}`);
        return response.data.hotel;
    } catch (error) {
        return null;
    }
}

// Helper function to check room availability
async function checkRoomAvailability(roomId, checkIn, checkOut) {
    try {
        const response = await axios.get(`${HOTELS_SERVICE_URL}/${roomId}/rooms?check_in=${checkIn}&check_out=${checkOut}`);
        return response.data.rooms.some(room => room.id == roomId);
    } catch (error) {
        return false;
    }
}

// Routes
app.get('/health', (req, res) => {
    res.json({ 
        service: 'bookings-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Create booking
app.post('/', async (req, res) => {
    try {
        const { 
            user_id, 
            hotel_id, 
            room_id, 
            check_in, 
            check_out, 
            guests,
            special_requests 
        } = req.body;
        
        const token = req.headers.authorization?.split(' ')[1];

        // Validate token
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Validate required fields
        if (!user_id || !hotel_id || !room_id || !check_in || !check_out || !guests) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user exists (call users service)
        try {
            await axios.get(`${USERS_SERVICE_URL}/profile/${user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get hotel details
        const hotel = await getHotelDetails(hotelId);
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        // Check room availability
        const isAvailable = await checkRoomAvailability(room_id, check_in, check_out);
        if (!isAvailable) {
            return res.status(400).json({ error: 'Room not available for selected dates' });
        }

        // Calculate total price
        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        
        const [roomResult] = await axios.get(`${HOTELS_SERVICE_URL}/${hotel_id}/rooms`);
        const room = roomResult.data.rooms.find(r => r.id == room_id);
        const total_price = room ? room.price_per_night * nights : hotel.price_per_night * nights;

        // Create booking
        const [result] = await pool.query(
            `INSERT INTO bookings 
            (user_id, hotel_id, room_id, check_in, check_out, guests, total_price, special_requests) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, hotel_id, room_id, check_in, check_out, guests, total_price, special_requests || null]
        );

        res.status(201).json({
            message: 'Booking created successfully',
            bookingId: result.insertId,
            booking_number: `BK${result.insertId.toString().padStart(6, '0')}`,
            total_price: total_price.toFixed(2),
            status: 'pending'
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user bookings
app.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const [bookings] = await pool.query(
            'SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Enrich bookings with hotel details
        const enrichedBookings = await Promise.all(
            bookings.map(async (booking) => {
                try {
                    const hotel = await getHotelDetails(booking.hotel_id);
                    return {
                        ...booking,
                        hotel_name: hotel ? hotel.name : 'Unknown Hotel',
                        hotel_city: hotel ? hotel.city : 'Unknown'
                    };
                } catch (error) {
                    return booking;
                }
            })
        );

        res.json({ bookings: enrichedBookings });
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get booking by ID
app.get('/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = bookings[0];
        
        // Get hotel details
        const hotel = await getHotelDetails(booking.hotel_id);
        
        // Get user details
        let user = null;
        try {
            const userResponse = await axios.get(`${USERS_SERVICE_URL}/profile/${booking.user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            user = userResponse.data.user;
        } catch (error) {
            console.error('Failed to fetch user details:', error);
        }

        res.json({
            booking: {
                ...booking,
                hotel_details: hotel,
                user_details: user
            }
        });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update booking status
app.put('/:bookingId/status', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await pool.query(
            'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, bookingId]
        );

        res.json({ 
            message: 'Booking status updated successfully',
            bookingId,
            status 
        });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel booking
app.put('/:bookingId/cancel', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if booking exists and belongs to user
        const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = bookings[0];
        
        // Check if booking can be cancelled (e.g., not within 24 hours of check-in)
        const checkInDate = new Date(booking.check_in);
        const now = new Date();
        const hoursToCheckIn = (checkInDate - now) / (1000 * 60 * 60);
        
        if (hoursToCheckIn < 24) {
            return res.status(400).json({ error: 'Cannot cancel booking within 24 hours of check-in' });
        }

        await pool.query(
            'UPDATE bookings SET status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [bookingId]
        );

        res.json({ 
            message: 'Booking cancelled successfully',
            bookingId,
            refund_amount: booking.total_price * 0.8, // 80% refund
            refund_note: '80% refund will be processed within 5-7 business days'
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all bookings (admin)
app.get('/', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const { status, start_date, end_date } = req.query;

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        let query = 'SELECT * FROM bookings WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (start_date) {
            query += ' AND check_in >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND check_out <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY created_at DESC';

        const [bookings] = await pool.query(query, params);

        // Enrich bookings with user and hotel details
        const enrichedBookings = await Promise.all(
            bookings.map(async (booking) => {
                try {
                    const [userResponse, hotel] = await Promise.all([
                        axios.get(`${USERS_SERVICE_URL}/profile/${booking.user_id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(() => ({ data: { user: null } })),
                        getHotelDetails(booking.hotel_id).catch(() => null)
                    ]);

                    return {
                        ...booking,
                        user_name: userResponse.data.user ? userResponse.data.user.name : 'Unknown',
                        user_email: userResponse.data.user ? userResponse.data.user.email : 'Unknown',
                        hotel_name: hotel ? hotel.name : 'Unknown Hotel'
                    };
                } catch (error) {
                    return booking;
                }
            })
        );

        res.json({ bookings: enrichedBookings });
    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get booking statistics
app.get('/statistics', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenValidation = await validateToken(token);
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const [totalBookings] = await pool.query('SELECT COUNT(*) as count FROM bookings');
        const [confirmedBookings] = await pool.query('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"');
        const [cancelledBookings] = await pool.query('SELECT COUNT(*) as count FROM bookings WHERE status = "cancelled"');
        const [revenueResult] = await pool.query('SELECT SUM(total_price) as revenue FROM bookings WHERE status = "confirmed"');
        const [monthlyStats] = await pool.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as bookings_count,
                SUM(total_price) as revenue
            FROM bookings 
            WHERE status = 'confirmed'
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month DESC
            LIMIT 6
        `);

        res.json({
            statistics: {
                total_bookings: totalBookings[0].count,
                confirmed_bookings: confirmedBookings[0].count,
                cancelled_bookings: cancelledBookings[0].count,
                total_revenue: revenueResult[0].revenue || 0,
                monthly_stats: monthlyStats
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Bookings Service running on port ${PORT}`);
        console.log(`📡 Endpoints:`);
        console.log(`   POST   http://localhost:${PORT}/`);
        console.log(`   GET    http://localhost:${PORT}/user/:userId`);
        console.log(`   GET    http://localhost:${PORT}/:bookingId`);
        console.log(`   GET    http://localhost:${PORT}/health`);
    });
}

startServer().catch(console.error);