CREATE DATABASE IF NOT EXISTS hotels_db;
USE hotels_db;

CREATE TABLE IF NOT EXISTS hotels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    city VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    price_per_night DECIMAL(10,2) NOT NULL,
    amenities JSON,
    images JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_city (city),
    INDEX idx_price (price_per_night),
    INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hotel_id INT NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    room_type ENUM('standard', 'deluxe', 'suite', 'executive') DEFAULT 'standard',
    max_guests INT DEFAULT 2,
    price_per_night DECIMAL(10,2) NOT NULL,
    amenities JSON,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    INDEX idx_hotel_id (hotel_id),
    INDEX idx_room_type (room_type),
    INDEX idx_available (is_available),
    UNIQUE KEY unique_room (hotel_id, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample hotels
INSERT INTO hotels (name, description, city, address, rating, price_per_night, amenities, images) VALUES
('Grand Plaza Hotel', 'Luxury hotel in the heart of the city with amazing views', 'New York', '123 Broadway', 4.5, 299.99, 
 '["WiFi", "Pool", "Spa", "Gym", "Restaurant", "Room Service"]',
 '["hotel1.jpg", "hotel2.jpg", "hotel3.jpg"]'),

('Seaside Resort', 'Beautiful beachfront resort with private beach access', 'Miami', '456 Ocean Drive', 4.7, 399.99,
 '["WiFi", "Private Beach", "Pool", "Spa", "Restaurant", "Bar"]',
 '["resort1.jpg", "resort2.jpg"]'),

('Mountain Lodge', 'Cozy lodge in the mountains with fireplace and scenic views', 'Denver', '789 Mountain Road', 4.2, 199.99,
 '["WiFi", "Fireplace", "Hot Tub", "Hiking Trails", "Restaurant"]',
 '["lodge1.jpg", "lodge2.jpg"]'),

('City Center Inn', 'Affordable hotel in downtown with easy access to attractions', 'Chicago', '101 Michigan Ave', 3.8, 149.99,
 '["WiFi", "Breakfast", "Parking", "Business Center"]',
 '["inn1.jpg"]'),

('Luxury Suites', 'Modern suites with kitchenette and city views', 'Los Angeles', '202 Sunset Blvd', 4.6, 349.99,
 '["WiFi", "Kitchenette", "Pool", "Gym", "Concierge"]',
 '["suite1.jpg", "suite2.jpg"]');

-- Insert sample rooms
INSERT INTO rooms (hotel_id, room_number, room_type, max_guests, price_per_night, amenities, is_available) VALUES
(1, '101', 'standard', 2, 299.99, '["WiFi", "TV", "AC", "Mini Bar"]', 1),
(1, '102', 'deluxe', 3, 399.99, '["WiFi", "TV", "AC", "Mini Bar", "Jacuzzi"]', 1),
(1, '201', 'suite', 4, 499.99, '["WiFi", "TV", "AC", "Mini Bar", "Jacuzzi", "Living Room"]', 1),
(2, '101', 'standard', 2, 399.99, '["WiFi", "TV", "AC", "Ocean View"]', 1),
(2, '102', 'deluxe', 3, 499.99, '["WiFi", "TV", "AC", "Ocean View", "Balcony"]', 1),
(3, '101', 'standard', 2, 199.99, '["WiFi", "TV", "Fireplace", "Mountain View"]', 1),
(3, '102', 'suite', 4, 299.99, '["WiFi", "TV", "Fireplace", "Mountain View", "Kitchenette"]', 1),
(4, '101', 'standard', 2, 149.99, '["WiFi", "TV", "AC"]', 1),
(5, '101', 'deluxe', 2, 349.99, '["WiFi", "TV", "AC", "Kitchenette", "City View"]', 1),
(5, '201', 'suite', 4, 449.99, '["WiFi", "TV", "AC", "Kitchenette", "City View", "Balcony"]', 1);