const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

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
        database: process.env.DB_NAME || 'hotels_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();
        console.log('✅ Hotels Service: Database connected');
        connection.release();
    } catch (error) {
        console.error('❌ Hotels Service: Database connection failed:', error);
        process.exit(1);
    }
}

// Routes
app.get('/health', (req, res) => {
    res.json({ 
        service: 'hotels-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Get all hotels
app.get('/', async (req, res) => {
    try {
        const { city, minPrice, maxPrice, rating } = req.query;
        
        let query = 'SELECT * FROM hotels WHERE 1=1';
        const params = [];

        if (city) {
            query += ' AND city LIKE ?';
            params.push(`%${city}%`);
        }

        if (minPrice) {
            query += ' AND price_per_night >= ?';
            params.push(minPrice);
        }

        if (maxPrice) {
            query += ' AND price_per_night <= ?';
            params.push(maxPrice);
        }

        if (rating) {
            query += ' AND rating >= ?';
            params.push(rating);
        }

        query += ' ORDER BY rating DESC, price_per_night ASC';

        const [hotels] = await pool.query(query, params);
        res.json({ hotels });
    } catch (error) {
        console.error('Get hotels error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get hotel by ID
app.get('/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        
        const [hotels] = await pool.query('SELECT * FROM hotels WHERE id = ?', [hotelId]);
        
        if (hotels.length === 0) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        // Get rooms for this hotel
        const [rooms] = await pool.query(
            'SELECT * FROM rooms WHERE hotel_id = ? AND is_available = 1',
            [hotelId]
        );

        const hotel = hotels[0];
        hotel.rooms = rooms;

        res.json({ hotel });
    } catch (error) {
        console.error('Get hotel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get available rooms for a hotel
app.get('/:hotelId/rooms', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { check_in, check_out, room_type } = req.query;
        
        let query = `
            SELECT r.* 
            FROM rooms r
            WHERE r.hotel_id = ? 
            AND r.is_available = 1
        `;
        const params = [hotelId];

        if (room_type) {
            query += ' AND r.room_type = ?';
            params.push(room_type);
        }

        // Check if rooms are booked for the dates
        if (check_in && check_out) {
            query += `
                AND r.id NOT IN (
                    SELECT room_id 
                    FROM bookings.bookings 
                    WHERE (
                        (check_in <= ? AND check_out >= ?) OR
                        (check_in <= ? AND check_out >= ?) OR
                        (check_in >= ? AND check_out <= ?)
                    ) AND status IN ('confirmed', 'pending')
                )
            `;
            params.push(check_out, check_in, check_in, check_out, check_in, check_out);
        }

        const [rooms] = await pool.query(query, params);
        res.json({ rooms });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new hotel (admin only)
app.post('/', async (req, res) => {
    try {
        const { 
            name, 
            description, 
            city, 
            address, 
            rating, 
            price_per_night,
            amenities,
            images 
        } = req.body;

        // Basic validation
        if (!name || !city || !address || !price_per_night) {
            return res.status(400).json({ error: 'Required fields: name, city, address, price_per_night' });
        }

        const [result] = await pool.query(
            `INSERT INTO hotels 
            (name, description, city, address, rating, price_per_night, amenities, images) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, 
                description || null, 
                city, 
                address, 
                rating || 0, 
                price_per_night,
                amenities ? JSON.stringify(amenities) : null,
                images ? JSON.stringify(images) : null
            ]
        );

        res.status(201).json({
            message: 'Hotel added successfully',
            hotelId: result.insertId
        });
    } catch (error) {
        console.error('Add hotel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add room to hotel (admin only)
app.post('/:hotelId/rooms', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { 
            room_number, 
            room_type, 
            max_guests, 
            price_per_night,
            amenities,
            is_available 
        } = req.body;

        // Check if hotel exists
        const [hotels] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotelId]);
        if (hotels.length === 0) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        const [result] = await pool.query(
            `INSERT INTO rooms 
            (hotel_id, room_number, room_type, max_guests, price_per_night, amenities, is_available) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                hotelId,
                room_number,
                room_type || 'standard',
                max_guests || 2,
                price_per_night,
                amenities ? JSON.stringify(amenities) : null,
                is_available !== undefined ? is_available : 1
            ]
        );

        res.status(201).json({
            message: 'Room added successfully',
            roomId: result.insertId
        });
    } catch (error) {
        console.error('Add room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search hotels (FIXED VERSION)
app.get('/search', async (req, res) => {
    try {
        const { query, city, minPrice, maxPrice, guests } = req.query;
        
        let sqlQuery = `
            SELECT h.* 
            FROM hotels h
            WHERE 1=1
        `;
        const params = [];

        if (query) {
            sqlQuery += ' AND (h.name LIKE ? OR h.description LIKE ? OR h.city LIKE ?)';
            const searchTerm = `%${query}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (city) {
            sqlQuery += ' AND h.city = ?';
            params.push(city);
        }

        if (minPrice) {
            sqlQuery += ' AND h.price_per_night >= ?';
            params.push(minPrice);
        }

        if (maxPrice) {
            sqlQuery += ' AND h.price_per_night <= ?';
            params.push(maxPrice);
        }

        // Note: Removed the guests filter as it requires room availability check
        // which would be a more complex query

        sqlQuery += ' ORDER BY h.rating DESC, h.price_per_night ASC';

        const [hotels] = await pool.query(sqlQuery, params);
        res.json({ hotels });
    } catch (error) {
        console.error('Search hotels error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get cities with hotels
app.get('/cities/available', async (req, res) => {
    try {
        const [cities] = await pool.query(
            'SELECT DISTINCT city FROM hotels ORDER BY city ASC'
        );
        res.json({ cities: cities.map(c => c.city) });
    } catch (error) {
        console.error('Get cities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update hotel
app.put('/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const updates = req.body;
        
        // Check if hotel exists
        const [hotels] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotelId]);
        if (hotels.length === 0) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updates).forEach(key => {
            if (key !== 'id') {
                updateFields.push(`${key} = ?`);
                updateValues.push(updates[key]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(hotelId);
        
        const updateQuery = `UPDATE hotels SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await pool.query(updateQuery, updateValues);

        res.json({ 
            message: 'Hotel updated successfully',
            hotelId 
        });
    } catch (error) {
        console.error('Update hotel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete hotel (admin only)
app.delete('/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        
        // Check if hotel exists
        const [hotels] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotelId]);
        if (hotels.length === 0) {
            return res.status(404).json({ error: 'Hotel not found' });
        }

        // Delete associated rooms first (cascade would handle this, but being explicit)
        await pool.query('DELETE FROM rooms WHERE hotel_id = ?', [hotelId]);
        
        // Delete hotel
        await pool.query('DELETE FROM hotels WHERE id = ?', [hotelId]);

        res.json({ 
            message: 'Hotel deleted successfully',
            hotelId 
        });
    } catch (error) {
        console.error('Delete hotel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get hotel statistics
app.get('/statistics/summary', async (req, res) => {
    try {
        const [totalHotels] = await pool.query('SELECT COUNT(*) as count FROM hotels');
        const [totalRooms] = await pool.query('SELECT COUNT(*) as count FROM rooms');
        const [availableRooms] = await pool.query('SELECT COUNT(*) as count FROM rooms WHERE is_available = 1');
        const [averageRating] = await pool.query('SELECT AVG(rating) as avg_rating FROM hotels');
        const [averagePrice] = await pool.query('SELECT AVG(price_per_night) as avg_price FROM hotels');
        
        // Get hotels by city
        const [hotelsByCity] = await pool.query(
            'SELECT city, COUNT(*) as count FROM hotels GROUP BY city ORDER BY count DESC'
        );

        res.json({
            statistics: {
                total_hotels: totalHotels[0].count,
                total_rooms: totalRooms[0].count,
                available_rooms: availableRooms[0].count,
                average_rating: parseFloat(averageRating[0].avg_rating || 0).toFixed(2),
                average_price: parseFloat(averagePrice[0].avg_price || 0).toFixed(2),
                hotels_by_city: hotelsByCity
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get room by ID
app.get('/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const [rooms] = await pool.query(
            `SELECT r.*, h.name as hotel_name, h.city, h.address 
             FROM rooms r 
             JOIN hotels h ON r.hotel_id = h.id 
             WHERE r.id = ?`,
            [roomId]
        );
        
        if (rooms.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({ room: rooms[0] });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update room
app.put('/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const updates = req.body;
        
        // Check if room exists
        const [rooms] = await pool.query('SELECT id FROM rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updates).forEach(key => {
            if (key !== 'id') {
                updateFields.push(`${key} = ?`);
                updateValues.push(updates[key]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(roomId);
        
        const updateQuery = `UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await pool.query(updateQuery, updateValues);

        res.json({ 
            message: 'Room updated successfully',
            roomId 
        });
    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete room
app.delete('/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Check if room exists
        const [rooms] = await pool.query('SELECT id FROM rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        await pool.query('DELETE FROM rooms WHERE id = ?', [roomId]);

        res.json({ 
            message: 'Room deleted successfully',
            roomId 
        });
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get hotel amenities
app.get('/amenities/all', async (req, res) => {
    try {
        // Extract all unique amenities from hotels
        const [hotels] = await pool.query('SELECT amenities FROM hotels WHERE amenities IS NOT NULL');
        
        const amenitiesSet = new Set();
        hotels.forEach(hotel => {
            try {
                const hotelAmenities = JSON.parse(hotel.amenities);
                if (Array.isArray(hotelAmenities)) {
                    hotelAmenities.forEach(amenity => {
                        amenitiesSet.add(amenity);
                    });
                }
            } catch (e) {
                // Skip if amenities is not valid JSON
            }
        });

        res.json({ 
            amenities: Array.from(amenitiesSet).sort()
        });
    } catch (error) {
        console.error('Get amenities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get hotels by amenities
app.get('/amenities/search', async (req, res) => {
    try {
        const { amenities } = req.query;
        
        if (!amenities) {
            return res.status(400).json({ error: 'Amenities parameter required' });
        }

        const amenitiesList = amenities.split(',').map(a => a.trim());
        
        // This is a simplified search - in production you'd use full-text search
        const [hotels] = await pool.query('SELECT * FROM hotels WHERE amenities IS NOT NULL');
        
        const filteredHotels = hotels.filter(hotel => {
            try {
                const hotelAmenities = JSON.parse(hotel.amenities);
                if (!Array.isArray(hotelAmenities)) return false;
                
                return amenitiesList.every(amenity => 
                    hotelAmenities.some(hotelAmenity => 
                        hotelAmenity.toLowerCase().includes(amenity.toLowerCase())
                    )
                );
            } catch (e) {
                return false;
            }
        });

        res.json({ hotels: filteredHotels });
    } catch (error) {
        console.error('Search by amenities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Hotels Service running on port ${PORT}`);
        console.log(`📡 Endpoints:`);
        console.log(`   GET    http://localhost:${PORT}/`);
        console.log(`   GET    http://localhost:${PORT}/search`);
        console.log(`   GET    http://localhost:${PORT}/:id`);
        console.log(`   GET    http://localhost:${PORT}/cities/available`);
        console.log(`   GET    http://localhost:${PORT}/health`);
        console.log(`   GET    http://localhost:${PORT}/statistics/summary`);
    });
}

startServer().catch(console.error);