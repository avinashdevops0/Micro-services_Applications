CREATE DATABASE IF NOT EXISTS bookings_db;
USE bookings_db;

CREATE TABLE IF NOT EXISTS bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    hotel_id INT NOT NULL,
    room_id INT NOT NULL,
    booking_number VARCHAR(50) UNIQUE,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_hotel_id (hotel_id),
    INDEX idx_status (status),
    INDEX idx_dates (check_in, check_out),
    INDEX idx_booking_number (booking_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Function to generate booking number
DELIMITER $$
CREATE TRIGGER before_booking_insert
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    SET NEW.booking_number = CONCAT('BK', LPAD(NEW.id, 6, '0'));
END$$
DELIMITER ;

-- Insert sample bookings
INSERT INTO bookings (user_id, hotel_id, room_id, check_in, check_out, guests, total_price, status) VALUES
(1, 1, 1, DATE_ADD(CURDATE(), INTERVAL 7 DAY), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 2, 899.97, 'confirmed'),
(2, 2, 4, DATE_ADD(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 17 DAY), 3, 1499.97, 'confirmed'),
(1, 3, 6, DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 27 DAY), 2, 599.97, 'completed'),
(3, 4, 8, DATE_ADD(CURDATE(), INTERVAL 21 DAY), DATE_ADD(CURDATE(), INTERVAL 23 DAY), 2, 299.98, 'pending'),
(2, 5, 9, DATE_ADD(CURDATE(), INTERVAL 35 DAY), DATE_ADD(CURDATE(), INTERVAL 38 DAY), 2, 1049.97, 'confirmed');